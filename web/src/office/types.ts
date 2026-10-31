/**
 * Plain data types describing the office. Nothing in here knows about Three.js.
 *
 * Coordinate system (meters, right-handed, Y up):
 *   +X = east  (right side of the reference image)
 *   +Z = south (bottom of the reference image)
 *   origin = centre of the interior floor, floor at y = 0.
 *
 * "facing" is a unit vector on the floor plane. For furniture it is the
 * direction a person using the item looks (a desk's facing points from the
 * chair towards the monitor). Mesh builders are authored looking down local +Z
 * and rotated with `yawFromFacing`.
 */

export interface Vec2 {
  x: number;
  z: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Axis-aligned rectangle on the floor plane. */
export interface Rect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export type SeatZone = 'desk' | 'meeting-small' | 'meeting-large' | 'lounge';

export interface Seat {
  /** Stable id, e.g. `desk-A1`, `meeting-large-3`, `lounge-stool-2`. */
  id: string;
  zone: SeatZone;
  /** Point on the floor under the centre of the seat (y = 0). */
  position: Vec3;
  /** Direction the seated person faces. */
  facing: Vec2;
  /** Furniture id of the workstation this seat belongs to (desk seats only). */
  deskId?: string;
}

export type FloorFinish = 'carpet' | 'carpet-meeting' | 'kitchen' | 'lounge-rug';

export interface Room {
  id: string;
  label: string;
  rect: Rect;
  floor: FloorFinish;
}

/** An opening along a wall, measured as distance from the wall's `from` point. */
export interface WallOpening {
  kind: 'window' | 'door';
  start: number;
  end: number;
  /** Window only: sill and head heights. */
  sill?: number;
  head?: number;
}

export interface Wall {
  id: string;
  from: Vec2;
  to: Vec2;
  height: number;
  thickness: number;
  openings: WallOpening[];
}

export interface GlassPartition {
  from: Vec2;
  to: Vec2;
  height: number;
}

export type PaletteKey =
  | 'white'
  | 'lightGrey'
  | 'midGrey'
  | 'darkGrey'
  | 'charcoal'
  | 'wood'
  | 'mustard'
  | 'green'
  | 'purple';

interface FurnitureBase {
  id?: string;
  at: Vec2;
  /** Defaults to { x: 0, z: 1 } (facing south). */
  facing?: Vec2;
}

/** Workstation: desk top + monitor + keyboard. Width runs across the user's view. */
export interface DeskItem extends FurnitureBase {
  kind: 'desk';
  id: string;
  width: number;
  depth: number;
}

export interface OfficeChairItem extends FurnitureBase {
  kind: 'office-chair';
}

export interface ShellChairItem extends FurnitureBase {
  kind: 'shell-chair';
  color: PaletteKey;
}

export interface RoundTableItem extends FurnitureBase {
  kind: 'round-table';
  radius: number;
  height: number;
}

export interface RectTableItem extends FurnitureBase {
  kind: 'rect-table';
  width: number;
  depth: number;
}

export interface ArmchairItem extends FurnitureBase {
  kind: 'armchair';
}

export interface StoolItem extends FurnitureBase {
  kind: 'stool';
}

export interface SofaItem extends FurnitureBase {
  kind: 'sofa';
  width: number;
  depth: number;
}

export interface PlantItem extends FurnitureBase {
  kind: 'plant';
  size: number;
}

export interface SlattedPartitionItem extends FurnitureBase {
  kind: 'slatted-partition';
  /** Length along local X. */
  length: number;
  height: number;
}

export interface TvItem extends FurnitureBase {
  kind: 'tv';
  width: number;
}

export interface CoffeeMachineItem extends FurnitureBase {
  kind: 'coffee-machine';
}

/** Generic box (cabinets, counters, ledges, frames, columns). `at` is the centre of the footprint. */
export interface BlockItem extends FurnitureBase {
  kind: 'block';
  size: Vec3;
  /** Height of the bottom face above the floor. */
  elevation?: number;
  color: PaletteKey;
  castShadow?: boolean;
}

/** Flat colored patch on the floor (stripes, rugs). */
export interface FloorPatchItem {
  kind: 'floor-patch';
  id?: string;
  rect: Rect;
  color: PaletteKey;
}

export type FurnitureItem =
  | DeskItem
  | OfficeChairItem
  | ShellChairItem
  | RoundTableItem
  | RectTableItem
  | ArmchairItem
  | StoolItem
  | SofaItem
  | PlantItem
  | SlattedPartitionItem
  | TvItem
  | CoffeeMachineItem
  | BlockItem
  | FloorPatchItem;

export interface OfficeLayout {
  /** Interior floor rectangle (inside faces of the outer walls). */
  bounds: Rect;
  rooms: Room[];
  walls: Wall[];
  glass: GlassPartition[];
  furniture: FurnitureItem[];
  seats: Seat[];
}
