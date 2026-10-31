/**
 * Live 3D preview for the avatar creator: the office's own Figure at a small desk with a
 * chair and monitor, on a round rug. Drag to rotate (limited polar angle, no pan).
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { AvatarSetup } from '../../../shared/avatar';
import { Figure, type FigurePose } from '../avatars/figure';
import { box, buildFurniture } from '../office/furniture';
import { MATERIALS, paletteMaterial } from '../office/materials';

const TYPING_RATE = 2.2;
const TARGET = new THREE.Vector3(0, 0.86, 0.2);

/**
 * A small open desk in seat space (front edge at z 0.56, keyboard where the figure's hands
 * type, as on the office desks) without the office's privacy screen, so the face stays visible.
 */
function smallDesk(): { object: THREE.Group; screen: THREE.Mesh } {
  const g = new THREE.Group();
  const leg = paletteMaterial('lightGrey');
  const z = 0.9;
  g.add(box(1.1, 0.03, 0.68, MATERIALS.deskTop, 0, 0.735, z));
  for (const sx of [-1, 1]) g.add(box(0.04, 0.72, 0.58, leg, sx * 0.5, 0.36, z));
  const mz = 1.1;
  g.add(box(0.18, 0.015, 0.14, MATERIALS.plastic, 0, 0.758, mz));
  g.add(box(0.035, 0.14, 0.035, MATERIALS.plastic, 0, 0.82, mz));
  g.add(box(0.52, 0.32, 0.03, MATERIALS.plastic, 0, 1.03, mz));
  const screen = box(0.48, 0.28, 0.006, MATERIALS.screenOff, 0, 1.03, mz - 0.018);
  g.add(screen, box(0.42, 0.015, 0.14, MATERIALS.plastic, 0, 0.758, 0.72));
  return { object: g, screen };
}

export class Preview {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  private readonly controls: OrbitControls;
  private readonly figure = new Figure();
  private readonly screen: THREE.Mesh;
  private readonly timer = new THREE.Timer();
  private pose: FigurePose = 'working';

  constructor(private readonly host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    host.appendChild(this.renderer.domElement);

    // furniture in seat space: chair at the origin, desk in front (+Z), as in the office layout
    const chair = buildFurniture({ kind: 'office-chair', at: { x: 0, z: 0 }, facing: { x: 0, z: 1 } });
    const desk = smallDesk();
    this.screen = desk.screen;
    this.scene.add(chair.object, desk.object, this.figure.root);
    this.scene.traverse((o) => {
      if (o instanceof THREE.Mesh) o.castShadow = true;
    });

    const rug = new THREE.Mesh(
      new THREE.CircleGeometry(1.45, 48).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: 0xe4ddd2, roughness: 1 }),
    );
    rug.position.set(0, 0.002, 0.4);
    rug.receiveShadow = true;
    this.scene.add(rug);

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xc9c0b3, 1.5));
    const sun = new THREE.DirectionalLight(0xfff4e6, 2.1);
    sun.position.set(2.2, 4.5, 3);
    sun.target.position.set(0, 0.5, 0.4);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -2, right: 2, top: 2, bottom: -2, near: 0.5, far: 12 });
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.02;
    sun.shadow.radius = 4;
    const fill = new THREE.DirectionalLight(0xe6eeff, 0.6);
    fill.position.set(-3, 2.5, 1);
    this.scene.add(sun, sun.target, fill);

    // three-quarter view of the face, past the monitor's edge
    this.camera.position
      .setFromSphericalCoords(2.75, THREE.MathUtils.degToRad(70), THREE.MathUtils.degToRad(52))
      .add(TARGET);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.copy(TARGET);
    this.controls.enablePan = false;
    this.controls.enableDamping = true;
    this.controls.minPolarAngle = THREE.MathUtils.degToRad(35);
    this.controls.maxPolarAngle = THREE.MathUtils.degToRad(84);
    this.controls.minDistance = 1.6;
    this.controls.maxDistance = 4.6;
    this.controls.update();

    this.setPose('working');
    new ResizeObserver(() => this.resize()).observe(host);
    this.resize();
    this.timer.connect(document);
    this.renderer.setAnimationLoop((t) => this.frame(t));
  }

  setLook(look: AvatarSetup): void {
    this.figure.setLook(look);
  }

  setPose(pose: FigurePose): void {
    this.pose = pose;
    this.figure.setPose(pose);
    this.screen.material = pose === 'working' ? MATERIALS.screenOn : MATERIALS.screenOff;
  }

  private resize(): void {
    const w = Math.max(this.host.clientWidth, 1);
    const h = Math.max(this.host.clientHeight, 1);
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    // keep the whole desk in frame on narrow (portrait) previews
    this.camera.fov = w / h < 1.1 ? 30 * Math.min(1.1 / (w / h), 1.6) : 30;
    this.camera.updateProjectionMatrix();
  }

  private frame(timestamp: number): void {
    this.timer.update(timestamp);
    this.figure.animate(this.timer.getElapsed(), this.pose === 'working' ? TYPING_RATE : 0);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}
