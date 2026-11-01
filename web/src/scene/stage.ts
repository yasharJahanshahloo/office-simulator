/**
 * Renderer, cameras, controls and lights. Knows the office only through its bounds.
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import type { Rect } from '../office/types';

export type ViewMode = 'angled' | 'top';

const ANGLED_FOV = 40;
const ANGLED_PITCH = THREE.MathUtils.degToRad(45);

/** TV mode: ease back to the default framing, then sway the azimuth back and forth. */
const ORBIT_EASE_S = 6;
const ORBIT_AMPLITUDE = THREE.MathUtils.degToRad(34);
const ORBIT_PERIOD_S = 120;

interface OrbitStart {
  target: THREE.Vector3;
  spherical: THREE.Spherical;
  defaultRadius: number;
}

export class Stage {
  readonly scene = new THREE.Scene();
  readonly renderer: THREE.WebGLRenderer;
  readonly labelRenderer = new CSS2DRenderer();
  private readonly perspective: THREE.PerspectiveCamera;
  private readonly ortho: THREE.OrthographicCamera;
  private readonly angledControls: OrbitControls;
  private readonly topControls: OrbitControls;
  private mode: ViewMode = 'angled';
  private readonly center: THREE.Vector3;
  private readonly halfW: number;
  private readonly halfD: number;
  /** Unit vector from the target towards the default 3D camera. */
  private readonly angledDir = new THREE.Vector3(0, Math.sin(ANGLED_PITCH), Math.cos(ANGLED_PITCH));
  private orbit: OrbitStart | null = null;
  private topInset = 0;
  private orbitTime = 0;

  constructor(
    private readonly container: HTMLElement,
    bounds: Rect,
  ) {
    this.center = new THREE.Vector3((bounds.minX + bounds.maxX) / 2, 0, (bounds.minZ + bounds.maxZ) / 2);
    this.halfW = (bounds.maxX - bounds.minX) / 2 + 0.3;
    this.halfD = (bounds.maxZ - bounds.minZ) / 2 + 0.3;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    // Shadows only change when avatars change pose (a snapshot): see invalidateShadows().
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.needsUpdate = true;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    container.appendChild(this.renderer.domElement);

    this.labelRenderer.domElement.className = 'label-layer';
    container.appendChild(this.labelRenderer.domElement);

    this.scene.background = new THREE.Color(0xe8e6e2);

    this.perspective = new THREE.PerspectiveCamera(ANGLED_FOV, 1, 0.1, 200);
    this.ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);

    this.angledControls = new OrbitControls(this.perspective, this.renderer.domElement);
    this.angledControls.enableDamping = true;
    this.angledControls.maxPolarAngle = THREE.MathUtils.degToRad(85);
    this.angledControls.minDistance = 3;
    this.angledControls.maxDistance = 60;

    this.topControls = new OrbitControls(this.ortho, this.renderer.domElement);
    this.topControls.enableRotate = false;
    this.topControls.screenSpacePanning = true;
    this.topControls.enableDamping = true;
    this.topControls.minZoom = 0.5;
    this.topControls.maxZoom = 6;

