/**
 * The owner's figure on the lounge sofa. Same parts and palette as the desk figure,
 * but its own rig and poses:
 *   working → sitting upright, phone held in both hands, looking down at it
 *   idle    → lying along the sofa, head propped on the armrest, phone face-down on the chest
 *
 * Authored in the sofa's frame: origin = floor under the sofa centre, +Z = the way the
 * sofa faces (out into the room), X = along the sofa. Dimensions mirror `sofa()` in
 * office/furniture.ts (seat 0.42 high, 0.18 deep backrest, 0.15 wide arms 0.64 high).
 */
import * as THREE from 'three';
import { MATERIALS } from '../office/materials';
import type { SofaItem } from '../office/types';
import {
  type FigureLook,
  type FigurePose,
  GEO,
  PANTS,
  SHOES,
  SHOULDER_X,
  SHOULDER_Y,
  flat,
  mesh,
  solveArmTo,
} from './figure';

const SEAT_TOP = 0.42;
const BACK_DEPTH = 0.18;
const ARM_WIDTH = 0.15;

/** Leg rig: hip joints sit a little behind/below the pelvis pivot. */
const HIP_DROP = 0.02;
const THIGH = 0.5;
const SHOE_H = 0.07;
/** Pelvis height when sitting: thighs (0.14 thick) rest on the cushion. */
const SIT_PELVIS_Y = SEAT_TOP + 0.07 + HIP_DROP;
/** Shin length so the shoes just touch the floor when sitting. */
const SHIN = SIT_PELVIS_Y - HIP_DROP - SHOE_H;
const HEAD_Y = SHOULDER_Y + 0.2;

/** Lying: upper body propped up this much (radians) so the head rests on the armrest. */
const LIE_TILT = 0.4;
/** Lying: pelvis height so the back of the torso just touches the cushion. */
const LIE_PELVIS_Y = SEAT_TOP + 0.1;

const GEOM = {
  thigh: new THREE.BoxGeometry(0.15, 0.14, THIGH + 0.04).translate(0, 0, THIGH / 2),
  shin: new THREE.BoxGeometry(0.12, SHIN, 0.12).translate(0, -SHIN / 2, 0),
  shoe: new THREE.BoxGeometry(0.12, SHOE_H, 0.22).translate(0, -SHIN - SHOE_H / 2, 0.05),
  // a little oversized (like the rest of the figure) so it reads from the TV camera
  phone: new THREE.BoxGeometry(0.095, 0.18, 0.018),
  // screen on the phone's -Z face
  screen: new THREE.PlaneGeometry(0.083, 0.162).rotateY(Math.PI).translate(0, 0, -0.0095),
};
const PHONE_BODY = 0x1a1a1f;

/** Arm IK target relative to the shoulder (torso frame) plus an inward swing so both hands meet. */
function holdArm(tz: number, ty: number, inward: number) {
  const a = solveArmTo(tz, ty);
  return { shoulderX: a.shoulder, elbowX: a.elbow, inward };
}

interface Pose {
  /** Torso tilt in the body frame (positive = towards the chest side). */
  torso: number;
  head: number;
  arm: ReturnType<typeof holdArm>;
  /** Hip / knee rotation.x per leg [left, right]. */
  hips: [number, number];
  knees: [number, number];
  phone: { y: number; z: number; tilt: number };
}

const POSES: Record<FigurePose, Pose> = {
  working: {
    torso: 0,
    head: 0.5, // chin down, looking at the phone
    arm: holdArm(0.25, -0.2, 0.55),
    hips: [0, 0],
    knees: [0, 0],
    // in front of the chest, top tipped away so the screen faces the eyes
    phone: { y: 0.26, z: 0.3, tilt: 1.06 },
  },
  idle: {
    torso: LIE_TILT,
    head: 0.2,
    arm: holdArm(0.16, -0.2, 0.6),
    // left knee raised, right leg straight along the cushion
    hips: [Math.PI / 2 - 0.5, Math.PI / 2],
    knees: [-0.46, -Math.PI / 2],
    // face-down on the chest
    phone: { y: 0.25, z: 0.135, tilt: 0 },
  },
};

/** Body frame → sofa frame when lying: head towards -X, chest up, back to the cushion. */
const LIE_QUAT = new THREE.Quaternion().setFromRotationMatrix(
  new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, -1), new THREE.Vector3(-1, 0, 0), new THREE.Vector3(0, 1, 0)),
);

export class SofaFigure {
  readonly root = new THREE.Group();
  private readonly body = new THREE.Group();
  private readonly torso = new THREE.Group();
  private readonly head = new THREE.Group();
  private readonly phone = new THREE.Group();
  private readonly screen: THREE.Mesh;
  private readonly shoulders: THREE.Group[] = [];
  private readonly elbows: THREE.Group[] = [];
  private readonly hips: THREE.Group[] = [];
  private readonly knees: THREE.Group[] = [];
  private readonly shirtMeshes: THREE.Mesh[] = [];
  private readonly skinMeshes: THREE.Mesh[] = [];
  private readonly hairMesh: THREE.Mesh;
  private pose: FigurePose = 'idle';
  private readonly sitAt: THREE.Vector3;
  private readonly lieAt: THREE.Vector3;

