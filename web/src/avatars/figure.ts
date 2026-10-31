/**
 * Low-poly seated figure built from primitives. Authored in seat space:
 * origin = floor point under the seat, +Z = towards the desk, Y up.
 *
 * Geometries and materials are shared by every figure; only the transforms differ.
 * The look (colours, hair, glasses, ...) comes from an AvatarSetup, see outfit.ts.
 */
import * as THREE from 'three';
import type { AvatarSetup } from '../../../shared/avatar';
import { Outfit, flat, hangFor, mesh } from './outfit';

/* ---------------------------------------------------------- proportions */

/** Hip pivot: the figure sits a little forward on the chair so the hands reach the keyboard. */
const HIP = new THREE.Vector3(0, 0.54, 0.13);
/** Shoulder offset from the hip pivot, in the torso frame. */
export const SHOULDER_Y = 0.44;
export const SHOULDER_X = 0.2;
const UPPER_ARM = 0.3;
const FOREARM = 0.28;

/** Wrist targets in seat space (keyboard sits at z 0.65..0.79, y 0.765). */
const TYPING_WRIST = new THREE.Vector2(0.62, 0.8); // (z, y)

const LEAN_WORKING = 0.12;
const LEAN_IDLE = -0.3;

/* ------------------------------------------------- shared GPU resources */

function down(g: THREE.BufferGeometry, length: number): THREE.BufferGeometry {
  // Hang the limb from its pivot so rotating the pivot swings the whole limb.
  return g.translate(0, -length / 2, 0);
}

export const GEO = {
  torso: new THREE.CylinderGeometry(0.19, 0.16, 0.48, 6).translate(0, 0.25, 0),
  head: new THREE.IcosahedronGeometry(0.12, 1),
  upperArm: down(new THREE.CylinderGeometry(0.052, 0.045, UPPER_ARM, 6), UPPER_ARM),
  forearm: down(new THREE.CylinderGeometry(0.042, 0.036, FOREARM, 6), FOREARM),
  hand: new THREE.BoxGeometry(0.075, 0.1, 0.035).translate(0, -FOREARM - 0.04, 0),
  thigh: new THREE.BoxGeometry(0.15, 0.14, 0.46),
  shin: new THREE.BoxGeometry(0.12, 0.46, 0.12),
  shoe: new THREE.BoxGeometry(0.12, 0.07, 0.22),
};

export const SHOES = 0x1c1c20;

/* -------------------------------------------------------------- arm IK */

export interface ArmPose {
  shoulder: number;
  elbow: number;
}

/**
 * Two-bone IK in the torso's YZ plane. Limbs hang along -Y at rotation 0;
 * rotation.x = -phi points a limb phi radians from straight down towards +Z.
 */
function solveArm(wrist: THREE.Vector2, lean: number): ArmPose {
  // wrist relative to the hip, rotated into the torso frame, relative to the shoulder
  const dz = wrist.x - HIP.z;
  const dy = wrist.y - HIP.y;
  const c = Math.cos(-lean);
  const s = Math.sin(-lean);
  const tz = dy * s + dz * c;
  const ty = dy * c - dz * s - SHOULDER_Y;
  return solveArmTo(tz, ty);
}

/** Same IK, for a wrist target (tz, ty) given relative to the shoulder in the torso frame. */
export function solveArmTo(tz: number, ty: number): ArmPose {
  const d = THREE.MathUtils.clamp(Math.hypot(tz, ty), 0.05, UPPER_ARM + FOREARM - 1e-4);
  const alpha = Math.atan2(tz, -ty);
  const beta = Math.acos((UPPER_ARM ** 2 + d ** 2 - FOREARM ** 2) / (2 * UPPER_ARM * d));
  const phi1 = alpha - beta; // elbow drops below the shoulder-wrist line
  const ez = UPPER_ARM * Math.sin(phi1);
  const ey = -UPPER_ARM * Math.cos(phi1);
  const phi2 = Math.atan2(tz - ez, -(ty - ey));
  return { shoulder: -phi1, elbow: -(phi2 - phi1) };
}

interface ArmEuler {
  /** Shoulder rotation; z is mirrored for the left arm. */
  shoulder: THREE.Vector3Like;
  elbow: THREE.Vector3Like;
}

function planar(p: ArmPose): ArmEuler {
  return { shoulder: { x: p.shoulder, y: 0, z: 0 }, elbow: { x: p.elbow, y: 0, z: 0 } };
}