    this.addLights(bounds);
    this.resize();
    this.resetView();
    window.addEventListener('resize', () => this.resize());
  }

  get camera(): THREE.Camera {
    return this.mode === 'angled' ? this.perspective : this.ortho;
  }

  get viewMode(): ViewMode {
    return this.mode;
  }

  /** Max texture anisotropy supported by the GPU (for textures seen at a grazing angle). */
  get maxAnisotropy(): number {
    return this.renderer.capabilities.getMaxAnisotropy();
  }

  get autoOrbiting(): boolean {
    return this.orbit !== null;
  }

  /**
   * TV mode. Only the 3D view orbits: it eases back to the default framing and then
   * sways slowly left and right (a full circle would put the tall north wall in front
   * of the desks). Turning it off leaves the camera where it is.
   */
  setAutoOrbit(on: boolean): void {
    if (!on || this.mode !== 'angled') {
      this.orbit = null;
      return;
    }
    if (this.orbit) return;
    const offset = this.perspective.position.clone().sub(this.angledControls.target);
    const spherical = new THREE.Spherical().setFromVector3(offset);
    const target = this.angledControls.target.clone();
    const defaultRadius = this.fitAngled(); // moves the camera; restored next frame
    this.perspective.position.copy(target).add(offset);
    this.orbit = { target, spherical, defaultRadius };
    this.orbitTime = 0;
  }

  setView(mode: ViewMode): void {
    this.orbit = null;
    this.mode = mode;
    this.angledControls.enabled = mode === 'angled';
    this.topControls.enabled = mode === 'top';
    this.resetView();
  }

  /** Frame the whole office for the current view mode. */
  resetView(): void {
    if (this.mode === 'angled') {
      this.angledControls.target.copy(this.center);
      const dist = this.fitAngled();
      this.perspective.position.copy(this.center).addScaledVector(this.angledDir, dist);
      this.angledControls.update();
    } else {
      this.ortho.position.set(this.center.x, 40, this.center.z + 1e-4);
      this.ortho.up.set(0, 1, 0);
      this.ortho.zoom = 1;
      this.updateOrthoFrustum();
      this.topControls.target.copy(this.center);
      this.topControls.update();
    }
  }

  /**
   * Pixels at the top of the screen kept clear for the HUD. Both views frame the
   * office in the area below it; takes effect immediately (view offset / frustum)
   * and fully on the next resetView().
   */
  setTopInset(px: number): void {
    if (Math.abs(px - this.topInset) < 1) return;
    this.topInset = px;
    this.updateOrthoFrustum();
    const pos = this.perspective.position.clone();
    const quat = this.perspective.quaternion.clone();
    this.fitAngled();
    this.perspective.position.copy(pos);
    this.perspective.quaternion.copy(quat);
  }

  /**
   * Smallest camera distance (along the 45-degree view direction) that keeps the whole
   * office inside the area below the top inset. Also sets the perspective camera's view
   * offset so the office is centred in that area. Moves the camera as a side effect.
   */
  private fitAngled(): number {
    const cam = this.perspective;
    const w = Math.max(this.container.clientWidth, 1);
    const h = Math.max(this.container.clientHeight, 1);
    cam.clearViewOffset();
    const corners: THREE.Vector3[] = [];
    for (const x of [-this.halfW, this.halfW])
      for (const z of [-this.halfD, this.halfD])
        for (const y of [0, 2.7]) corners.push(new THREE.Vector3(this.center.x + x, y, this.center.z + z));
    const yTop = 1 - (2 * this.topInset) / h - 0.03;
    const yBottom = -0.95;
    const p = new THREE.Vector3();
    const extent = (dist: number) => {
      cam.position.copy(this.center).addScaledVector(this.angledDir, dist);
      cam.lookAt(this.center);
      cam.updateMatrixWorld();
      let maxX = 0;
      let minY = Infinity;
      let maxY = -Infinity;
      for (const c of corners) {
        p.copy(c).project(cam);
        maxX = Math.max(maxX, Math.abs(p.x));
        minY = Math.min(minY, p.y);
        maxY = Math.max(maxY, p.y);
      }
      return { maxX, minY, maxY };
    };
    const fits = (dist: number) => {
      const e = extent(dist);
      return e.maxX <= 0.94 && e.maxY - e.minY <= yTop - yBottom;
    };
    let lo = 2;
    let hi = 200;
    for (let i = 0; i < 30; i++) {
      const mid = (lo + hi) / 2;
      if (fits(mid)) hi = mid;
      else lo = mid;
    }
    const e = extent(hi);
    const shiftNdc = (yTop + yBottom) / 2 - (e.maxY + e.minY) / 2;
    // positive offsetY moves the picture up
    cam.setViewOffset(w, h, 0, (shiftNdc * h) / 2, w, h);
    return hi;
  }

  /** Re-render the shadow map on the next frame. Call when something that casts a shadow moves. */
  invalidateShadows(): void {
    this.renderer.shadowMap.needsUpdate = true;
  }

  render(dt = 0): void {
    if (this.orbit && this.mode === 'angled') this.stepOrbit(dt);
    else (this.mode === 'angled' ? this.angledControls : this.topControls).update();
    this.renderer.render(this.scene, this.camera);
    this.labelRenderer.render(this.scene, this.camera);
  }

  private stepOrbit(dt: number): void {
    const o = this.orbit!;
    this.orbitTime += Math.min(dt, 0.1);
    const t = this.orbitTime;
    const k = THREE.MathUtils.smoothstep(t / ORBIT_EASE_S, 0, 1);
    // shortest way back to azimuth 0
    const theta0 = Math.atan2(Math.sin(o.spherical.theta), Math.cos(o.spherical.theta));
    const sway = Math.sin((t / ORBIT_PERIOD_S) * Math.PI * 2) * ORBIT_AMPLITUDE;
    const s = new THREE.Spherical(
      // pull back as it swings out so the rotated floor plan stays in frame
      THREE.MathUtils.lerp(o.spherical.radius, o.defaultRadius, k) * (1 + 0.3 * (sway / ORBIT_AMPLITUDE) ** 2 * k),
      THREE.MathUtils.lerp(o.spherical.phi, Math.PI / 2 - ANGLED_PITCH, k),
      THREE.MathUtils.lerp(theta0, 0, k) + sway * k,
    );
    const target = this.angledControls.target.lerpVectors(o.target, this.center, k);
    this.perspective.position.setFromSpherical(s).add(target);
    this.perspective.lookAt(target);
  }

  private updateOrthoFrustum(): void {
    const w = Math.max(this.container.clientWidth, 1);
    const h = Math.max(this.container.clientHeight, 1);
    // Fit the whole plan, with a small margin, into the area below the top inset.
    const avail = Math.max(h - this.topInset, h * 0.5);
    const half = Math.max(this.halfD, (this.halfW * avail) / w) * 1.04;
    const perPx = (2 * half) / avail;
    this.ortho.left = (-w / 2) * perPx;
    this.ortho.right = (w / 2) * perPx;
    this.ortho.top = (h - avail + avail / 2) * perPx;
    this.ortho.bottom = (-avail / 2) * perPx;
    this.ortho.updateProjectionMatrix();
  }

  private resize(): void {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.renderer.setSize(w, h);
    this.labelRenderer.setSize(w, h);
    this.perspective.aspect = w / Math.max(h, 1);
    this.perspective.updateProjectionMatrix();
    this.updateOrthoFrustum();
    // refit (also updates the view offset) without disturbing the current camera
    const pos = this.perspective.position.clone();
    const quat = this.perspective.quaternion.clone();
    const radius = this.fitAngled();
    this.perspective.position.copy(pos);
    this.perspective.quaternion.copy(quat);
    if (this.orbit) this.orbit.defaultRadius = radius;
  }

  private addLights(bounds: Rect): void {
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xb8b2a8, 1.4));

    const sun = new THREE.DirectionalLight(0xfff4e6, 2.0);
    sun.position.set(this.center.x - 6, 16, this.center.z + 7);
    sun.target.position.copy(this.center);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const r = Math.max(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ) / 2 + 2;
    sun.shadow.camera.left = -r;
    sun.shadow.camera.right = r;
    sun.shadow.camera.top = r;
    sun.shadow.camera.bottom = -r;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 50;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.02;
    sun.shadow.radius = 4;
    this.scene.add(sun, sun.target);

    // soft fill from the opposite side so nothing goes pitch black
    const fill = new THREE.DirectionalLight(0xe6eeff, 0.5);
    fill.position.set(this.center.x + 8, 10, this.center.z - 6);
    this.scene.add(fill);
  }
}
