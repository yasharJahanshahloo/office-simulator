import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export interface UserRow {
  user_id: string;
  chat_id: string;
  username: string | null;
  display_name: string;
  name_tag: string;
  seat_label: string | null;
  registered_at: string | null;
  cred_version: number;
  connected_at: string | null;
  last_event_at: string | null;
  last_tool: string | null;
  /** Comma-separated set of tools ever seen (real activity only). */
  tools_seen: string;
  /** Reporter script version from the latest event, e.g. "2". */
  reporter_v: string | null;
}

export class Store {
  private readonly db: DatabaseSync;

  constructor(file: string) {
    if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
    this.db = new DatabaseSync(file);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      -- The dev server's disk syncs at ~10 KB/s; with WAL, NORMAL only syncs at checkpoints and stays crash-safe.
      PRAGMA synchronous = NORMAL;
      CREATE TABLE IF NOT EXISTS users (
        user_id       TEXT PRIMARY KEY,
        chat_id       TEXT NOT NULL,
        username      TEXT,
        display_name  TEXT NOT NULL DEFAULT '',
        name_tag      TEXT NOT NULL DEFAULT '',
        seat_label    TEXT UNIQUE,
        registered_at TEXT,
        cred_version  INTEGER NOT NULL DEFAULT 1,
        connected_at  TEXT,
        last_event_at TEXT,
        last_tool     TEXT,
        tools_seen    TEXT NOT NULL DEFAULT ''
      );
      CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS bans (
        user_id   TEXT PRIMARY KEY,
        banned_at TEXT NOT NULL
      );
    `);
    this.migrate();
  }

  private migrate(): void {
    const cols = (this.db.prepare('PRAGMA table_info(users)').all() as { name: string }[]).map((c) => c.name);
    if (!cols.includes('reporter_v')) this.db.exec('ALTER TABLE users ADD COLUMN reporter_v TEXT');
    const done = (key: string) => this.db.prepare('SELECT 1 FROM meta WHERE key = ?').get(key) !== undefined;
    if (!done('purge-test-activity')) {
      // Before 2026-10-31 evening, install test pings were recorded as AI activity. Drop that.
      this.db.exec(`
        UPDATE users SET tools_seen = '';
        UPDATE users SET last_event_at = NULL, last_tool = NULL
          WHERE connected_at IS NOT NULL AND last_event_at IS NOT NULL
            AND julianday(last_event_at) - julianday(connected_at) < 3.0 / 1440;
        INSERT INTO meta (key, value) VALUES ('purge-test-activity', datetime('now'));
      `);
    }
  }

  setReporterVersion(userId: string, version: string): void {
    this.db.prepare('UPDATE users SET reporter_v = ? WHERE user_id = ? AND reporter_v IS NOT ?').run(version, userId, version);
  }

  getUser(userId: string): UserRow | undefined {
    return this.db.prepare('SELECT * FROM users WHERE user_id = ?').get(userId) as UserRow | undefined;
  }

  userAtSeat(label: string): UserRow | undefined {
    return this.db.prepare('SELECT * FROM users WHERE seat_label = ?').get(label) as UserRow | undefined;
  }

  seatedUsers(): UserRow[] {
    return this.db
      .prepare('SELECT * FROM users WHERE seat_label IS NOT NULL ORDER BY seat_label')
      .all() as unknown as UserRow[];
  }

  /** Create or refresh the Bale profile fields of a user. Never touches seat or credential. */
  upsertProfile(p: { userId: string; chatId: string; username: string | null; displayName: string; nameTag: string }): UserRow {
    this.db
      .prepare(
        `INSERT INTO users (user_id, chat_id, username, display_name, name_tag)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(user_id) DO UPDATE SET
           chat_id = excluded.chat_id, username = excluded.username,
           display_name = excluded.display_name, name_tag = excluded.name_tag`,
      )
      .run(p.userId, p.chatId, p.username, p.displayName, p.nameTag);
    return this.getUser(p.userId)!;
  }

  /** Returns false if the seat is already taken. */
  assignSeat(userId: string, label: string): boolean {
    try {
      const res = this.db
        .prepare('UPDATE users SET seat_label = ?, registered_at = ? WHERE user_id = ? AND seat_label IS NULL')
        .run(label, new Date().toISOString(), userId);
      return res.changes === 1;
    } catch (err) {
      if (String(err).includes('UNIQUE')) return false;
      throw err;
    }
  }

  /** Admin move: put the user on `label`, leaving any previous seat. False if someone else holds it. */
  moveToSeat(userId: string, label: string): boolean {
    const holder = this.userAtSeat(label);
    if (holder && holder.user_id !== userId) return false;
    this.db
      .prepare('UPDATE users SET seat_label = ?, registered_at = COALESCE(registered_at, ?) WHERE user_id = ?')
      .run(label, new Date().toISOString(), userId);
    return true;
  }

  /** Returns the user that was unseated, if any. */
  unassignSeat(label: string): UserRow | undefined {
    const user = this.userAtSeat(label);
    if (user) this.db.prepare('UPDATE users SET seat_label = NULL WHERE user_id = ?').run(user.user_id);
    return user;
  }

  bumpCredentialVersion(userId: string): number {
    this.db.prepare('UPDATE users SET cred_version = cred_version + 1 WHERE user_id = ?').run(userId);
    return this.getUser(userId)!.cred_version;
  }

  recordEvent(userId: string, tool: string, at: Date): void {
    const user = this.getUser(userId);
    if (!user) return;
    const seen = new Set(user.tools_seen.split(',').filter(Boolean));
    seen.add(tool);
    this.db
      .prepare('UPDATE users SET last_event_at = ?, last_tool = ?, tools_seen = ? WHERE user_id = ?')
      .run(at.toISOString(), tool, [...seen].sort().join(','), userId);
  }

  markConnected(userId: string): void {
    this.db
      .prepare('UPDATE users SET connected_at = COALESCE(connected_at, ?) WHERE user_id = ?')
      .run(new Date().toISOString(), userId);
  }

  isBanned(userId: string): boolean {
    return this.db.prepare('SELECT 1 FROM bans WHERE user_id = ?').get(userId) !== undefined;
  }

  /** Ban and free the user's seat. Returns the freed seat label, if any. */
  ban(userId: string): string | null {
    this.db
      .prepare('INSERT OR IGNORE INTO bans (user_id, banned_at) VALUES (?, ?)')
      .run(userId, new Date().toISOString());
    const user = this.getUser(userId);
    if (user?.seat_label) {
      this.db.prepare('UPDATE users SET seat_label = NULL WHERE user_id = ?').run(userId);
      return user.seat_label;
    }
    return null;
  }

  unban(userId: string): boolean {
    return this.db.prepare('DELETE FROM bans WHERE user_id = ?').run(userId).changes === 1;
  }
}