const POSES: Record<FigurePose, { lean: number; arm: ArmEuler; head: number }> = {
  working: { lean: LEAN_WORKING, arm: planar(solveArm(TYPING_WRIST, LEAN_WORKING)), head: 0.12 },
  // leaning back, hands clasped behind the head: elbows up and out, forearms folded inwards
  idle: {
    lean: LEAN_IDLE,
    arm: { shoulder: { x: -0.75, y: 0, z: 2.3 }, elbow: { x: 0, y: 0, z: 2.45 } },
    head: -0.12,
  },
};

/* -------------------------------------------------------------- figure */

export type FigurePose = 'working' | 'idle';

export class Figure {
  readonly root = new THREE.Group();
  private readonly torso = new THREE.Group();
  private readonly head = new THREE.Group();
  private readonly shoulders: THREE.Group[] = [];
  private readonly elbows: THREE.Group[] = [];
  private readonly outfit: Outfit;
  private pose: FigurePose = 'idle';
  private readonly phase = Math.random() * Math.PI * 2;

  constructor() {
    this.root.name = 'figure';
    this.outfit = new Outfit(this.head);
    const o = this.outfit;

    // legs (static)
    for (const sx of [-1, 1]) {
      const x = sx * 0.1;
      const thigh = mesh(GEO.thigh, flat(0), x, HIP.y + 0.02, HIP.z + 0.2);
      const shin = mesh(GEO.shin, flat(0), x, 0.3, HIP.z + 0.4);
      this.root.add(thigh, shin, mesh(GEO.shoe, flat(SHOES), x, 0.035, HIP.z + 0.46));
      o.pants.push(thigh, shin);
    }

    this.torso.position.copy(HIP);
    this.root.add(this.torso);
    const chest = mesh(GEO.torso, flat(0xffffff));
    chest.scale.z = 0.62;
    this.torso.add(chest);
    o.shirt.push(chest);

    this.head.position.set(0, SHOULDER_Y + 0.2, 0.01);
    this.torso.add(this.head);
    const face = mesh(GEO.head, flat(0xffffff));
    this.head.add(face);
    o.skin.push(face);

    for (const sx of [-1, 1]) {
      const shoulder = new THREE.Group();
      shoulder.position.set(sx * SHOULDER_X, SHOULDER_Y, 0);
      this.torso.add(shoulder);
      const sleeve = mesh(GEO.upperArm, flat(0xffffff));
      shoulder.add(sleeve);
      o.shirt.push(sleeve);

      const elbow = new THREE.Group();
      elbow.position.y = -UPPER_ARM;
      shoulder.add(elbow);
      const forearm = mesh(GEO.forearm, flat(0xffffff));
      const hand = mesh(GEO.hand, flat(0xffffff));
      elbow.add(forearm, hand);
      o.skin.push(forearm, hand);

      this.shoulders.push(shoulder);
      this.elbows.push(elbow);
    }
    this.setPose('idle');
  }

  setLook(look: AvatarSetup): void {
    this.outfit.apply(look);
  }

  setPose(pose: FigurePose): void {
    this.pose = pose;
    const p = POSES[pose];
    this.torso.rotation.x = p.lean;
    this.head.rotation.set(p.head, 0, 0);
    this.outfit.head.setHang(hangFor(p.lean + p.head));
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? -1 : 1;
      const { shoulder, elbow } = p.arm;
      this.shoulders[i]!.rotation.set(shoulder.x, shoulder.y * side, shoulder.z * side);
      this.elbows[i]!.rotation.set(elbow.x, elbow.y * side, elbow.z * side);
    }
  }

  /** `typingRate` in keystroke cycles per second; 0 = still. */
  animate(time: number, typingRate: number): void {
    const t = time + this.phase;
    if (this.pose === 'working') {
      const base = POSES.working.arm.elbow.x;
      const w = t * typingRate * Math.PI * 2;
      // hands alternate, each with a quick little tap
      for (let i = 0; i < 2; i++) {
        const tap = Math.max(0, Math.sin(w + i * Math.PI));
        this.elbows[i]!.rotation.x = base - tap * 0.16;
      }
      this.head.rotation.x = POSES.working.head + Math.sin(w * 0.25) * 0.03;
      this.head.rotation.y = 0;
    } else {
      // idle: slow breathing and an occasional look around
      this.torso.rotation.x = LEAN_IDLE + Math.sin(t * 1.3) * 0.015;
      this.head.rotation.y = Math.sin(t * 0.23) * 0.45 * Math.max(0, Math.sin(t * 0.11));
    }
  }
}
