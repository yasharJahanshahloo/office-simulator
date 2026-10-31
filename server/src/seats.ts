import { OFFICE_LAYOUT } from '../../web/src/office/layout';

/** Desk seats only: meeting rooms, kitchen and sofas are not registrable. */
export const DESK_SEATS = OFFICE_LAYOUT.seats.filter((s) => s.zone === 'desk');

/**
 * Reserved seats: never offered by the bot (not on the map, not accepted when typed).
 * Only an admin can assign them, with /assign.
 */
export const RESERVED_SEATS: Readonly<Record<string, string>> = {
  SOFA: 'lounge-sofa-1', // the yellow sofa booth on the east wall
};

export function labelOf(seatId: string): string {
  for (const [label, id] of Object.entries(RESERVED_SEATS)) if (id === seatId) return label;
  return seatId.replace(/^desk-/, '');
}

export function seatIdOf(label: string): string {
  return RESERVED_SEATS[label] ?? `desk-${label}`;
}

export const DESK_LABELS: readonly string[] = DESK_SEATS.map((s) => labelOf(s.id));

/** How a seat is named in bot messages: «میز A1», or «مبل زرد» for the sofa. */
export function seatName(label: string): string {
  return label === 'SOFA' ? 'مبل زرد' : `میز ${label}`;
}

/** Admin input: any desk label or reserved label. */
export function parseAnyLabel(input: string): string | null {
  const desk = parseLabel(input);
  if (desk) return desk;
  const s = input.trim().toUpperCase();
  return s in RESERVED_SEATS ? s : null;
}

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

/**
 * Normalise what a user typed into a seat label, or null if it isn't one.
 * Accepts case, whitespace, Persian/Arabic digits, and a leading "desk-".
 */
export function parseLabel(input: string): string | null {
  let s = input.trim().toUpperCase().replace(/\s+/g, '');
  s = s.replace(/[۰-۹]/g, (d) => String(PERSIAN_DIGITS.indexOf(d)));
  s = s.replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d)));
  s = s.replace(/^DESK-?/, '');
  return DESK_LABELS.includes(s) ? s : null;
}
