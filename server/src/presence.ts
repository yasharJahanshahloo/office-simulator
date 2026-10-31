import crypto from 'node:crypto';
import type { ActivityKind, PresenceSnapshot, SeatPresence, Tool } from '../../shared/presence';
import type { Store, UserRow } from './db';
import { seatIdOf } from './seats';

/** One activity event keeps an avatar "working" this long. */
export const WORKING_WINDOW_MS = 5 * 60_000;
/** A turn with no stop event stops counting as busy after this long without events. */
export const BUSY_TIMEOUT_MS = 2 * 60_000;

export function tehranDay(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Tehran' });
}

function userKey(userId: string): string {
  return crypto.createHash('sha256').update(`office-presence:${userId}`).digest('hex').slice(0, 12);
}

interface Live {
  busy: boolean;
  lastEventMs: number;
}

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
    this.store.recordEvent(userId, tool, at);
    const prev = this.live.get(userId);
    const busy = kind === 'prompt' || kind === 'tool' ? true : kind === 'stop' ? false : (prev?.busy ?? false);
    this.live.set(userId, { busy, lastEventMs: at.getTime() });
    this.publish();
  }

  snapshot(): PresenceSnapshot {
    const now = this.now();
    const today = tehranDay(now);
    const seats: SeatPresence[] = this.store.seatedUsers().map((u) => this.seatOf(u, now, today));
    return { seats, serverTime: now.toISOString() };
  }

  private seatOf(u: UserRow, now: Date, today: string): SeatPresence {
    const last = u.last_event_at ? new Date(u.last_event_at) : null;
    const activeToday = last !== null && tehranDay(last) === today;
    const working = last !== null && now.getTime() - last.getTime() < WORKING_WINDOW_MS;
    const live = this.live.get(u.user_id);
    const busy = working && !!live?.busy && now.getTime() - live.lastEventMs < BUSY_TIMEOUT_MS;
    return {
      seatId: seatIdOf(u.seat_label!),
      label: u.seat_label!,
      name: u.name_tag,
      userKey: userKey(u.user_id),
      state: working ? 'working' : activeToday ? 'idle' : 'away',
      busy,
      tool: activeToday ? (u.last_tool as Tool | null) : null,
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
