import crypto from 'node:crypto';
import type { ActivityKind, PresenceSnapshot, SeatPresence, Tool } from '../../shared/presence';
import type { Store, UserRow } from './db';
import { seatIdOf } from './seats';

/** One activity event keeps an avatar "working" this long. */
export const WORKING_WINDOW_MS = 5 * 60_000;
/**
 * An open agent turn (prompt or tool seen, no stop yet) keeps the avatar working and busy for
 * this long after its last event, so a long-running tool call doesn't drop to idle. Tools don't
 * always send a stop (e.g. Claude Code on Ctrl-C), hence the cap.
 */
export const OPEN_TURN_MS = 10 * 60_000;

export function tehranDay(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Tehran' });
}

function userKey(userId: string): string {
  return crypto.createHash('sha256').update(`office-presence:${userId}`).digest('hex').slice(0, 12);
}

interface Live {
  busy: boolean;
  lastEventMs: number;
  lastTool: Tool;
  /** When last_event_at was last written to the store. */
  persistedMs: number;
}

/** Activity is persisted at most this often per user (the dev server's disk is slow). */
const PERSIST_INTERVAL_MS = 30_000;

/**
 * Turns activity events into avatar states and pushes snapshots to subscribers.
 * Durable facts (last event time, last tool) live in the Store; turn state ("busy") is in memory.
 */
export class Presence {
  private readonly live = new Map<string, Live>();
  private readonly listeners = new Set<(s: PresenceSnapshot) => void>();
  private lastJson = '';

  constructor(
    private readonly store: Store,
    private readonly now: () => Date = () => new Date(),
  ) {}

  record(userId: string, tool: Tool, kind: ActivityKind): void {
    const at = this.now();
    const ms = at.getTime();
    const prev = this.live.get(userId);
    const persist = !prev || prev.lastTool !== tool || ms - prev.persistedMs >= PERSIST_INTERVAL_MS;
    if (persist) this.store.recordEvent(userId, tool, at);
    const busy = kind === 'prompt' || kind === 'tool' ? true : kind === 'stop' ? false : (prev?.busy ?? false);
    this.live.set(userId, { busy, lastEventMs: ms, lastTool: tool, persistedMs: persist ? ms : prev!.persistedMs });
    this.publish();
  }

  snapshot(): PresenceSnapshot {
    const now = this.now();
    const today = tehranDay(now);
    const seats: SeatPresence[] = this.store.seatedUsers().map((u) => this.seatOf(u, now, today));
    return { seats, serverTime: now.toISOString() };
  }

  private seatOf(u: UserRow, now: Date, today: string): SeatPresence {
    const live = this.live.get(u.user_id);
    const last = live ? new Date(live.lastEventMs) : u.last_event_at ? new Date(u.last_event_at) : null;
    const tool = (live?.lastTool ?? u.last_tool) as Tool | null;
    const activeToday = last !== null && tehranDay(last) === today;
    const busy = !!live?.busy && now.getTime() - live.lastEventMs < OPEN_TURN_MS;
    const working = busy || (last !== null && now.getTime() - last.getTime() < WORKING_WINDOW_MS);
    return {
      seatId: seatIdOf(u.seat_label!),
      label: u.seat_label!,
      name: u.name_tag,
      userKey: userKey(u.user_id),
      state: working ? 'working' : activeToday ? 'idle' : 'away',
      busy,
      tool: activeToday ? tool : null,
      avatar: u.avatar ?? null,
    };
  }

  subscribe(fn: (s: PresenceSnapshot) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Broadcast if anything visible changed (or always, when forced). */
  publish(force = false): void {
    const snap = this.snapshot();
    const json = JSON.stringify(snap.seats);
    if (!force && json === this.lastJson) return;
    this.lastJson = json;
    for (const fn of this.listeners) fn(snap);
  }
}
