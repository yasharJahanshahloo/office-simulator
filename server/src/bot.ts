import fs from 'node:fs';
import type { Tool } from '../../shared/presence';
import type { BaleApi, BaleCallbackQuery, BaleMessage, BaleUser, InlineKeyboard } from './bale';
import type { CredentialCodec } from './credential';
import type { Store, UserRow } from './db';
import { seatMapPng } from './seatMap';
import { DESK_LABELS, parseLabel } from './seats';
import { buildSetupZip } from './setupZip';

export interface BotDeps {
  api: BaleApi;
  store: Store;
  codec: CredentialCodec;
  adminIds: ReadonlySet<string>;
  allowlistFile: string;
  reporterDir: string;
  publicUrl: string;
  /** Called after a seat is freed or assigned, so the office view updates. */
  onSeatsChanged: () => void;
}

const AGENT_PROMPT = 'Read install.md in this folder and follow it.';

const TOOL_NAMES: Record<Tool, string> = {
  claude: 'Claude Code',
  cursor: 'Cursor',
  codex: 'Codex',
  hermes: 'Hermes',
};

const T = {
  greeting:
    'سلام! 👋\n' +
    'این بازوی «دفتر هوش مصنوعی» است: نمای سه‌بعدی دفتر که هر وقت با یک ایجنت هوش مصنوعی ' +
    '(Claude Code، Cursor، Codex یا Hermes) کار کنید، آواتار شما را پشت میزتان مشغول کار نشان می‌دهد.\n\n' +
    'برای شروع، دکمهٔ زیر را بزنید.',
  startButton: '🚀 شروع',
  mapCaption:
    'نقشهٔ میزها 👆\n' +
    'میزهای سبز آزادند و میزهای خاکستری قبلاً انتخاب شده‌اند.\n\n' +
    'برچسب میز خودتان را بفرستید (مثلاً A1).',
  badLabel: (input: string) =>
    `«${input}» برچسب هیچ میزی نیست. یکی از برچسب‌های روی نقشه را بفرستید (مثلاً A1).`,
  seatTaken: (label: string) => `میز ${label} قبلاً انتخاب شده است. لطفاً میز دیگری را انتخاب کنید.`,
  registered: (label: string, name: string) =>
    `✅ میز ${label} به نام شما ثبت شد.\nنام روی میز: ${name}\n\nفایل نصب را در پیام بعدی می‌فرستم.`,
  alreadyRegistered: (label: string) => `شما قبلاً در میز ${label} ثبت شده‌اید.`,
  zipCaption:
    '📦 فایل نصب شما\n\n' +
    '۱. فایل را از حالت فشرده خارج کنید.\n' +
    '۲. ایجنت هوش مصنوعی‌تان (Claude Code، Cursor، Codex یا Hermes) را در همان پوشه باز کنید.\n' +
    '۳. این دستور را به آن بدهید (با دکمهٔ «کپی دستور»):\n' +
    `${AGENT_PROMPT}\n\n` +
    'بعد از نصب، همین‌جا پیام «✅ وصل شد» را دریافت می‌کنید.\n' +
    '⚠️ این فایل کلید شخصی شماست؛ آن را با کسی به اشتراک نگذارید.',
  copyButton: '📋 کپی دستور',
  reissueButton: '🔄 صدور فایل جدید',
  reissued: '🔄 فایل جدید صادر شد. فایل‌های قبلی دیگر کار نمی‌کنند؛ این فایل را دوباره نصب کنید.',
  connected: (tool: Tool, label: string, officeUrl: string) =>
    `✅ وصل شد!\n${TOOL_NAMES[tool]} به دفتر وصل شد. از این به بعد وقتی با ایجنت کار کنید، ` +
    `آواتارتان پشت میز ${label} مشغول کار نشان داده می‌شود.\n\n` +
    `🏢 نمای دفتر: ${officeUrl}\n\n` +
    'اگر ایجنت همین الان باز است، یک بار ببندید و دوباره باز کنید تا تنظیمات جدید را بخواند.',
  noSeat: 'شما هنوز میزی ندارید. دکمهٔ «شروع» را بزنید تا میزتان را انتخاب کنید.',
  adminHelp:
    'راهنمای مدیر\n\n' +
    '/report — گزارش کاربران ثبت‌شده (+ فایل CSV)\n' +
    '/unregister A1 — آزاد کردن یک میز\n' +
    '/ban 123456 — مسدود کردن کاربر (میزش هم آزاد می‌شود)\n' +
    '/unban 123456 — رفع مسدودیت\n' +
    '/help — همین راهنما\n\n' +
    'فهرست کاربران مجاز: فایل data/allowlist.txt روی سرور (هر خط یک شناسهٔ بله).',
  adminNewRegistration: (name: string, id: string, label: string) => `🆕 ثبت‌نام: ${name} (${id}) ← میز ${label}`,
  adminUnregistered: (label: string, name: string) => `میز ${label} آزاد شد (قبلاً: ${name}).`,
  adminSeatEmpty: (label: string) => `میز ${label} از قبل خالی است.`,
  adminBadLabel: 'برچسب میز نامعتبر است. مثال: /unregister A1',
  adminBanned: (id: string, seat: string | null) => `کاربر ${id} مسدود شد.${seat ? ` میز ${seat} آزاد شد.` : ''}`,
  adminUnbanned: (id: string) => `مسدودیت کاربر ${id} برداشته شد.`,
  adminNotBanned: (id: string) => `کاربر ${id} مسدود نبود.`,
  adminBadId: 'شناسهٔ کاربر نامعتبر است. مثال: /ban 123456',
  adminEmptyReport: 'هنوز هیچ کاربری ثبت نشده است.',
};

