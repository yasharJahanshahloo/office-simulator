/**
 * The office floor plan as data. Rendering lives in ./buildOffice.ts.
 *
 * Measured off the top-down reference render at roughly 56 px per meter, with
 * the interior floor spanning 18.4 m x 8.5 m. See ./types.ts for the coordinate
 * system (+X east, +Z south, origin at the floor centre).
 *
 * Seat id scheme
 *   desk-<cluster><n>   cluster A..E, n numbered row by row from north to
 *                       south, west seat first (odd = west side, even = east).
 *                         A = top-left cluster   (2 x 3)   B = top-right (2 x 3)
 *                         C = bottom-left (2 x 2) D = bottom-middle   E = bottom-right
 *   meeting-small-<n>   1..6, counter-clockwise on screen starting east of the round table
 *   meeting-large-<n>   1..8, north side W->E, south side W->E, then west end, east end
 *   lounge-stool-<n>, lounge-armchair-<n>, lounge-sofa-<n>
 */
import type {
  DeskItem,
  FurnitureItem,
  GlassPartition,
  OfficeLayout,
  Rect,
  Room,
  Seat,
  SeatZone,
  Vec2,
  Wall,
} from './types';

export const DESK_WIDTH = 1.4;
export const DESK_DEPTH = 0.8;
/** Distance from the desk edge to the centre of the chair. */
const CHAIR_SETBACK = 0.5;

const HALF_W = 9.2;
const HALF_D = 4.25;
const WALL_T = 0.25;
const WALL_H = 2.7;
/** The south wall is cut down so the default camera can see in. */
const SOUTH_WALL_H = 1.0;

const bounds: Rect = { minX: -HALF_W, maxX: HALF_W, minZ: -HALF_D, maxZ: HALF_D };

const N: Vec2 = { x: 0, z: -1 };
const S: Vec2 = { x: 0, z: 1 };
const E: Vec2 = { x: 1, z: 0 };
const W: Vec2 = { x: -1, z: 0 };

function normalize(v: Vec2): Vec2 {
  const len = Math.hypot(v.x, v.z) || 1;
  return { x: v.x / len, z: v.z / len };
}

function toward(from: Vec2, to: Vec2): Vec2 {
  return normalize({ x: to.x - from.x, z: to.z - from.z });
}

function seat(id: string, zone: SeatZone, at: Vec2, facing: Vec2, deskId?: string): Seat {
  return { id, zone, position: { x: at.x, y: 0, z: at.z }, facing, ...(deskId ? { deskId } : {}) };
}

/* ------------------------------------------------------------------ rooms */

const rooms: Room[] = [
  { id: 'open-plan', label: 'Open plan', rect: bounds, floor: 'carpet' },
  {
    id: 'meeting-small',
    label: 'Small meeting room',
    rect: { minX: -HALF_W, maxX: -4.9, minZ: -HALF_D, maxZ: -1.05 },
    floor: 'carpet-meeting',
  },
  {
    id: 'meeting-large',
    label: 'Large meeting room',
    rect: { minX: -4.9, maxX: 0, minZ: -HALF_D, maxZ: -1.05 },
    floor: 'carpet-meeting',
  },
  {
    id: 'kitchen',
    label: 'Kitchenette',
    rect: { minX: -HALF_W, maxX: -6.26, minZ: 1.05, maxZ: HALF_D },
    floor: 'kitchen',
  },
  {
    id: 'lounge',
    label: 'Lounge',
    rect: { minX: -6.15, maxX: -4.6, minZ: 1.3, maxZ: 4.1 },
    floor: 'lounge-rug',
  },
];

/* ------------------------------------------------------------------ walls */

const walls: Wall[] = [
  {
    id: 'north',
    from: { x: -HALF_W - WALL_T, z: -HALF_D - WALL_T / 2 },
    to: { x: HALF_W + WALL_T, z: -HALF_D - WALL_T / 2 },
    height: WALL_H,
    thickness: WALL_T,
    // Light-coloured gap in the top wall of the reference: assumed main entrance.
    openings: [{ kind: 'door', start: 9.5, end: 10.8 }],
  },
  {
    id: 'south',
    from: { x: -HALF_W - WALL_T, z: HALF_D + WALL_T / 2 },
    to: { x: HALF_W + WALL_T, z: HALF_D + WALL_T / 2 },
    height: SOUTH_WALL_H,
    thickness: WALL_T,
    openings: [],
  },
  {
    id: 'west',
    from: { x: -HALF_W - WALL_T / 2, z: -HALF_D },
    to: { x: -HALF_W - WALL_T / 2, z: HALF_D },
    height: WALL_H,
    thickness: WALL_T,
    openings: [{ kind: 'window', start: 3.2, end: 5.3, sill: 0.5, head: 2.4 }],
  },
  {
    id: 'east',
    from: { x: HALF_W + WALL_T / 2, z: -HALF_D },
    to: { x: HALF_W + WALL_T / 2, z: HALF_D },
    height: WALL_H,
    thickness: WALL_T,
    openings: [{ kind: 'window', start: 1.85, end: 7.35, sill: 0.5, head: 2.4 }],
  },
];