  /** `seatX`: where along the sofa (sofa frame X) the sitting figure sits. */
  constructor(sofa: SofaItem, seatX: number) {
    this.root.name = 'sofa-figure';
    const backFront = -sofa.depth / 2 + BACK_DEPTH;
    const armInner = sofa.width / 2 - ARM_WIDTH;
    this.sitAt = new THREE.Vector3(seatX, SIT_PELVIS_Y, backFront + 0.135);
    // head just over the -X armrest; pelvis follows from the propped-up torso
    const headX = -armInner - 0.06;
    this.lieAt = new THREE.Vector3(
      headX + HEAD_Y * Math.cos(LIE_TILT),
      LIE_PELVIS_Y,
      (backFront + sofa.depth / 2) / 2,
    );

    this.root.add(this.body);

    for (const sx of [-1, 1]) {
      const hip = new THREE.Group();
      hip.position.set(sx * 0.1, -HIP_DROP, 0);
      this.body.add(hip);
      hip.add(mesh(GEOM.thigh, flat(PANTS)));
      const knee = new THREE.Group();
      knee.position.z = THIGH;
      hip.add(knee);
      knee.add(mesh(GEOM.shin, flat(PANTS)), mesh(GEOM.shoe, flat(SHOES)));
      this.hips.push(hip);
      this.knees.push(knee);
    }

    this.body.add(this.torso);
    const chest = mesh(GEO.torso, flat(0xffffff));
    chest.scale.z = 0.62;
    this.torso.add(chest);
    this.shirtMeshes.push(chest);

    this.head.position.set(0, HEAD_Y, 0.01);
    this.torso.add(this.head);
    const face = mesh(GEO.head, flat(0xffffff));
    this.head.add(face);
    this.skinMeshes.push(face);
    this.hairMesh = mesh(GEO.hair, flat(0x000000), 0, 0.015, -0.012);
    this.hairMesh.rotation.x = -0.35;
    this.head.add(this.hairMesh);

    for (const sx of [-1, 1]) {
      const shoulder = new THREE.Group();
      shoulder.position.set(sx * SHOULDER_X, SHOULDER_Y, 0);
      this.torso.add(shoulder);
      const sleeve = mesh(GEO.upperArm, flat(0xffffff));
      shoulder.add(sleeve);
      this.shirtMeshes.push(sleeve);
      const elbow = new THREE.Group();
      elbow.position.y = -0.3;
      shoulder.add(elbow);
      const forearm = mesh(GEO.forearm, flat(0xffffff));
      const hand = mesh(GEO.hand, flat(0xffffff));
      elbow.add(forearm, hand);
      this.skinMeshes.push(forearm, hand);
      this.shoulders.push(shoulder);
      this.elbows.push(elbow);
    }

    this.phone.add(mesh(GEOM.phone, flat(PHONE_BODY)));
    this.screen = new THREE.Mesh(GEOM.screen, MATERIALS.screenOff);
    this.phone.add(this.screen);
    this.torso.add(this.phone);

    this.setPose('idle');
  }

  setLook(look: FigureLook): void {
    for (const m of this.shirtMeshes) m.material = flat(look.shirt);
    for (const m of this.skinMeshes) m.material = flat(look.skin);
    this.hairMesh.material = flat(look.hair);
  }

  setPose(pose: FigurePose): void {
    this.pose = pose;
    const p = POSES[pose];
    if (pose === 'working') {
      this.body.position.copy(this.sitAt);
      this.body.quaternion.identity();
    } else {
      this.body.position.copy(this.lieAt);
      this.body.quaternion.copy(LIE_QUAT);
    }
    this.torso.rotation.set(p.torso, 0, 0);
    this.head.rotation.set(p.head, 0, 0);
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? -1 : 1;
      this.shoulders[i]!.rotation.set(p.arm.shoulderX, -side * p.arm.inward, 0);
      this.elbows[i]!.rotation.set(p.arm.elbowX, 0, 0);
      this.hips[i]!.rotation.set(p.hips[i]!, 0, 0);
      this.knees[i]!.rotation.set(p.knees[i]!, 0, 0);
    }
    this.phone.position.set(0, p.phone.y, p.phone.z);
    this.phone.rotation.set(p.phone.tilt, 0, 0);
    this.screen.material = pose === 'working' ? MATERIALS.screenOn : MATERIALS.screenOff;
  }

  /** Where the tool icon floats: above the head, in the sofa frame. */
  iconPoint(out: THREE.Vector3): THREE.Vector3 {
    return this.localOf(this.head, out).add(new THREE.Vector3(0, 0.4, 0));
  }

  /** Where the busy spinner floats: above the phone, a little in front of the face. */
  spinnerPoint(out: THREE.Vector3): THREE.Vector3 {
    return this.localOf(this.phone, out).add(new THREE.Vector3(0, 0.42, 0.15));
  }

  /** `rate` in thumb taps per second; 0 = still. */
  animate(time: number, rate: number): void {
    const p = POSES[this.pose];
    if (this.pose === 'working') {
      const w = time * rate * Math.PI * 2;
      this.phone.rotation.x = p.phone.tilt + Math.sin(w * 0.5) * 0.05;
      for (let i = 0; i < 2; i++) {
        this.elbows[i]!.rotation.x = p.arm.elbowX - Math.max(0, Math.sin(w + i * Math.PI)) * 0.06;
      }
      this.head.rotation.x = p.head + Math.sin(w * 0.2) * 0.03;
    } else {
      // breathing, and a slow glance around
      this.torso.rotation.x = p.torso + Math.sin(time * 1.1) * 0.012;
      this.head.rotation.y = Math.sin(time * 0.2) * 0.35 * Math.max(0, Math.sin(time * 0.09));
    }
  }

  /** Origin of `obj` in the sofa frame (walks local matrices; needs no world update). */
  private localOf(obj: THREE.Object3D, out: THREE.Vector3): THREE.Vector3 {
    out.set(0, 0, 0);
    for (let o: THREE.Object3D | null = obj; o && o !== this.root; o = o.parent) {
      o.updateMatrix();
      out.applyMatrix4(o.matrix);
    }
    return out;
  }
}