export function nameTagFor(user: BaleUser): string {
  if (user.username) return user.username;
  const display = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
  return Array.from(display || String(user.id)).slice(0, 14).join('').trim();
}

export class Bot {
  private offset = 0;
  private running = false;
  private readonly lastConnectedNotice = new Map<string, number>();

  constructor(private readonly d: BotDeps) {}

  // ---------------------------------------------------------------- polling

  async run(): Promise<void> {
    this.running = true;
    while (this.running) {
      const started = Date.now();
      try {
        const updates = await this.d.api.getUpdates(this.offset, 25);
        for (const u of updates) {
          this.offset = Math.max(this.offset, u.update_id + 1);
          const kind = Object.keys(u).filter((k) => k !== 'update_id').join(',');
          const from = u.message?.from?.id ?? u.callback_query?.from.id;
          console.log(`[bot] update ${u.update_id}: ${kind} from ${from ?? '?'}`);
          if (process.env.BOT_DEBUG) console.log(JSON.stringify(u));
          try {
            if (u.message) await this.onMessage(u.message);
            else if (u.callback_query) await this.onCallback(u.callback_query);
          } catch (err) {
            console.error('[bot] handler error', err);
          }
        }
        // Guard against a server that answers long polls immediately.
        if (updates.length === 0 && Date.now() - started < 1000) await sleep(1000);
      } catch (err) {
        console.error('[bot] getUpdates failed:', (err as Error).message);
        await sleep(5000);
      }
    }
  }

  stop(): void {
    this.running = false;
  }

  // ---------------------------------------------------------------- access

  private isAdmin(id: string): boolean {
    return this.d.adminIds.has(id);
  }

