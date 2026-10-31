/**
 * What an AvatarSetup (shared/avatar.ts) looks like on a figure: skin, shirt and trousers
 * colours, plus the head kit (hairstyles, facial hair, glasses, headphones).
 *
 * Every variant is built once per figure from shared geometries and toggled with `visible`;
 * materials come from `flat()`, one per colour for the whole app.
 *
 * Head frame: origin = head centre (head radius 0.12), +Z = face, Y up.
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  type AvatarSetup,
  HAIR_COLORS,
  type HairStyle,
  PANTS_COLORS,
  SHIRT_COLORS,
  SKIN_TONES,
} from '../../../shared/avatar';

/* ------------------------------------------------------------ materials */

const materials = new Map<number, THREE.MeshStandardMaterial>();
/** One flat-shaded material per colour, shared by every figure. */
export function flat(color: number): THREE.MeshStandardMaterial {
  let m = materials.get(color);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true });
    materials.set(color, m);
  }
  return m;
}

export function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

const hexNum = (hex: string) => parseInt(hex.slice(1), 16);

const GLASS_FRAME = 0x18181c;
const LENS = new THREE.MeshStandardMaterial({ color: 0xd4ecff, roughness: 0.15, metalness: 0.1, flatShading: true });
/** Light shells with dark cushions: readable against dark and light hair alike. */
const HEADPHONE_SHELL = 0xeeeef0;
const HEADPHONE_CUSHION = 0x2a2a2f;

/* ----------------------------------------------------------- geometries */

function boxAt(w: number, h: number, d: number, x: number, y: number, z: number, rotY = 0): THREE.BufferGeometry {
  return new THREE.BoxGeometry(w, h, d).rotateY(rotY).translate(x, y, z);
}

/** Merge geometries that may mix indexed and non-indexed inputs. */
function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const flatParts = parts.map((g) => (g.index ? g.toNonIndexed() : g));
  for (const g of flatParts) {
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
  }
  const out = mergeGeometries(flatParts);
  if (!out) throw new Error('avatar geometry merge failed');
  return out;
}

/** Cap of hair over the top/back of the head (tilted back in the mesh transform). */
const CAP_TILT = -0.35;

/** Hang pivot for long hair and the ponytail: the upper back of the head. */
const HANG_PIVOT = new THREE.Vector3(0, 0.055, -0.1);

