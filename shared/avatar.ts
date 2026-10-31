/**
 * Avatar setup and its code. Shared by the /avatar page, the office view and the server/bot.
 *
 * Code format, version 1: "A1-" + 5 Crockford base32 characters.
 *   - 4 data characters = 20 bits, packed from the fields below (most significant first);
 *   - 1 check character = weighted sum of the data characters mod 32 (catches typos and swaps).
 * Input is forgiving: case, spaces, a missing dash, and Crockford look-alikes (O→0, I/L→1) are accepted.
 */

export interface Swatch {
  hex: string;
  /** Persian name, used in the bot's confirmation. */
  fa: string;
}

export const SKIN_TONES: readonly Swatch[] = [
  { hex: '#f5d6c1', fa: 'خیلی روشن' },
  { hex: '#e8bc98', fa: 'روشن' },
  { hex: '#d29f78', fa: 'گندمی روشن' },
  { hex: '#b57b52', fa: 'گندمی' },
  { hex: '#8a5636', fa: 'تیره' },
  { hex: '#5c3823', fa: 'خیلی تیره' },
];

export const HAIR_STYLES = ['short', 'long', 'curly', 'bald', 'ponytail'] as const;
export type HairStyle = (typeof HAIR_STYLES)[number];
export const HAIR_STYLE_FA: Record<HairStyle, string> = {
  short: 'کوتاه',
  long: 'بلند',
  curly: 'فرفری',
  bald: 'بدون مو',
  ponytail: 'دم‌اسبی',
};

export const HAIR_COLORS: readonly Swatch[] = [
  { hex: '#1d1916', fa: 'مشکی' },
  { hex: '#3a281d', fa: 'قهوه‌ای تیره' },
  { hex: '#6a462b', fa: 'قهوه‌ای' },
  { hex: '#9b6a40', fa: 'قهوه‌ای روشن' },
  { hex: '#d6ae68', fa: 'بور' },
  { hex: '#a2442a', fa: 'حنایی' },
  { hex: '#8f8f8f', fa: 'جوگندمی' },
  { hex: '#e6e3dd', fa: 'سفید' },
];

export const FACIAL_HAIR = ['none', 'beard', 'moustache'] as const;
export type FacialHair = (typeof FACIAL_HAIR)[number];
export const FACIAL_HAIR_FA: Record<FacialHair, string> = { none: 'بدون ریش', beard: 'ریش', moustache: 'سبیل' };

export const SHIRT_COLORS: readonly Swatch[] = [
  { hex: '#2f6fd6', fa: 'آبی' },
  { hex: '#1f3a68', fa: 'سرمه‌ای' },
  { hex: '#2fa36b', fa: 'سبز' },
  { hex: '#1e6b52', fa: 'سبز تیره' },
  { hex: '#e0b33a', fa: 'زرد' },
  { hex: '#e07a2f', fa: 'نارنجی' },
  { hex: '#c9393f', fa: 'قرمز' },
  { hex: '#d76fa5', fa: 'صورتی' },
  { hex: '#7a4fc4', fa: 'بنفش' },
  { hex: '#f2f0ea', fa: 'سفید' },
  { hex: '#8c8c8c', fa: 'طوسی' },
  { hex: '#26262a', fa: 'مشکی' },
];

export const PANTS_COLORS: readonly Swatch[] = [
  { hex: '#23252b', fa: 'مشکی' },
  { hex: '#2c3550', fa: 'سرمه‌ای' },
  { hex: '#3f5f8f', fa: 'جین' },
  { hex: '#6b6f78', fa: 'طوسی' },
  { hex: '#b9a27c', fa: 'کرم' },
  { hex: '#5b4330', fa: 'قهوه‌ای' },
  { hex: '#4d5a3a', fa: 'زیتونی' },
  { hex: '#e7e3da', fa: 'سفید' },
];

export interface AvatarSetup {
  skin: number;
  hairStyle: HairStyle;
  hairColor: number;
  facialHair: FacialHair;
  shirt: number;
  pants: number;
  glasses: boolean;
  headphones: boolean;
}

/** Field layout, most significant first: [bits, max value]. 3+3+3+2+4+3+1+1 = 20 bits. */
const FIELDS = [
  ['skin', 3, SKIN_TONES.length],
  ['hairStyle', 3, HAIR_STYLES.length],
  ['hairColor', 3, HAIR_COLORS.length],
  ['facialHair', 2, FACIAL_HAIR.length],
  ['shirt', 4, SHIRT_COLORS.length],
  ['pants', 3, PANTS_COLORS.length],
  ['glasses', 1, 2],
  ['headphones', 1, 2],
] as const;

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford base32
const PREFIX = 'A1-';

