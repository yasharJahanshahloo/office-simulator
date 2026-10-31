/**
 * Canvas-textured bits of the presence layer: the desk name plaque, the tool
 * icon billboards and the "agent busy" spinner.
 */
import * as THREE from 'three';
import { FONT_STACK, isRtl, whenFontReady } from '../fonts';
import type { Tool } from '../presence/contract';
import { TOOL_ORDER, TOOL_STYLES } from '../presence/tools';

/* ------------------------------------------------------------ name tag */

/** Plaque size on the desk, in metres: text runs along world X. */
// W stops just short of the monitor line so the next desk's monitor can't hide it.
export const PLAQUE_W = 0.58;
export const PLAQUE_D = 0.32;
const PLAQUE_Y = 0.75; // desk top
const CANVAS_W = 512;
const CANVAS_H = Math.round((CANVAS_W * PLAQUE_D) / PLAQUE_W);

const plaqueBase = new THREE.BoxGeometry(PLAQUE_W + 0.03, 0.014, PLAQUE_D + 0.03).translate(0, 0.007, 0);
const plaqueFace = new THREE.PlaneGeometry(PLAQUE_W, PLAQUE_D).rotateX(-Math.PI / 2);
const plaqueBaseMat = new THREE.MeshStandardMaterial({ color: 0x2d2d31, roughness: 0.6 });

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** A flat name card lying on the desk. Owns its texture; call dispose() when removed. */
export class NameTag {
  readonly root = new THREE.Group();
  private readonly canvas = document.createElement('canvas');
  private readonly texture: THREE.CanvasTexture;
  private readonly material: THREE.MeshBasicMaterial;
  private name = '';
  private accent = '#888';

  constructor(anisotropy: number) {
    this.canvas.width = CANVAS_W;
    this.canvas.height = CANVAS_H;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = anisotropy;
    this.material = new THREE.MeshBasicMaterial({ map: this.texture, toneMapped: false });

    const base = new THREE.Mesh(plaqueBase, plaqueBaseMat);
    base.receiveShadow = true;
    const face = new THREE.Mesh(plaqueFace, this.material);
    face.position.y = 0.0145;
    this.root.add(base, face);
    this.root.position.y = PLAQUE_Y;
  }

  set(name: string, accent: string): void {
    if (name === this.name && accent === this.accent) return;
    this.name = name;
    this.accent = accent;
    this.draw();
    const font = this.font(64);
    void whenFontReady(font, name).then(() => {
      if (this.name === name) this.draw();
    });
  }

  dispose(): void {
    this.texture.dispose();
    this.material.dispose();
  }

  private font(px: number): string {
    return `700 ${px}px ${FONT_STACK}`;
  }

  private draw(): void {
    const ctx = this.canvas.getContext('2d')!;
    const w = CANVAS_W;
    const h = CANVAS_H;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#fbfaf7';
    roundRect(ctx, 0, 0, w, h, 18);
    ctx.fill();
    // accent stripe in the employee's shirt colour along the bottom (desk-edge) side
    ctx.fillStyle = this.accent;
    ctx.fillRect(0, h - 16, w, 16);

    ctx.direction = isRtl(this.name) ? 'rtl' : 'ltr';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#1d1d22';
    const maxW = w * 0.92;
    let px = Math.round(h * 0.6);
    ctx.font = this.font(px);
    while (px > 18 && ctx.measureText(this.name).width > maxW) {
      px -= 2;
      ctx.font = this.font(px);
    }
    ctx.fillText(this.name, w / 2, (h - 16) / 2 + 4, maxW);
    this.texture.needsUpdate = true;
  }
}

/* ----------------------------------------------------------- tool icons */

function iconTexture(mark: string, color: string): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const draw = () => {
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, 4, 4, size - 8, size - 8, 30);
    ctx.fill();
    ctx.fillStyle = color;
    roundRect(ctx, 12, 12, size - 24, size - 24, 24);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `800 ${mark.length > 1 ? 54 : 70}px ${FONT_STACK}`;
    ctx.fillText(mark, size / 2, size / 2 + 4);
  };
  draw();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  void whenFontReady(`800 64px ${FONT_STACK}`, mark).then(() => {
    draw();
    tex.needsUpdate = true;
  });
  return tex;
}

let toolMaterials: Map<Tool, THREE.SpriteMaterial> | undefined;

export function toolIconMaterial(tool: Tool): THREE.SpriteMaterial {
  if (!toolMaterials) {
    toolMaterials = new Map();
    for (const t of TOOL_ORDER) {
      const s = TOOL_STYLES[t];
      toolMaterials.set(t, new THREE.SpriteMaterial({ map: iconTexture(s.mark, s.color), toneMapped: false }));
    }
  }
  return toolMaterials.get(tool)!;
}

/* -------------------------------------------------------------- spinner */

let spinnerMat: THREE.SpriteMaterial | undefined;

/** Shared spinner material; rotate it via `spinnerMaterial().rotation` once per frame. */
export function spinnerMaterial(): THREE.SpriteMaterial {
  if (!spinnerMat) {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const c = size / 2;
    ctx.lineCap = 'round';
    // white halo so it reads on any background
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = 26;
    ctx.beginPath();
    ctx.arc(c, c, 42, 0, Math.PI * 1.5);
    ctx.stroke();
    ctx.strokeStyle = '#ff9f1c';
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.arc(c, c, 42, 0, Math.PI * 1.5);
    ctx.stroke();
    ctx.fillStyle = '#ff9f1c';
    ctx.beginPath();
    ctx.arc(c, c, 13, 0, Math.PI * 2);
    ctx.fill();
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    spinnerMat = new THREE.SpriteMaterial({ map: tex, toneMapped: false });
  }
  return spinnerMat;
}