/* ------------------------------------------------------------------ glass */

const GLASS_H = 2.6;
const glass: GlassPartition[] = [
  // between the two meeting rooms
  { from: { x: -4.9, z: -HALF_D }, to: { x: -4.9, z: -1.05 }, height: GLASS_H },
  // small meeting room front (door gap at x -5.8..-4.9)
  { from: { x: -HALF_W, z: -1.05 }, to: { x: -5.8, z: -1.05 }, height: GLASS_H },
  // large meeting room front (door gap at x -0.9..0)
  { from: { x: -4.9, z: -1.05 }, to: { x: -0.9, z: -1.05 }, height: GLASS_H },
  // large meeting room east side
  { from: { x: 0, z: -HALF_D }, to: { x: 0, z: -1.05 }, height: GLASS_H },
  // kitchenette north side (door gap at x -7.5..-6.6)
  { from: { x: -HALF_W, z: 1.05 }, to: { x: -7.5, z: 1.05 }, height: GLASS_H },
];

/* -------------------------------------------------------------- furniture */

const furniture: FurnitureItem[] = [];
const seats: Seat[] = [];

/**
 * A cluster of back-to-back desks: two columns (west column faces east, east
 * column faces west), `rows` desks deep along Z.
 */
function deskCluster(letter: string, center: Vec2, rows: number): void {
  for (let r = 0; r < rows; r++) {
    const z = center.z + (r - (rows - 1) / 2) * DESK_WIDTH;
    const columns: Array<{ side: 'west' | 'east'; facing: Vec2; sign: number }> = [
      { side: 'west', facing: E, sign: -1 },
      { side: 'east', facing: W, sign: 1 },
    ];
    columns.forEach((col, c) => {
      const n = r * 2 + c + 1;
      const deskId = `workstation-${letter}${n}`;
      const desk: DeskItem = {
        kind: 'desk',
        id: deskId,
        at: { x: center.x + col.sign * (DESK_DEPTH / 2), z },
        facing: col.facing,
        width: DESK_WIDTH,
        depth: DESK_DEPTH,
      };
      const chairAt = { x: center.x + col.sign * (DESK_DEPTH + CHAIR_SETBACK), z };
      furniture.push(desk, { kind: 'office-chair', at: chairAt, facing: col.facing });
      seats.push(seat(`desk-${letter}${n}`, 'desk', chairAt, col.facing, deskId));
    });
  }
}

deskCluster('A', { x: 2.18, z: -1.92 }, 3);
deskCluster('B', { x: 5.6, z: -1.92 }, 3);
deskCluster('C', { x: -2.0, z: 2.67 }, 2);
deskCluster('D', { x: 1.82, z: 2.67 }, 2);
deskCluster('E', { x: 5.6, z: 2.67 }, 2);

// Small meeting room: round table, 6 grey shell chairs.
{
  const c = { x: -7.4, z: -2.7 };
  furniture.push({ kind: 'round-table', at: c, radius: 0.75, height: 0.74 });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const at = { x: c.x + Math.cos(a) * 1.2, z: c.z - Math.sin(a) * 1.2 };
    const facing = toward(at, c);
    furniture.push({ kind: 'shell-chair', at, facing, color: 'midGrey' });
    seats.push(seat(`meeting-small-${i + 1}`, 'meeting-small', at, facing));
  }
  furniture.push({ kind: 'tv', at: { x: -7.4, z: -HALF_D }, facing: S, width: 1.4 });
  // mustard accent wall
  furniture.push({
    kind: 'block',
    at: { x: -HALF_W + 0.03, z: (-HALF_D - 1.05) / 2 },
    size: { x: 0.06, y: WALL_H, z: HALF_D - 1.05 },
    color: 'mustard',
    castShadow: false,
  });
}

// Large meeting room: long table, 8 mustard shell chairs.
{
  const c = { x: -2.55, z: -2.75 };
  furniture.push({ kind: 'rect-table', at: c, facing: S, width: 3.0, depth: 1.3 });
  const placements: Array<[Vec2, Vec2]> = [];
  for (const dx of [-0.95, 0, 0.95]) placements.push([{ x: c.x + dx, z: c.z - 1.1 }, S]);
  for (const dx of [-0.95, 0, 0.95]) placements.push([{ x: c.x + dx, z: c.z + 1.1 }, N]);
  placements.push([{ x: c.x - 1.95, z: c.z }, E]);
  placements.push([{ x: c.x + 1.95, z: c.z }, W]);
  placements.forEach(([at, facing], i) => {
    furniture.push({ kind: 'shell-chair', at, facing, color: 'mustard' });
    seats.push(seat(`meeting-large-${i + 1}`, 'meeting-large', at, facing));
  });
  furniture.push({ kind: 'tv', at: { x: c.x, z: -HALF_D }, facing: S, width: 1.4 });
}