function toIndices(a: AvatarSetup): number[] {
  return [
    a.skin,
    HAIR_STYLES.indexOf(a.hairStyle),
    a.hairColor,
    FACIAL_HAIR.indexOf(a.facialHair),
    a.shirt,
    a.pants,
    a.glasses ? 1 : 0,
    a.headphones ? 1 : 0,
  ];
}

function checkChar(data: string): string {
  let sum = 0;
  for (let i = 0; i < data.length; i++) sum += (i + 1) * ALPHABET.indexOf(data[i]!) + 7;
  return ALPHABET[sum % 32]!;
}

export function isValidSetup(a: AvatarSetup): boolean {
  const idx = toIndices(a);
  return FIELDS.every(([, , max], i) => Number.isInteger(idx[i]) && idx[i]! >= 0 && idx[i]! < max);
}

export function encodeAvatar(a: AvatarSetup): string {
  if (!isValidSetup(a)) throw new Error('invalid avatar setup');
  const idx = toIndices(a);
  let bits = 0;
  FIELDS.forEach(([, width], i) => {
    bits = bits * 2 ** width + idx[i]!;
  });
  let data = '';
  for (let i = 3; i >= 0; i--) data += ALPHABET[Math.floor(bits / 32 ** i) % 32];
  return PREFIX + data + checkChar(data);
}

/** Normalise user input into a canonical code body (5 chars) or null. */
function normalise(input: string): string | null {
  let s = input.trim().toUpperCase().replace(/[\s_-]+/g, '');
  if (!s.startsWith('A1')) return null;
  s = s.slice(2).replace(/O/g, '0').replace(/[IL]/g, '1');
  return /^[0-9A-HJKMNP-TV-Z]{5}$/.test(s) ? s : null;
}

export function decodeAvatar(input: string): AvatarSetup | null {
  const body = normalise(input);
  if (!body) return null;
  const data = body.slice(0, 4);
  if (checkChar(data) !== body[4]) return null;
  let bits = 0;
  for (const ch of data) bits = bits * 32 + ALPHABET.indexOf(ch);
  const idx: number[] = [];
  for (let i = FIELDS.length - 1; i >= 0; i--) {
    const width = FIELDS[i]![1];
    idx[i] = bits % 2 ** width;
    bits = Math.floor(bits / 2 ** width);
  }
  const a: AvatarSetup = {
    skin: idx[0]!,
    hairStyle: HAIR_STYLES[idx[1]!]!,
    hairColor: idx[2]!,
    facialHair: FACIAL_HAIR[idx[3]!]!,
    shirt: idx[4]!,
    pants: idx[5]!,
    glasses: idx[6] === 1,
    headphones: idx[7] === 1,
  };
  return a.hairStyle && a.facialHair && isValidSetup(a) ? a : null;
}

/** Canonical form of a valid code ("A1-XXXXX"), or null. */
export function canonicalAvatarCode(input: string): string | null {
  const a = decodeAvatar(input);
  return a ? encodeAvatar(a) : null;
}

/** Deterministic automatic look for people without an avatar code (from the opaque userKey). */
export function avatarFromKey(key: string): AvatarSetup {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619) >>> 0;
  const pick = (n: number) => {
    const v = h % n;
    h = (Math.floor(h / n) ^ Math.imul(h, 2654435761)) >>> 0;
    return v;
  };
  return {
    skin: pick(SKIN_TONES.length),
    hairStyle: (['short', 'short', 'long', 'curly', 'ponytail'] as const)[pick(5)]!,
    hairColor: pick(4), // natural dark-to-light browns
    facialHair: 'none',
    shirt: pick(SHIRT_COLORS.length),
    pants: pick(3),
    glasses: false,
    headphones: false,
  };
}

/** Persian one-line description, for the bot's confirmation. */
export function describeAvatarFa(a: AvatarSetup): string {
  const parts = [
    `پوست ${SKIN_TONES[a.skin]!.fa}`,
    a.hairStyle === 'bald' ? 'بدون مو' : `موی ${HAIR_STYLE_FA[a.hairStyle]} ${HAIR_COLORS[a.hairColor]!.fa}`,
    FACIAL_HAIR_FA[a.facialHair],
    `پیراهن ${SHIRT_COLORS[a.shirt]!.fa}`,
    `شلوار ${PANTS_COLORS[a.pants]!.fa}`,
  ];
  if (a.glasses) parts.push('عینک');
  if (a.headphones) parts.push('هدفون');
  return parts.join('، ');
}
