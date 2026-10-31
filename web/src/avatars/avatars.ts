/**
 * Presence layer: turns a PresenceSnapshot into avatars, name tags, tool icons,
 * busy spinners and lit monitors on the desk seats.
 *
 *   working → seated figure typing, monitor on, tool icon above; busy = faster typing + spinner
 *   idle    → seated figure leaning back, monitor off
 *   away    → empty chair, monitor off, name tag stays
 *   absent from the snapshot (unregistered) → empty desk, no name tag
 *
 * Plus the owner's sofa seat (OWNER_SEAT_ID): no desk or monitor; working = sitting with a
 * phone (spinner above the phone when busy), idle = lying along the sofa, and the name
 * plaque lies on the floor in front of the sofa.
 */
import * as THREE from 'three';
import type { OfficeScene } from '../office/buildOffice';
import { yawFromFacing } from '../office/furniture';
import { MATERIALS } from '../office/materials';
import type { DeskItem, OfficeLayout, Seat, SofaItem } from '../office/types';
import type { PresenceSnapshot, SeatPresence } from '../presence/contract';
import { OWNER_SEAT_ID } from '../presence/owner';
import { Figure, type FigureLook, type FigurePose, lookFor, shirtCss } from './figure';
import { NameTag, PLAQUE_D, PLAQUE_W, spinnerMaterial, toolIconMaterial } from './labels';
import { SofaFigure } from './sofaFigure';

const TYPING_RATE = 2.2; // taps per second per hand
const BUSY_TYPING_RATE = 6;
const ICON_SIZE = 0.34;
const ICON_Y = 1.55;
const SPINNER_SIZE = 0.25;

/**
 * Lit-screen glow: monitors face sideways (east/west), so from the default camera and
 * from above the screen itself is edge-on. A soft light pool on the desk in front of
 * the monitor makes "monitor on" readable from both views.
 */
