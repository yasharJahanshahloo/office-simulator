import { OFFICE_LAYOUT } from '../../web/src/office/layout';

/** Desk seats only: meeting rooms, kitchen and sofas are not registrable. */
export const DESK_SEATS = OFFICE_LAYOUT.seats.filter((s) => s.zone === 'desk');

export function labelOf(seatId: string): string {
  return seatId.replace(/^desk-/, '');
}

export function seatIdOf(label: string): string {
  return `desk-${label}`;
}

export const DESK_LABELS: readonly string[] = DESK_SEATS.map((s) => labelOf(s.id));

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
