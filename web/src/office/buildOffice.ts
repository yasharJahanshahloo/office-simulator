/**
 * Turns an OfficeLayout into a Three.js scene graph.
 */
import * as THREE from 'three';
import { box, buildFurniture } from './furniture';
import { MATERIALS, floorMaterial, paletteMaterial } from './materials';
import type { GlassPartition, OfficeLayout, Rect, Wall } from './types';

export interface OfficeScene {
  root: THREE.Group;
  /** Monitor screen meshes keyed by desk furniture id (e.g. `workstation-A1`). */
  monitors: Map<string, THREE.Mesh>;
}

const DOOR_HEAD = 2.2;

export function buildOffice(layout: OfficeLayout): OfficeScene {
  const root = new THREE.Group();
  root.name = 'office';
  const monitors = new Map<string, THREE.Mesh>();

  root.add(buildGround(layout.bounds));
  layout.rooms.forEach((room, i) => root.add(floorPlane(room.rect, floorMaterial(room.floor), 0.002 * (i + 1))));
  for (const wall of layout.walls) root.add(buildWall(wall));
  for (const pane of layout.glass) root.add(buildGlass(pane));

  for (const item of layout.furniture) {
    if (item.kind === 'floor-patch') {
      root.add(floorPlane(item.rect, paletteMaterial(item.color), 0.02));
      continue;
    }
    const built = buildFurniture(item);
    root.add(built.object);
    if (item.kind === 'desk' && built.screen) monitors.set(item.id, built.screen);
  }

  return { root, monitors };
}

function buildGround(bounds: Rect): THREE.Mesh {
  const w = bounds.maxX - bounds.minX;
  const d = bounds.maxZ - bounds.minZ;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(w * 4, d * 6), MATERIALS.ground);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.01;
  ground.receiveShadow = true;
  return ground;
}

function floorPlane(rect: Rect, material: THREE.Material, y: number): THREE.Mesh {
  const w = rect.maxX - rect.minX;
  const d = rect.maxZ - rect.minZ;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), material);
  m.rotation.x = -Math.PI / 2;
  m.position.set((rect.minX + rect.maxX) / 2, y, (rect.minZ + rect.maxZ) / 2);
  m.receiveShadow = true;
  return m;
}

/** A straight wall, split around its openings. Built along local X, then rotated. */
function buildWall(wall: Wall): THREE.Group {
  const g = new THREE.Group();
  const dx = wall.to.x - wall.from.x;
  const dz = wall.to.z - wall.from.z;
  const length = Math.hypot(dx, dz);
  g.position.set(wall.from.x, 0, wall.from.z);
  g.rotation.y = Math.atan2(-dz, dx);

  // BoxGeometry face order: +x, -x, +y, -y, +z, -z. Dark cap on top like the plan render.
  const mats = [MATERIALS.wall, MATERIALS.wall, MATERIALS.wallCap, MATERIALS.wall, MATERIALS.wall, MATERIALS.wall];
  const segment = (start: number, end: number, bottom: number, top: number) => {
    if (end - start <= 1e-3 || top - bottom <= 1e-3) return;
    g.add(box(end - start, top - bottom, wall.thickness, mats, (start + end) / 2, (bottom + top) / 2, 0));
  };

  const openings = [...wall.openings].sort((a, b) => a.start - b.start);
  let cursor = 0;
  for (const o of openings) {
    segment(cursor, o.start, 0, wall.height);
    const head = o.kind === 'door' ? DOOR_HEAD : (o.head ?? 2.3);
    segment(o.start, o.end, Math.min(head, wall.height), wall.height);
    if (o.kind === 'window') {
      const sill = o.sill ?? 0.9;
      segment(o.start, o.end, 0, sill);
      const top = Math.min(head, wall.height);
      const w = o.end - o.start;
      const pane = box(w, top - sill, 0.02, MATERIALS.windowGlass, (o.start + o.end) / 2, (sill + top) / 2, 0);
      pane.castShadow = false;
      g.add(pane);
      const bays = Math.max(1, Math.round(w / 1.3));
      for (let i = 0; i <= bays; i++) {
        g.add(box(0.05, top - sill, wall.thickness * 0.6, MATERIALS.frame, o.start + (w * i) / bays, (sill + top) / 2, 0));
      }
    } else {
      // threshold strip so the entrance reads from above
      const t = box(o.end - o.start, 0.01, wall.thickness, MATERIALS.door, (o.start + o.end) / 2, 0.005, 0);
      t.castShadow = false;
      g.add(t);
    }
    cursor = o.end;
  }
  segment(cursor, length, 0, wall.height);
  return g;
}

function buildGlass(pane: GlassPartition): THREE.Group {
  const g = new THREE.Group();
  const dx = pane.to.x - pane.from.x;
  const dz = pane.to.z - pane.from.z;
  const length = Math.hypot(dx, dz);
  g.position.set(pane.from.x, 0, pane.from.z);
  g.rotation.y = Math.atan2(-dz, dx);

  const glass = box(length, pane.height, 0.02, MATERIALS.glass, length / 2, pane.height / 2, 0);
  glass.castShadow = false;
  glass.receiveShadow = false;
  glass.renderOrder = 1;
  g.add(glass);
  g.add(box(length, 0.04, 0.05, MATERIALS.frame, length / 2, 0.02, 0));
  g.add(box(length, 0.04, 0.05, MATERIALS.frame, length / 2, pane.height - 0.02, 0));
  const bays = Math.max(1, Math.round(length / 1.2));
  for (let i = 0; i <= bays; i++) {
    const post = box(0.03, pane.height, 0.04, MATERIALS.frame, (length * i) / bays, pane.height / 2, 0);
    post.castShadow = false;
    g.add(post);
  }
  return g;
}
