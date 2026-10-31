/**
 * Minimal Bale bot API client. Bale is Telegram Bot API–compatible:
 * https://tapi.bale.ai/bot<token>/<method>.
 */

export interface BaleUser {
  id: number;
  is_bot?: boolean;
  first_name?: string;
  last_name?: string;
  username?: string;
}

export interface BaleMessage {
  message_id: number;
  from?: BaleUser;
  chat: { id: number; type: string };
  text?: string;
}

export interface BaleCallbackQuery {
  id: string;
  from: BaleUser;
  message?: BaleMessage;
  data?: string;
}

export interface BaleUpdate {
  update_id: number;
  message?: BaleMessage;
  callback_query?: BaleCallbackQuery;
}

export interface InlineButton {
  text: string;
  callback_data?: string;
  copy_text?: { text: string };
  url?: string;
}

export type InlineKeyboard = { inline_keyboard: InlineButton[][] };

export class BaleApi {
  private readonly base: string;

  constructor(apiBase: string, token: string) {
    this.base = `${apiBase}/bot${token}`;
  }

  private async parse<T>(method: string, res: Response): Promise<T> {
    const body = (await res.json().catch(() => ({}))) as { ok?: boolean; result?: T; description?: string };
    if (!body.ok) throw new Error(`bale ${method} failed: ${res.status} ${body.description ?? ''}`.trim());
    return body.result as T;
  }

  async call<T>(method: string, params: Record<string, unknown> = {}, signal?: AbortSignal): Promise<T> {
    const res = await fetch(`${this.base}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
      signal,
    });
    return this.parse<T>(method, res);
  }

  private async upload<T>(method: string, field: string, file: { data: Uint8Array; name: string; type: string }, params: Record<string, unknown>): Promise<T> {
    const form = new FormData();
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined) continue;
      form.append(k, typeof v === 'string' || typeof v === 'number' ? String(v) : JSON.stringify(v));
    }
    form.append(field, new Blob([file.data], { type: file.type }), file.name);
    const res = await fetch(`${this.base}/${method}`, { method: 'POST', body: form });
    return this.parse<T>(method, res);
  }

  getUpdates(offset: number, timeoutSec: number, signal?: AbortSignal): Promise<BaleUpdate[]> {
    return this.call<BaleUpdate[]>('getUpdates', { offset, timeout: timeoutSec }, signal);
  }

  sendMessage(chatId: number | string, text: string, replyMarkup?: InlineKeyboard): Promise<BaleMessage> {
    return this.call('sendMessage', { chat_id: chatId, text, reply_markup: replyMarkup });
  }

  sendPhoto(chatId: number | string, png: Uint8Array, caption?: string): Promise<BaleMessage> {
    return this.upload('sendPhoto', 'photo', { data: png, name: 'seats.png', type: 'image/png' }, { chat_id: chatId, caption });
  }

  sendDocument(
    chatId: number | string,
    file: { data: Uint8Array; name: string; type: string },
    caption?: string,
    replyMarkup?: InlineKeyboard,
  ): Promise<BaleMessage> {
    return this.upload('sendDocument', 'document', file, { chat_id: chatId, caption, reply_markup: replyMarkup });
  }

  answerCallbackQuery(id: string, text?: string): Promise<boolean> {
    return this.call('answerCallbackQuery', { callback_query_id: id, text });
  }
}
