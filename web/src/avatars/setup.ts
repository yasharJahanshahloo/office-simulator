/**
 * Which AvatarSetup a seat shows, and random setups for the /avatar page and demo mode.
 */
import {
  type AvatarSetup,
  FACIAL_HAIR,
  HAIR_COLORS,
  HAIR_STYLES,
  PANTS_COLORS,
  SHIRT_COLORS,
  SKIN_TONES,
  avatarFromKey,
  decodeAvatar,
} from '../../../shared/avatar';

/** The employee's own avatar when the code is valid, else the automatic look from their key. */
export function setupFor(p: { avatar: string | null; userKey: string }): AvatarSetup {
  return (p.avatar && decodeAvatar(p.avatar)) || avatarFromKey(p.userKey);
}

/** CSS colour of the setup's shirt (the name plaque's stripe). */
export function shirtCss(a: AvatarSetup): string {
  return SHIRT_COLORS[a.shirt]!.hex;
}

/** Any valid setup; glasses, headphones and facial hair a bit less often than not. */
export function randomAvatar(rand: () => number = Math.random): AvatarSetup {
  const pick = <T>(items: readonly T[]): T => items[Math.floor(rand() * items.length)]!;
  const index = (n: number) => Math.floor(rand() * n);
  return {
    skin: index(SKIN_TONES.length),
    hairStyle: pick(HAIR_STYLES),
    hairColor: index(HAIR_COLORS.length),
    facialHair: rand() < 0.5 ? 'none' : pick(FACIAL_HAIR),
    shirt: index(SHIRT_COLORS.length),
    pants: index(PANTS_COLORS.length),
    glasses: rand() < 0.35,
    headphones: rand() < 0.3,
  };
}
