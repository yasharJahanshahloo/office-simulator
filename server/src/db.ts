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
  /** Comma-separated set of tools ever seen. */
  tools_seen: string;
}

export class Store {
  private readonly db: DatabaseSync;

  constructor(file: string) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    this.db = new DatabaseSync(file);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
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
      CREATE TABLE IF NOT EXISTS bans (
        user_id   TEXT PRIMARY KEY,
        banned_at TEXT NOT NULL
      );
    `);
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
