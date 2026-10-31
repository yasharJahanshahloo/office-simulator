import { Resvg } from '@resvg/resvg-js';
import { OFFICE_LAYOUT } from '../../web/src/office/layout';
import type { DeskItem } from '../../web/src/office/types';
import { DESK_SEATS, labelOf } from './seats';

const PX = 64; // pixels per meter
const PAD = 40;

/**
 * A 2D top-down plan of the office for registration: every desk seat carries its label;
 * taken seats are greyed out. Rendered from the same layout data as the 3D view.
 */
export function seatMapSvg(taken: ReadonlySet<string>): string {
  const b = OFFICE_LAYOUT.bounds;
  const W = (b.maxX - b.minX) * PX + PAD * 2;
  const H = (b.maxZ - b.minZ) * PX + PAD * 2 + 60;
  const X = (x: number) => (x - b.minX) * PX + PAD;
  const Z = (z: number) => (z - b.minZ) * PX + PAD;
  const out: string[] = [];

  out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="DejaVu Sans, Arial, sans-serif">`);
  out.push(`<rect width="${W}" height="${H}" fill="#f4f1ea"/>`);
  out.push(`<rect x="${X(b.minX)}" y="${Z(b.minZ)}" width="${(b.maxX - b.minX) * PX}" height="${(b.maxZ - b.minZ) * PX}" fill="#e3e1dc" stroke="#33312e" stroke-width="8"/>`);

  for (const room of OFFICE_LAYOUT.rooms) {
    if (room.id === 'open-plan') continue;
    const r = room.rect;
    out.push(`<rect x="${X(r.minX)}" y="${Z(r.minZ)}" width="${(r.maxX - r.minX) * PX}" height="${(r.maxZ - r.minZ) * PX}" fill="#d2cfc8" stroke="#9a968e" stroke-width="2"/>`);
    out.push(`<text x="${X((r.minX + r.maxX) / 2)}" y="${Z((r.minZ + r.maxZ) / 2)}" text-anchor="middle" dominant-baseline="middle" font-size="20" fill="#8a867e">${room.label}</text>`);
  }

  for (const f of OFFICE_LAYOUT.furniture) {
    if (f.kind !== 'desk') continue;
    const d = f as DeskItem;
    const facing = d.facing ?? { x: 0, z: 1 };
    // Width runs across the user's view: along z when the user faces east/west.
    const alongZ = Math.abs(facing.x) > Math.abs(facing.z);
    const w = (alongZ ? d.depth : d.width) * PX;
    const h = (alongZ ? d.width : d.depth) * PX;
    out.push(`<rect x="${X(d.at.x) - w / 2}" y="${Z(d.at.z) - h / 2}" width="${w}" height="${h}" fill="#fbfaf7" stroke="#b9b5ad" stroke-width="2"/>`);
  }

  for (const seat of DESK_SEATS) {
    const label = labelOf(seat.id);
    const isTaken = taken.has(label);
    const cx = X(seat.position.x);
    const cy = Z(seat.position.z);
    out.push(`<circle cx="${cx}" cy="${cy}" r="24" fill="${isTaken ? '#b8b5b0' : '#2f9e6b'}" stroke="${isTaken ? '#9a968e' : '#1d6b47'}" stroke-width="3"/>`);
    out.push(`<text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="central" font-size="19" font-weight="bold" fill="${isTaken ? '#7a766f' : '#ffffff'}">${label}</text>`);
  }

  const ly = H - 34;
  out.push(`<circle cx="${PAD + 14}" cy="${ly}" r="12" fill="#2f9e6b"/><text x="${PAD + 34}" y="${ly}" dominant-baseline="central" font-size="20" fill="#33312e">Free</text>`);
  out.push(`<circle cx="${PAD + 124}" cy="${ly}" r="12" fill="#b8b5b0"/><text x="${PAD + 144}" y="${ly}" dominant-baseline="central" font-size="20" fill="#33312e">Taken</text>`);
  out.push('</svg>');
  return out.join('\n');
}

export function seatMapPng(taken: ReadonlySet<string>): Buffer {
  const resvg = new Resvg(seatMapSvg(taken), {
    font: { loadSystemFonts: true, defaultFontFamily: 'DejaVu Sans' },
    background: '#f4f1ea',
  });
  return resvg.render().asPng();
}
