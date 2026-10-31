/**
 * Low-poly mesh factories for each furniture kind. Every model is authored with
 * the user looking down local +Z (so the backrest / screen-back sits at -Z / +Z
 * respectively) and is rotated into place by the caller.
 */
import * as THREE from 'three';
import { MATERIALS, paletteMaterial } from './materials';
import type { FurnitureItem, PaletteKey } from './types';

const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
const cylinders = new Map<string, THREE.CylinderGeometry>();

function cylinderGeometry(rTop: number, rBottom: number, h: number, seg = 16): THREE.CylinderGeometry {
  const key = `${rTop}:${rBottom}:${h}:${seg}`;
  let g = cylinders.get(key);
  if (!g) {
    g = new THREE.CylinderGeometry(rTop, rBottom, h, seg);
    cylinders.set(key, g);
  }
  return g;
}

function shadowed<T extends THREE.Mesh>(mesh: T, cast = true): T {
  mesh.castShadow = cast;
  mesh.receiveShadow = true;
  return mesh;
}

/** Box with its centre at (x, y, z). */
export function box(
  w: number,
  h: number,
  d: number,
  material: THREE.Material | THREE.Material[],
  x = 0,
  y = 0,
  z = 0,
): THREE.Mesh {
  const m = new THREE.Mesh(UNIT_BOX, material);
  m.scale.set(w, h, d);
  m.position.set(x, y, z);
  return shadowed(m);
}

function cyl(
  rTop: number,
  rBottom: number,
  h: number,
  material: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
  seg = 16,
): THREE.Mesh {
  const m = new THREE.Mesh(cylinderGeometry(rTop, rBottom, h, seg), material);
  m.position.set(x, y, z);
  return shadowed(m);
}

export interface BuiltFurniture {
  object: THREE.Object3D;
  /** Monitor screen mesh for desks, so its material can be switched on/off. */
  screen?: THREE.Mesh;
}

function desk(width: number, depth: number): BuiltFurniture {
  const g = new THREE.Group();
  const leg = paletteMaterial('lightGrey');
  g.add(box(width, 0.03, depth, MATERIALS.deskTop, 0, 0.735, 0));
  g.add(box(0.04, 0.72, depth - 0.1, leg, -width / 2 + 0.05, 0.36, 0));
  g.add(box(0.04, 0.72, depth - 0.1, leg, width / 2 - 0.05, 0.36, 0));
  // privacy screen on the back edge (shared with the desk opposite)
  g.add(box(width, 0.3, 0.02, paletteMaterial('midGrey'), 0, 0.9, depth / 2 - 0.01));
  // monitor
  const mz = depth / 2 - 0.17;
  g.add(box(0.2, 0.015, 0.16, MATERIALS.plastic, 0, 0.758, mz));
  g.add(box(0.04, 0.16, 0.04, MATERIALS.plastic, 0, 0.83, mz));
  g.add(box(0.62, 0.38, 0.03, MATERIALS.plastic, 0, 1.06, mz));
  const screen = box(0.58, 0.34, 0.006, MATERIALS.screenOff, 0, 1.06, mz - 0.018);
  screen.castShadow = false;
  g.add(screen);
  // keyboard
  g.add(box(0.42, 0.015, 0.14, MATERIALS.plastic, 0, 0.758, -depth / 2 + 0.22));
  return { object: g, screen };
}

function officeChair(): THREE.Object3D {
  const g = new THREE.Group();
  const fabric = paletteMaterial('darkGrey');
  g.add(cyl(0.28, 0.28, 0.04, MATERIALS.plastic, 0, 0.05, 0, 5));
  g.add(cyl(0.025, 0.025, 0.36, MATERIALS.metal, 0, 0.25, 0, 8));
  g.add(box(0.5, 0.08, 0.48, fabric, 0, 0.46, 0));
  const back = box(0.46, 0.55, 0.05, fabric, 0, 0.8, -0.24);
  back.rotation.x = -0.12;
  g.add(back);
  for (const sx of [-1, 1]) g.add(box(0.04, 0.03, 0.3, paletteMaterial('lightGrey'), sx * 0.27, 0.66, 0));
  return g;
}

function shellChair(color: PaletteKey): THREE.Object3D {
  const g = new THREE.Group();
  const shell = paletteMaterial(color);
  for (const [x, z] of [
    [-0.18, -0.18],
    [0.18, -0.18],
    [-0.18, 0.18],
    [0.18, 0.18],
  ] as const) {
    g.add(cyl(0.015, 0.015, 0.42, MATERIALS.plastic, x, 0.21, z, 6));
  }
  g.add(box(0.5, 0.08, 0.48, shell, 0, 0.46, 0.02));
  g.add(box(0.52, 0.34, 0.07, shell, 0, 0.67, -0.22));
  for (const sx of [-1, 1]) g.add(box(0.07, 0.18, 0.36, shell, sx * 0.24, 0.58, -0.05));
  return g;
}

function roundTable(radius: number, height: number): THREE.Object3D {
  const g = new THREE.Group();
  const wood = paletteMaterial('wood', 0.6);
  g.add(cyl(radius, radius, 0.04, wood, 0, height - 0.02, 0, 32));
  g.add(cyl(0.05, 0.05, height - 0.04, MATERIALS.plastic, 0, (height - 0.04) / 2, 0, 8));
  g.add(cyl(radius * 0.5, radius * 0.5, 0.03, MATERIALS.plastic, 0, 0.015, 0, 24));
  return g;
}

function rectTable(width: number, depth: number): THREE.Object3D {
  const g = new THREE.Group();
  g.add(box(width, 0.05, depth, paletteMaterial('wood', 0.6), 0, 0.725, 0));
  for (const sx of [-1, 1]) g.add(box(0.1, 0.7, depth * 0.5, MATERIALS.plastic, sx * width * 0.32, 0.35, 0));
  return g;
}