const glowGeometry = new THREE.PlaneGeometry(0.95, 0.5).rotateX(-Math.PI / 2);
const glowMaterial = (() => {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 64;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(64, 0, 4, 64, 0, 70);
  g.addColorStop(0, 'rgba(120, 200, 255, 0.9)');
  g.addColorStop(0.5, 'rgba(120, 200, 255, 0.35)');
  g.addColorStop(1, 'rgba(120, 200, 255, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
})();

/** What both the desk figure and the sofa figure can do. */
interface Avatar {
  readonly root: THREE.Group;
  setLook(look: FigureLook): void;
  setPose(pose: FigurePose): void;
  animate(time: number, rate: number): void;
}

interface SlotBase {
  seat: Seat;
  /** Frame the figure, tool icon (and for the sofa, the spinner) live in. */
  anchor: THREE.Group;
  /** Plaque position in world space (y = surface it lies on). */
  tagPosition: THREE.Vector3;
  /** Tool icon position in the anchor frame; bobs around this. */
  iconBase: THREE.Vector3;
  presence?: SeatPresence;
  figure?: Avatar;
  tag?: NameTag;
  icon?: THREE.Sprite;
  spinner?: THREE.Sprite;
}

interface DeskSlot extends SlotBase {
  kind: 'desk';
  desk: DeskItem;
  /** World space. */
  spinnerPosition: THREE.Vector3;
  glow: THREE.Mesh;
}

interface SofaSlot extends SlotBase {
  kind: 'sofa';
  sofa: SofaItem;
  /** Where along the sofa (sofa frame X) the owner sits. */
  seatX: number;
}

type Slot = DeskSlot | SofaSlot;

export class AvatarLayer {
  readonly root = new THREE.Group();
  private readonly slots = new Map<string, Slot>();
  private readonly warned = new Set<string>();

  constructor(
    layout: OfficeLayout,
    private readonly office: OfficeScene,
    private readonly anisotropy = 8,
  ) {
    this.root.name = 'presence';
    office.root.updateMatrixWorld(true);
    const desks = new Map<string, DeskItem>();
    for (const f of layout.furniture) if (f.kind === 'desk') desks.set(f.id, f);

    for (const seat of layout.seats) {
      const desk = seat.deskId ? desks.get(seat.deskId) : undefined;
      if (!desk) continue;
      const anchor = new THREE.Group();
      anchor.name = `seat:${seat.id}`;
      anchor.position.set(seat.position.x, seat.position.y, seat.position.z);
      anchor.rotation.y = yawFromFacing(seat.facing);
      this.root.add(anchor);

      // Spinner floats just over the monitor, nudged towards the camera side so it
      // never hides the name tag on the desk behind it.
      const screenPos = new THREE.Vector3();
      office.monitors.get(desk.id)?.getWorldPosition(screenPos);
      const r = cameraSideAxis(desk);
      const spinnerPosition = screenPos.clone().add(new THREE.Vector3(r.x * 0.26, 0.3, r.z * 0.26));

      const glow = new THREE.Mesh(glowGeometry, glowMaterial);
      const f = desk.facing ?? { x: 0, z: 1 };
      glow.position.set(screenPos.x - f.x * 0.25, 0.753, screenPos.z - f.z * 0.25);
      glow.rotation.y = yawFromFacing(f) + Math.PI; // gradient's bright edge at the screen
      glow.renderOrder = 2;
      glow.visible = false;
      this.root.add(glow);

      this.slots.set(seat.id, {
        kind: 'desk',
        seat,
        desk,
        anchor,
        tagPosition: plaquePosition(desk),
        iconBase: new THREE.Vector3(0, ICON_Y, 0.05),
        spinnerPosition,
        glow,
      });
    }

    const owner = layout.seats.find((s) => s.id === OWNER_SEAT_ID);
    const sofa = owner && nearestSofa(layout, owner);
    if (owner && sofa) this.slots.set(owner.id, this.sofaSlot(owner, sofa));
  }

  /** Desk seat ids the layer can show presence on. */
  get seatIds(): string[] {
    return [...this.slots.values()].filter((s) => s.kind === 'desk').map((s) => s.seat.id);
  }

  /** Whether the owner's sofa seat exists in this layout. */
  get hasOwnerSeat(): boolean {
    return this.slots.has(OWNER_SEAT_ID);
  }

  private sofaSlot(seat: Seat, sofa: SofaItem): SofaSlot {
    const facing = sofa.facing ?? { x: 0, z: 1 };
    const anchor = new THREE.Group();
    anchor.name = `seat:${seat.id}`;
    anchor.position.set(sofa.at.x, 0, sofa.at.z);
    anchor.rotation.y = yawFromFacing(facing);
    anchor.updateMatrix();
    this.root.add(anchor);
    const seatLocal = new THREE.Vector3(seat.position.x, 0, seat.position.z).applyMatrix4(anchor.matrix.clone().invert());

    // plaque flat on the floor in front of the sofa, level with the seat, clear of the
    // sitting figure's feet (which reach ~0.23 m past the front edge)
    const extentF = Math.abs(facing.x) * PLAQUE_W + Math.abs(facing.z) * PLAQUE_D;
    const tagPosition = new THREE.Vector3(seatLocal.x, 0, sofa.depth / 2 + 0.3 + extentF / 2).applyMatrix4(
      anchor.matrix,
    );
    tagPosition.y = 0.006;

    return { kind: 'sofa', seat, sofa, seatX: seatLocal.x, anchor, tagPosition, iconBase: new THREE.Vector3() };
  }

  /** Make the scene match `snapshot`. Seats missing from it become empty, untagged desks. */
  applySnapshot(snapshot: PresenceSnapshot): void {
    const next = new Map<string, SeatPresence>();
    for (const p of snapshot.seats) {
      if (this.slots.has(p.seatId)) next.set(p.seatId, p);
      else if (!this.warned.has(p.seatId)) {
        this.warned.add(p.seatId);
        console.warn(`presence: unknown seat "${p.seatId}" ignored`);
      }
    }
    for (const slot of this.slots.values()) this.applySeat(slot, next.get(slot.seat.id));
  }

  /** Call every frame with elapsed seconds. */
  update(time: number): void {
    spinnerMaterial().rotation = -time * 5;
    for (const slot of this.slots.values()) {
      const p = slot.presence;
      if (!p || !slot.figure || p.state === 'away') continue;
      const rate = p.state === 'working' ? (p.busy ? BUSY_TYPING_RATE : TYPING_RATE) : 0;
      slot.figure.animate(time, rate);
      if (slot.icon?.visible) {
        slot.icon.position.y = slot.iconBase.y + Math.sin(time * 2 + slot.seat.position.z) * 0.02;
      }
    }
  }

  private applySeat(slot: Slot, p: SeatPresence | undefined): void {
    slot.presence = p;
    const state = p?.state;

    // name tag: any registered employee, whatever their state
    if (p) {
      if (!slot.tag) {
        slot.tag = new NameTag(this.anisotropy);
        slot.tag.root.position.x = slot.tagPosition.x;
        slot.tag.root.position.z = slot.tagPosition.z;
        if (slot.kind === 'sofa') slot.tag.root.position.y = slot.tagPosition.y;
        this.root.add(slot.tag.root);
      }
      slot.tag.set(p.name, shirtCss(p.userKey));
    } else if (slot.tag) {
      this.root.remove(slot.tag.root);
      slot.tag.dispose();
      slot.tag = undefined;
    }

    // figure
    const seated = state === 'working' || state === 'idle';
    if (seated) {
      if (!slot.figure) {
        slot.figure = slot.kind === 'desk' ? new Figure() : new SofaFigure(slot.sofa, slot.seatX);
        slot.anchor.add(slot.figure.root);
      }
      slot.figure.root.visible = true;
      slot.figure.setLook(lookFor(p!.userKey));
      slot.figure.setPose(state);
      if (slot.figure instanceof SofaFigure) slot.figure.iconPoint(slot.iconBase);
    } else if (slot.figure) {
      slot.figure.root.visible = false;
    }

    // monitor
    if (slot.kind === 'desk') {
      const screen = this.office.monitors.get(slot.desk.id);
      if (screen) screen.material = state === 'working' ? MATERIALS.screenOn : MATERIALS.screenOff;
      slot.glow.visible = state === 'working';
    }

    // tool icon above the head
    const tool = state === 'working' ? p!.tool : null;
    if (tool) {
      if (!slot.icon) {
        slot.icon = new THREE.Sprite(toolIconMaterial(tool));
        slot.icon.scale.setScalar(ICON_SIZE);
        slot.anchor.add(slot.icon);
      }
      slot.icon.position.copy(slot.iconBase);
      slot.icon.material = toolIconMaterial(tool);
      slot.icon.visible = true;
    } else if (slot.icon) {
      slot.icon.visible = false;
    }

    // busy spinner above the monitor (desk) or above the phone (sofa)
    const busy = state === 'working' && p!.busy;
    if (busy && !slot.spinner) {
      slot.spinner = new THREE.Sprite(spinnerMaterial());
      slot.spinner.scale.setScalar(SPINNER_SIZE);
      if (slot.kind === 'desk') {
        slot.spinner.position.copy(slot.spinnerPosition);
        this.root.add(slot.spinner);
      } else {
        slot.anchor.add(slot.spinner);
      }
    }
    if (slot.spinner && slot.figure instanceof SofaFigure) slot.figure.spinnerPoint(slot.spinner.position);
    if (slot.spinner) slot.spinner.visible = busy;
  }
}

/**
 * Where the name plaque lies: on the desk top, by the front edge (the employee's
 * side), in the corner towards +Z so the default south-facing camera sees it
 * unobstructed. The plaque's text always runs along world +X.
 */
function plaquePosition(desk: DeskItem): THREE.Vector3 {
  const f = desk.facing ?? { x: 0, z: 1 };
  const r = cameraSideAxis(desk);
  const extentF = Math.abs(f.x) * PLAQUE_W + Math.abs(f.z) * PLAQUE_D;
  const extentR = Math.abs(r.x) * PLAQUE_W + Math.abs(r.z) * PLAQUE_D;
  const along = -desk.depth / 2 + 0.03 + extentF / 2;
  const across = desk.width / 2 - 0.05 - extentR / 2;
  return new THREE.Vector3(desk.at.x + f.x * along + r.x * across, 0, desk.at.z + f.z * along + r.z * across);
}

/** Unit axis across the desk (along its width), pointing to the default camera's side (+Z, else +X). */
function cameraSideAxis(desk: DeskItem): { x: number; z: number } {
  const f = desk.facing ?? { x: 0, z: 1 };
  const r = { x: -f.z, z: f.x };
  return r.z < -1e-6 || (Math.abs(r.z) < 1e-6 && r.x < 0) ? { x: -r.x, z: -r.z } : r;
}

/** The sofa whose footprint is closest to `seat`. */
function nearestSofa(layout: OfficeLayout, seat: Seat): SofaItem | undefined {
  let best: SofaItem | undefined;
  let bestD = Infinity;
  for (const f of layout.furniture) {
    if (f.kind !== 'sofa') continue;
    const d = Math.hypot(f.at.x - seat.position.x, f.at.z - seat.position.z);
    if (d < bestD) {
      bestD = d;
      best = f;
    }
  }
  return best;
}
