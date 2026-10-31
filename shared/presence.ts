/**
 * Contract between the server and the web client. Type-only: no runtime code.
 *
 * Endpoints (served by `server/`, proxied by Vite in dev):
 *   GET /api/presence  → PresenceSnapshot (JSON)
 *   GET /api/stream    → Server-Sent Events; each `snapshot` event carries a full PresenceSnapshot
 *                        as JSON. Sent on every change and at least every 30 s.
 *   POST /api/events   ← ActivityEvent (from the reporter ping scripts)
 */

export type Tool = 'claude' | 'cursor' | 'codex' | 'hermes';
export const TOOLS: readonly Tool[] = ['claude', 'cursor', 'codex', 'hermes'];

/** prompt = user sent a prompt; tool = agent used a tool / edited; stop = agent turn ended; test = install check. */
export type ActivityKind = 'prompt' | 'tool' | 'stop' | 'test';
export const ACTIVITY_KINDS: readonly ActivityKind[] = ['prompt', 'tool', 'stop', 'test'];

export interface ActivityEvent {
  credential: string;
  tool: Tool;
  event: ActivityKind;
  /** Reporter script version, e.g. "1". */
  v?: string;
}

/**
 * working = AI activity within the last 5 minutes.
 * idle    = activity earlier today (Asia/Tehran calendar day).
 * away    = registered, no activity today: empty chair, name tag stays on the desk.
 * Seats with no registered employee are simply absent from the snapshot.
 */
export type AvatarState = 'working' | 'idle' | 'away';

export interface SeatPresence {
  /** Seat id from web/src/office/layout.ts, e.g. "desk-A1". */
  seatId: string;
  /** Human label, e.g. "A1". */
  label: string;
  /** Name tag text shown on the desk. */
  name: string;
  /** Opaque stable per-employee key; use it to derive a shirt colour. */
  userKey: string;
  state: AvatarState;
  /** True while an agent turn is in progress (prompt seen, no stop yet, < 2 min since last event). */
  busy: boolean;
  /** Most recent tool used today, or null. */
  tool: Tool | null;
}

export interface PresenceSnapshot {
  seats: SeatPresence[];
  /** ISO timestamp. */
  serverTime: string;
}