function armchair(): THREE.Object3D {
  const g = new THREE.Group();
  const fabric = paletteMaterial('mustard');
  g.add(box(0.72, 0.42, 0.68, fabric, 0, 0.21, 0));
  g.add(box(0.72, 0.42, 0.14, fabric, 0, 0.62, -0.27));
  for (const sx of [-1, 1]) g.add(box(0.12, 0.2, 0.56, fabric, sx * 0.3, 0.52, 0.02));
  return g;
}

function stool(): THREE.Object3D {
  const g = new THREE.Group();
  g.add(cyl(0.2, 0.2, 0.02, MATERIALS.plastic, 0, 0.01, 0, 16));
  g.add(cyl(0.025, 0.025, 0.7, MATERIALS.metal, 0, 0.36, 0, 8));
  g.add(cyl(0.18, 0.17, 0.06, paletteMaterial('mustard'), 0, 0.72, 0, 16));
  return g;
}

function sofa(width: number, depth: number): THREE.Object3D {
  const g = new THREE.Group();
  const fabric = paletteMaterial('mustard');
  g.add(box(width, 0.42, depth, fabric, 0, 0.21, 0));
  g.add(box(width, 0.5, 0.18, fabric, 0, 0.67, -depth / 2 + 0.09));
  for (const sx of [-1, 1]) g.add(box(0.15, 0.22, depth, fabric, sx * (width / 2 - 0.075), 0.53, 0));
  return g;
}

const BLOB = new THREE.IcosahedronGeometry(1, 0);

function plant(size: number): THREE.Object3D {
  const g = new THREE.Group();
  g.add(cyl(0.2 * size, 0.15 * size, 0.35 * size, MATERIALS.pot, 0, 0.175 * size, 0, 10));
  const blobs: Array<[number, number, number, number, THREE.Material]> = [
    [0, 0.62, 0, 0.3, MATERIALS.foliageDark],
    [0.17, 0.78, 0.08, 0.24, MATERIALS.foliage],
    [-0.14, 0.82, -0.1, 0.22, MATERIALS.foliage],
    [0.02, 0.95, -0.02, 0.18, MATERIALS.foliage],
  ];
  for (const [x, y, z, r, mat] of blobs) {
    const m = shadowed(new THREE.Mesh(BLOB, mat));
    m.scale.setScalar(r * size);
    m.position.set(x * size, y * size, z * size);
    m.rotation.set(x * 7, y * 5, z * 3);
    g.add(m);
  }
  return g;
}

function slattedPartition(length: number, height: number): THREE.Object3D {
  const g = new THREE.Group();
  const green = paletteMaterial('green');
  const count = Math.round(length / 0.12);
  const step = length / count;
  for (let i = 0; i < count; i++) {
    const slat = box(0.035, height, 0.14, green, -length / 2 + step * (i + 0.5), height / 2, 0);
    slat.rotation.y = 0.35;
    g.add(slat);
  }
  g.add(box(length, 0.05, 0.12, green, 0, height - 0.025, 0));
  return g;
}

function tv(width: number): THREE.Object3D {
  const h = width * 0.5625;
  return box(width, h, 0.05, MATERIALS.plastic, 0, 1.5, 0.03);
}

function coffeeMachine(): THREE.Object3D {
  const g = new THREE.Group();
  g.add(box(0.32, 0.4, 0.36, paletteMaterial('charcoal'), 0, 0.94 + 0.2, 0));
  g.add(box(0.2, 0.06, 0.04, MATERIALS.metal, 0, 1.18, 0.19));
  return g;
}

/**
 * Builds one furniture item, already positioned and rotated in world space.
 * Floor patches are handled by the office builder, not here.
 */
export function buildFurniture(item: Exclude<FurnitureItem, { kind: 'floor-patch' }>): BuiltFurniture {
  let built: BuiltFurniture;
  switch (item.kind) {
    case 'desk':
      built = desk(item.width, item.depth);
      break;
    case 'office-chair':
      built = { object: officeChair() };
      break;
    case 'shell-chair':
      built = { object: shellChair(item.color) };
      break;
    case 'round-table':
      built = { object: roundTable(item.radius, item.height) };
      break;
    case 'rect-table':
      built = { object: rectTable(item.width, item.depth) };
      break;
    case 'armchair':
      built = { object: armchair() };
      break;
    case 'stool':
      built = { object: stool() };
      break;
    case 'sofa':
      built = { object: sofa(item.width, item.depth) };
      break;
    case 'plant':
      built = { object: plant(item.size) };
      break;
    case 'slatted-partition':
      built = { object: slattedPartition(item.length, item.height) };
      break;
    case 'tv':
      built = { object: tv(item.width) };
      break;
    case 'coffee-machine':
      built = { object: coffeeMachine() };
      break;
    case 'block': {
      const elevation = item.elevation ?? 0;
      const mesh = box(item.size.x, item.size.y, item.size.z, paletteMaterial(item.color), 0, elevation + item.size.y / 2, 0);
      mesh.castShadow = item.castShadow ?? true;
      built = { object: mesh };
      break;
    }
  }
  const root = new THREE.Group();
  root.add(built.object);
  root.position.set(item.at.x, 0, item.at.z);
  root.rotation.y = yawFromFacing(item.facing ?? { x: 0, z: 1 });
  if (item.id) root.name = item.id;
  return { object: root, ...(built.screen ? { screen: built.screen } : {}) };
}

/** Rotation about +Y that turns local +Z into `facing`. */
export function yawFromFacing(facing: { x: number; z: number }): number {
  return Math.atan2(facing.x, facing.z);
}