  private isAllowed(id: string): boolean {
    if (this.isAdmin(id)) return true;
    try {
      return fs
        .readFileSync(this.d.allowlistFile, 'utf8')
        .split('\n')
        .map((l) => l.replace(/#.*/, '').trim())
        .includes(id);
    } catch {
      return false;
    }
  }

  /** Banned or not allowlisted → silently ignored. Returns the refreshed user row otherwise. */
  private admit(from: BaleUser | undefined, chatId: number): UserRow | null {
    if (!from || from.is_bot) return null;
    const id = String(from.id);
    if (this.d.store.isBanned(id) || !this.isAllowed(id)) {
      console.log(`[bot] ignored user ${id}${from.username ? ` (@${from.username})` : ''}: not allowed`);
      return null;
    }
    const displayName = [from.first_name, from.last_name].filter(Boolean).join(' ').trim();
    return this.d.store.upsertProfile({
      userId: id,
      chatId: String(chatId),
      username: from.username ?? null,
      displayName,
      nameTag: nameTagFor(from),
    });
  }

  // ---------------------------------------------------------------- handlers

  private async onMessage(msg: BaleMessage): Promise<unknown> {
    if (msg.chat.type !== 'private') return;
    const user = this.admit(msg.from, msg.chat.id);
    if (!user) return;
    const text = (msg.text ?? '').trim();
    const [command, ...args] = text.split(/\s+/);

    if (this.isAdmin(user.user_id) && command?.startsWith('/')) {
      const handled = await this.onAdminCommand(user, command.replace(/@.*/, '').toLowerCase(), args);
      if (handled) return;
    }

    if (command === '/start' || !text) return this.sendGreeting(user);
    if (text.startsWith('/')) return this.sendGreeting(user);

    if (!user.seat_label) return this.tryRegister(user, text);
    return this.sendGreeting(user);
  }

  private async onCallback(q: BaleCallbackQuery): Promise<unknown> {
    const chatId = q.message?.chat.id ?? q.from.id;
    const user = this.admit(q.from, chatId);
    await this.d.api.answerCallbackQuery(q.id).catch(() => undefined);
    if (!user) return;
    if (q.data === 'setup') {
      if (user.seat_label) return this.sendSetupZip(user);
      return this.sendSeatMap(user);
    }
    if (q.data === 'reissue') {
      if (!user.seat_label) return this.sendNoSeat(user);
      this.d.store.bumpCredentialVersion(user.user_id);
      await this.d.api.sendMessage(user.chat_id, T.reissued);
      return this.sendSetupZip(this.d.store.getUser(user.user_id)!);
    }
  }

  // ---------------------------------------------------------------- user flow

  private sendGreeting(user: UserRow): Promise<unknown> {
    const kb: InlineKeyboard = { inline_keyboard: [[{ text: T.startButton, callback_data: 'setup' }]] };
    return this.d.api.sendMessage(user.chat_id, T.greeting, kb);
  }

  private sendNoSeat(user: UserRow): Promise<unknown> {
    const kb: InlineKeyboard = { inline_keyboard: [[{ text: T.startButton, callback_data: 'setup' }]] };
    return this.d.api.sendMessage(user.chat_id, T.noSeat, kb);
  }

  private async sendSeatMap(user: UserRow): Promise<void> {
    const taken = new Set(this.d.store.seatedUsers().map((u) => u.seat_label!));
    await this.d.api.sendPhoto(user.chat_id, seatMapPng(taken), T.mapCaption);
  }

  private async tryRegister(user: UserRow, input: string): Promise<void> {
    const label = parseLabel(input);
    if (!label) {
      await this.d.api.sendMessage(user.chat_id, T.badLabel(input.slice(0, 20)));
      return;
    }
    if (!this.d.store.assignSeat(user.user_id, label)) {
      const fresh = this.d.store.getUser(user.user_id)!;
      if (fresh.seat_label) await this.d.api.sendMessage(user.chat_id, T.alreadyRegistered(fresh.seat_label));
      else await this.d.api.sendMessage(user.chat_id, T.seatTaken(label));
      return;
    }
    this.d.onSeatsChanged();
    await this.d.api.sendMessage(user.chat_id, T.registered(label, user.name_tag));
    await this.sendSetupZip(this.d.store.getUser(user.user_id)!);
    await this.notifyAdmins(T.adminNewRegistration(user.name_tag, user.user_id, label), user.user_id);
  }

  private async sendSetupZip(user: UserRow): Promise<void> {
    const credential = this.d.codec.encode({ userId: user.user_id, version: user.cred_version });
    const zip = buildSetupZip({ reporterDir: this.d.reporterDir, serverUrl: this.d.publicUrl, credential });
    const kb: InlineKeyboard = {
      inline_keyboard: [
        [{ text: T.copyButton, copy_text: { text: AGENT_PROMPT } }],
        [{ text: T.reissueButton, callback_data: 'reissue' }],
      ],
    };
    await this.d.api.sendDocument(
      user.chat_id,
      { data: zip, name: 'office-presence.zip', type: 'application/zip' },
      T.zipCaption,
      kb,
    );
  }

  /** Called by the event API when a reporter's install test ping arrives. */
  async notifyConnected(userId: string, tool: Tool): Promise<void> {
    const now = Date.now();
    const key = `${userId}:${tool}`;
    if (now - (this.lastConnectedNotice.get(key) ?? 0) < 30_000) return;
    this.lastConnectedNotice.set(key, now);
    const user = this.d.store.getUser(userId);
    if (!user?.seat_label) return;
    await this.d.api.sendMessage(user.chat_id, T.connected(tool, user.seat_label, this.d.publicUrl + '/')).catch((err) => {
      console.error('[bot] connected notice failed:', (err as Error).message);
    });
  }

  // ---------------------------------------------------------------- admin

  private async notifyAdmins(text: string, exceptUserId?: string): Promise<void> {
    for (const id of this.d.adminIds) {
      if (id === exceptUserId) continue;
      const admin = this.d.store.getUser(id);
      // Bale private chat id equals the user id; prefer the stored chat id when we have one.
      await this.d.api.sendMessage(admin?.chat_id ?? id, text).catch(() => undefined);
    }
  }

  /** Returns false when the command isn't an admin command (falls through to the user flow). */
  private async onAdminCommand(admin: UserRow, command: string, args: string[]): Promise<boolean> {
    const reply = (text: string) => this.d.api.sendMessage(admin.chat_id, text);
    switch (command) {
      case '/help':
        await reply(T.adminHelp);
        return true;
      case '/report':
        await this.sendReport(admin);
        return true;
      case '/unregister': {
        const label = parseLabel(args.join(' '));
        if (!label) {
          await reply(T.adminBadLabel);
          return true;
        }
        const user = this.d.store.unassignSeat(label);
        if (!user) {
          await reply(T.adminSeatEmpty(label));
          return true;
        }
        this.d.onSeatsChanged();
        await reply(T.adminUnregistered(label, user.name_tag));
        return true;
      }
      case '/ban':
      case '/unban': {
        const id = args[0]?.replace(/[^0-9]/g, '');
        if (!id) {
          await reply(T.adminBadId);
          return true;
        }
        if (command === '/ban') {
          const seat = this.d.store.ban(id);
          if (seat) this.d.onSeatsChanged();
          await reply(T.adminBanned(id, seat));
        } else {
          await reply(this.d.store.unban(id) ? T.adminUnbanned(id) : T.adminNotBanned(id));
        }
        return true;
      }
      default:
        return false;
    }
  }

  private async sendReport(admin: UserRow): Promise<void> {
    const users = this.d.store.seatedUsers();
    if (users.length === 0) {
      await this.d.api.sendMessage(admin.chat_id, T.adminEmptyReport);
      return;
    }
    const fmt = (iso: string | null) =>
      iso ? new Date(iso).toLocaleString('en-GB', { timeZone: 'Asia/Tehran', dateStyle: 'short', timeStyle: 'short' }) : '—';
    const lines = users.map(
      (u) =>
        `${u.seat_label} — ${u.name_tag} — ${u.user_id} — آخرین فعالیت: ${fmt(u.last_event_at)} — ${u.tools_seen || '—'}` +
        ` — نسخه r${u.reporter_v ?? '?'}${u.connected_at ? '' : ' — ⚠️ هنوز وصل نشده'}`,
    );
    const header = `گزارش کاربران (${users.length} از ${DESK_LABELS.length} میز)\n\n`;
    await this.d.api.sendMessage(admin.chat_id, header + lines.join('\n'));

    const csvCell = (v: string | null | number) => `"${String(v ?? '').replaceAll('"', '""')}"`;
    const csv = [
      ['seat', 'name_tag', 'user_id', 'username', 'display_name', 'registered_at', 'connected_at', 'last_event_at', 'tools_seen', 'reporter_v'],
      ...users.map((u) => [u.seat_label, u.name_tag, u.user_id, u.username, u.display_name, u.registered_at, u.connected_at, u.last_event_at, u.tools_seen, u.reporter_v]),
    ]
      .map((row) => row.map(csvCell).join(','))
      .join('\n');
    await this.d.api.sendDocument(admin.chat_id, {
      data: new TextEncoder().encode('﻿' + csv),
      name: `office-report-${new Date().toISOString().slice(0, 10)}.csv`,
      type: 'text/csv',
    });
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