const HEAD_GEO = (() => {
  const capShort = new THREE.SphereGeometry(0.128, 8, 4, 0, Math.PI * 2, 0, Math.PI * 0.52);
  const capLong = new THREE.SphereGeometry(0.133, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.6);

  // curly: a cap studded with chunky blobs, skipping the forehead so the face stays clear
  const blobs: THREE.BufferGeometry[] = [new THREE.SphereGeometry(0.13, 8, 4, 0, Math.PI * 2, 0, Math.PI * 0.55)];
  const ring = (theta: number, count: number, r: number, skipFront: number, phase = 0) => {
    for (let i = 0; i < count; i++) {
      const phi = phase + (i / count) * Math.PI * 2; // 0 = +Z (front)
      const front = Math.abs(Math.atan2(Math.sin(phi), Math.cos(phi)));
      if (front < skipFront) continue;
      const dir = new THREE.Vector3(Math.sin(theta) * Math.sin(phi), Math.cos(theta), Math.sin(theta) * Math.cos(phi));
      blobs.push(new THREE.IcosahedronGeometry(r, 0).translate(dir.x * 0.13, dir.y * 0.13, dir.z * 0.13));
    }
  };
  ring(0, 1, 0.05, -1);
  ring(0.32 * Math.PI, 6, 0.05, -1, Math.PI / 6);
  ring(0.52 * Math.PI, 9, 0.048, 0.9);
  const curly = merge(blobs);

  // long: side locks framing the face (fixed) + a back sheet on the hang pivot
  const longSides = merge([boxAt(0.04, 0.2, 0.12, -0.118, -0.05, -0.03), boxAt(0.04, 0.2, 0.12, 0.118, -0.05, -0.03)]);
  // pivot frame: hangs along -Y; sits just outside the back of the head
  const longBack = new THREE.CylinderGeometry(0.115, 0.1, 0.32, 8).scale(1, 1, 0.45).translate(0, -0.15, -0.02);

  // ponytail: bun at the pivot, tapered tail hanging from it
  const bun = new THREE.IcosahedronGeometry(0.045, 0).translate(0, 0, -0.035);
  const tail = new THREE.CylinderGeometry(0.042, 0.02, 0.24, 6).translate(0, -0.13, -0.05);
  const ponytail = merge([bun, tail]);

  // moustache: a bar over the mouth with short drooping ends
  const moustacheParts = () => [
    boxAt(0.13, 0.038, 0.046, 0, -0.036, 0.112),
    boxAt(0.03, 0.055, 0.038, -0.06, -0.056, 0.1),
    boxAt(0.03, 0.055, 0.038, 0.06, -0.056, 0.1),
  ];
  const moustache = merge(moustacheParts());
  // beard: lower-front shell of the head, tilted so it starts below the mouth in front and at
  // the ears on the sides, a chin block for volume, and the moustache (the gap reads as a mouth)
  const beard = merge([
    new THREE.SphereGeometry(0.132, 8, 3, 0, Math.PI, Math.PI * 0.5, Math.PI * 0.4).rotateX(0.55),
    // hangs a little below the chin so the side silhouette shows it
    boxAt(0.1, 0.08, 0.07, 0, -0.12, 0.066),
    ...moustacheParts(),
  ]);

  // glasses: dark frames with pale lenses just proud of them, temples back to the ears
  const LX = 0.046;
  const LY = 0.012;
  const LZ = 0.117;
  // temples run from the frame's outer edge (x 0.084) back to the ear (x 0.128, z -0.01)
  const templeLen = Math.hypot(0.044, 0.127);
  const templeYaw = Math.atan2(0.044, 0.127);
  const glassesFrame = merge([
    boxAt(0.076, 0.052, 0.018, -LX, LY, LZ),
    boxAt(0.076, 0.052, 0.018, LX, LY, LZ),
    boxAt(0.026, 0.012, 0.012, 0, LY + 0.01, LZ + 0.003),
    // bold temples: from the office camera most faces are seen side-on
    boxAt(0.018, 0.024, templeLen, -0.107, LY + 0.008, 0.0535, templeYaw),
    boxAt(0.018, 0.024, templeLen, 0.107, LY + 0.008, 0.0535, -templeYaw),
  ]);
  const lenses = merge([boxAt(0.058, 0.034, 0.02, -LX, LY, LZ), boxAt(0.058, 0.034, 0.02, LX, LY, LZ)]);

  // headphones (radius 0.16 at scale 1): band over the top, cups clear of hair on the sides
  const R = 0.16;
  const cup = () => new THREE.CylinderGeometry(0.048, 0.048, 0.04, 10).rotateZ(Math.PI / 2);
  const headphoneShell = merge([
    new THREE.TorusGeometry(R, 0.017, 5, 14, Math.PI),
    cup().translate(-R - 0.004, 0, 0),
    cup().translate(R + 0.004, 0, 0),
  ]);
  const cushion = () => new THREE.CylinderGeometry(0.04, 0.04, 0.02, 10).rotateZ(Math.PI / 2);
  const headphoneCushion = merge([cushion().translate(-R + 0.022, 0, 0), cushion().translate(R - 0.022, 0, 0)]);

  return {
    capShort,
    capLong,
    curly,
    longSides,
    longBack,
    ponytail,
    beard,
    moustache,
    glassesFrame,
    lenses,
    headphoneShell,
    headphoneCushion,
  };
})();

/** Headphone scale per hairstyle, so the band clears the hair. */
const HEADPHONE_SCALE: Record<HairStyle, number> = { bald: 0.93, short: 1, long: 1.02, ponytail: 1, curly: 1.2 };

/**
 * Hang angle (rotation.x of the hang pivot, head frame) that makes long hair / a ponytail hang
 * straight down, slightly away from the back, for a body whose torso and head are tilted
 * `bodyTilt` radians in total (positive = leaning towards the chest).
 */
export function hangFor(bodyTilt: number): number {
  return 0.15 - bodyTilt;
}

/* -------------------------------------------------------------- head kit */