// Kitchenette along the west wall.
furniture.push(
  {
    kind: 'block',
    at: { x: -8.875, z: 2.65 },
    size: { x: 0.65, y: 0.9, z: 3.0 },
    color: 'lightGrey',
  },
  {
    kind: 'block',
    at: { x: -8.875, z: 2.65 },
    elevation: 0.9,
    size: { x: 0.67, y: 0.04, z: 3.02 },
    color: 'wood',
  },
  // tall wooden shelving unit
  {
    kind: 'block',
    at: { x: -8.95, z: 3.0 },
    size: { x: 0.5, y: 2.1, z: 1.4 },
    color: 'wood',
  },
  { kind: 'coffee-machine', at: { x: -8.9, z: 1.5 }, facing: E },
);

// Bar ledge, stools and the green slatted partition.
furniture.push(
  {
    kind: 'block',
    at: { x: -6.38, z: 2.7 },
    size: { x: 0.26, y: 0.05, z: 2.8 },
    elevation: 1.0,
    color: 'wood',
  },
  {
    kind: 'slatted-partition',
    at: { x: -6.2, z: 2.75 },
    facing: E,
    length: 3.0,
    height: 1.8,
  },
  // white shelf capping the lounge to the north
  {
    kind: 'block',
    at: { x: -5.58, z: 1.1 },
    size: { x: 2.05, y: 1.05, z: 0.3 },
    color: 'white',
  },
);
[1.95, 2.75, 3.6].forEach((z, i) => {
  const at = { x: -6.85, z };
  furniture.push({ kind: 'stool', at, facing: E });
  seats.push(seat(`lounge-stool-${i + 1}`, 'lounge', at, E));
});

// Lounge: low dark bench along the partition, two armchairs, small round table.
{
  const table = { x: -5.2, z: 2.62 };
  furniture.push(
    {
      kind: 'block',
      at: { x: -5.98, z: 2.7 },
      size: { x: 0.3, y: 0.75, z: 2.8 },
      color: 'charcoal',
    },
    { kind: 'round-table', at: table, radius: 0.3, height: 0.5 },
  );
  [1.72, 3.52].forEach((z, i) => {
    const at = { x: -5.15, z };
    const facing = toward(at, { x: table.x + 0.8, z: table.z });
    furniture.push({ kind: 'armchair', at, facing });
    seats.push(seat(`lounge-armchair-${i + 1}`, 'lounge', at, facing));
  });
}

// East wall: storage cabinets either side of a yellow sofa booth with a green frame.
{
  const cabX = HALF_W - 0.375;
  furniture.push(
    {
      kind: 'block',
      at: { x: cabX, z: (-HALF_D - 0.95) / 2 },
      size: { x: 0.75, y: 1.1, z: HALF_D - 0.95 },
      color: 'lightGrey',
    },
    {
      kind: 'block',
      at: { x: cabX, z: (1.6 + HALF_D) / 2 },
      size: { x: 0.75, y: 1.1, z: HALF_D - 1.6 },
      color: 'lightGrey',
    },
    { kind: 'sofa', at: { x: cabX, z: 0.32 }, facing: W, width: 2.45, depth: 0.75 },
  );
  [-0.3, 0.95].forEach((z, i) => {
    seats.push(seat(`lounge-sofa-${i + 1}`, 'lounge', { x: cabX - 0.1, z }, W));
  });
  // green frame: two fins and a header beam along the window
  for (const z of [-2.45, 3.15]) {
    furniture.push({
      kind: 'block',
      at: { x: cabX, z },
      size: { x: 0.8, y: 2.3, z: 0.06 },
      color: 'green',
    });
  }
  furniture.push({
    kind: 'block',
    at: { x: HALF_W - 0.1, z: (-2.45 + 3.15) / 2 },
    elevation: 2.24,
    size: { x: 0.12, y: 0.06, z: 5.6 },
    color: 'green',
  });
}

// Column bumping out of the south wall.
furniture.push({
  kind: 'block',
  at: { x: -0.5, z: HALF_D - 0.175 },
  size: { x: 1.6, y: SOUTH_WALL_H, z: 0.35 },
  color: 'charcoal',
});

// Floor accents at the south end of the lounge.
furniture.push(
  { kind: 'floor-patch', rect: { minX: -7.3, maxX: -6.5, minZ: 4.05, maxZ: HALF_D }, color: 'purple' },
  { kind: 'floor-patch', rect: { minX: -6.5, maxX: -5.0, minZ: 4.05, maxZ: HALF_D }, color: 'green' },
);

// Potted plants.
const plants: Array<[number, number, number]> = [
  [-5.75, -3.95, 0.9],
  [0.5, -3.85, 0.9],
  [3.9, -3.95, 0.9],
  [7.9, -3.85, 0.9],
  [-4.3, 3.85, 0.8],
  [-0.2, 3.6, 0.8],
  [3.75, 3.9, 0.8],
  [7.9, 3.85, 0.9],
  [-6.75, 1.35, 0.5],
];
for (const [x, z, size] of plants) furniture.push({ kind: 'plant', at: { x, z }, size });

export const OFFICE_LAYOUT: OfficeLayout = { bounds, rooms, walls, glass, furniture, seats };

export function getSeat(id: string): Seat | undefined {
  return seats.find((s) => s.id === id);
}

export function seatsInZone(zone: SeatZone): Seat[] {
  return seats.filter((s) => s.zone === zone);
}
