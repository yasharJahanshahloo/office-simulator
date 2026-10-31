/**
 * Fake presence for `?demo=<seed>` and the debug panel: a deterministic
 * PresenceSnapshot that goes through the same rendering path as live data.
 */
import { encodeAvatar } from '../../../shared/avatar';
import { randomAvatar } from '../avatars/setup';
import type { AvatarState, PresenceSnapshot, SeatPresence, Tool } from './contract';
import { OWNER_SEAT_ID, OWNER_SEAT_LABEL } from './owner';
import { TOOL_ORDER } from './tools';

/** Small deterministic PRNG so the same seed gives the same office. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NAMES = [
  '@sara_m',
  'مریم',
  '@reza.dev',
  'علی رضایی',
  '@niloo',
  'نگار ✨',
  '@kaveh',
  '@arash_k',
  'Mina 🌸',
  '@parisa',
  'حسین',
  '@omid99',
  '@yasaman',
  'Babak',
  '@farzaneh_t',
  'امیرحسین',
  '@shirin',
  '@dariush',
  'Leila ☕',
  '@pouya',
  '@hamed',
  'سپیده',
  '@navid',
  '@roya',
];

function pick<T>(rand: () => number, items: readonly T[]): T {
  return items[Math.floor(rand() * items.length)]!;
}

function shuffle<T>(rand: () => number, items: T[]): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [items[i], items[j]] = [items[j]!, items[i]!];
  }
  return items;
}

/** The owner's demo avatar: short black hair, beard, glasses, navy shirt, jeans. */
const OWNER_AVATAR = encodeAvatar({
  skin: 2,
  hairStyle: 'short',
  hairColor: 0,
  facialHair: 'beard',
  shirt: 1,
  pants: 2,
  glasses: true,
  headphones: false,
});

/** Fixed owner entry for demos; the state is the only thing that varies. */
export function demoOwner(
  state: AvatarState,
  busy: boolean,
  tool: Tool | null = 'claude',
  avatar: string | null = OWNER_AVATAR,
): SeatPresence {
  return {
    seatId: OWNER_SEAT_ID,
    label: OWNER_SEAT_LABEL,
    name: 'yasharjl',
    userKey: 'demo-owner',
    state,
    busy: state === 'working' && busy,
    tool: state === 'away' ? null : tool,
    avatar,
  };
}

const OWNER_CYCLE: Array<[AvatarState, boolean]> = [
  ['idle', false],
  ['working', true],
  ['working', false],
  ['away', false],
];

/**
 * About 80% of `seatIds` (desk seats) get a registered employee. The first few registered seats are
 * forced to cover every look (working/busy per tool, idle, away) so a screenshot shows them all.
 * Most employees get a random avatar code, the others the automatic look; the owner has a fixed code.
 */
export function demoSnapshot(seed: number, seatIds: readonly string[], withOwner = false): PresenceSnapshot {
  const rand = mulberry32(seed);
  const names = shuffle(rand, [...NAMES]);
  const registered = shuffle(rand, [...seatIds]).filter(() => rand() < 0.82);
  const forced: Array<[AvatarState, boolean, Tool | null]> = [
    ['working', true, 'claude'],
    ['working', false, 'cursor'],
    ['working', true, 'codex'],
    ['working', false, 'hermes'],
    ['idle', false, 'claude'],
    ['away', false, null],
  ];

  // avatars come from their own sequence so the seats and states stay as they were per seed
  const avatarRand = mulberry32(seed * 7919 + 13);
  const seats: SeatPresence[] = registered.map((seatId, i) => {
    const r = rand();
    const [state, busy, tool] =
      forced[i] ??
      ((r < 0.45
        ? ['working', rand() < 0.4, pick(rand, TOOL_ORDER)]
        : r < 0.75
          ? ['idle', false, rand() < 0.7 ? pick(rand, TOOL_ORDER) : null]
          : ['away', false, null]) as [AvatarState, boolean, Tool | null]);
    return {
      seatId,
      label: seatId.replace(/^desk-/, ''),
      name: names[i % names.length]!,
      userKey: `demo-${seed}-${i}`,
      state,
      busy,
      tool,
      // about two thirds designed their own avatar; the rest keep the automatic look
      avatar: avatarRand() < 0.65 ? encodeAvatar(randomAvatar(avatarRand)) : null,
    };
  });
  // the owner's sofa seat is added on top, without touching the desk random sequence
  if (withOwner) seats.push(demoOwner(...OWNER_CYCLE[Math.abs(seed) % OWNER_CYCLE.length]!));
  seats.sort((a, b) => a.seatId.localeCompare(b.seatId));
  return { seats, serverTime: new Date().toISOString() };
}