export class HeadKit {
  private readonly capShort: THREE.Mesh;
  private readonly capLong: THREE.Mesh;
  private readonly curly: THREE.Mesh;
  private readonly longSides: THREE.Mesh;
  private readonly hang = new THREE.Group();
  private readonly tail = new THREE.Group();
  private readonly longBack: THREE.Mesh;
  private readonly ponytail: THREE.Mesh;
  private readonly beard: THREE.Mesh;
  private readonly moustache: THREE.Mesh;
  private readonly glasses = new THREE.Group();
  private readonly headphones = new THREE.Group();
  private readonly hairMeshes: THREE.Mesh[];

  constructor(head: THREE.Group) {
    const G = HEAD_GEO;
    const hair = flat(0);
    const cap = (geo: THREE.BufferGeometry) => {
      const m = mesh(geo, hair, 0, 0.015, -0.012);
      m.rotation.x = CAP_TILT;
      return m;
    };
    this.capShort = cap(G.capShort);
    this.capLong = cap(G.capLong);
    this.curly = cap(G.curly);
    this.longSides = mesh(G.longSides, hair);
    this.hang.position.copy(HANG_PIVOT);
    this.tail.position.copy(HANG_PIVOT);
    this.longBack = mesh(G.longBack, hair);
    this.ponytail = mesh(G.ponytail, hair);
    this.hang.add(this.longBack);
    this.tail.add(this.ponytail);
    this.beard = mesh(G.beard, hair);
    this.moustache = mesh(G.moustache, hair);
    this.glasses.add(mesh(G.glassesFrame, flat(GLASS_FRAME)), mesh(G.lenses, LENS));
    this.headphones.add(mesh(G.headphoneShell, flat(HEADPHONE_SHELL)), mesh(G.headphoneCushion, flat(HEADPHONE_CUSHION)));
    this.headphones.position.set(0, 0, -0.008);
    this.hairMeshes = [this.capShort, this.capLong, this.curly, this.longSides, this.longBack, this.ponytail, this.beard, this.moustache];
    head.add(this.capShort, this.capLong, this.curly, this.longSides, this.hang, this.tail, this.beard, this.moustache);
    head.add(this.glasses, this.headphones);
  }

  apply(a: AvatarSetup): void {
    const hair = flat(hexNum(HAIR_COLORS[a.hairColor]!.hex));
    for (const m of this.hairMeshes) m.material = hair;
    const s = a.hairStyle;
    this.capShort.visible = s === 'short' || s === 'ponytail';
    this.capLong.visible = s === 'long';
    this.longSides.visible = s === 'long';
    this.longBack.visible = s === 'long';
    this.curly.visible = s === 'curly';
    this.ponytail.visible = s === 'ponytail';
    this.beard.visible = a.facialHair === 'beard';
    this.moustache.visible = a.facialHair === 'moustache';
    this.glasses.visible = a.glasses;
    this.headphones.visible = a.headphones;
    this.headphones.scale.setScalar(HEADPHONE_SCALE[s]);
  }

  /**
   * Swing long hair and the ponytail (rotation.x of their pivot, see hangFor()). The ponytail can
   * take its own rotation, e.g. swept to the side of the head when lying on it.
   */
  setHang(angle: number, tail: { x: number; z: number } = { x: angle, z: 0 }): void {
    this.hang.rotation.x = angle;
    this.tail.rotation.set(tail.x, 0, tail.z);
  }
}

/* ---------------------------------------------------------------- outfit */

/** Mesh lists of one figure, recoloured together from an AvatarSetup. */
export class Outfit {
  readonly shirt: THREE.Mesh[] = [];
  readonly skin: THREE.Mesh[] = [];
  readonly pants: THREE.Mesh[] = [];
  readonly head: HeadKit;

  constructor(head: THREE.Group) {
    this.head = new HeadKit(head);
  }

  apply(a: AvatarSetup): void {
    const shirt = flat(hexNum(SHIRT_COLORS[a.shirt]!.hex));
    const skin = flat(hexNum(SKIN_TONES[a.skin]!.hex));
    const pants = flat(hexNum(PANTS_COLORS[a.pants]!.hex));
    for (const m of this.shirt) m.material = shirt;
    for (const m of this.skin) m.material = skin;
    for (const m of this.pants) m.material = pants;
    this.head.apply(a);
  }
}
