import https from 'node:https';

/**
 * Minimal Bale bot API client. Bale is Telegram Bot API–compatible:
 * https://tapi.bale.ai/bot<token>/<method>.
 *
 * Every call opens its own connection (no keep-alive): a request reusing the socket of a
 * finished getUpdates long poll was observed to hang forever. Every call has a hard timeout.
 */

const CALL_TIMEOUT_MS = 30_000;

function post(url: string, body: Buffer, contentType: string, timeoutMs: number): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      { method: 'POST', agent: false, headers: { 'Content-Type': contentType, 'Content-Length': body.length } },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, text: Buffer.concat(chunks).toString('utf8') }));
        res.on('error', reject);
      },
    );
    req.setTimeout(timeoutMs, () => req.destroy(new Error(`timeout after ${timeoutMs} ms`)));
    req.on('error', reject);
    req.end(body);
  });
}

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

  private async send<T>(method: string, body: Buffer, contentType: string, timeoutMs = CALL_TIMEOUT_MS): Promise<T> {
    const res = await post(`${this.base}/${method}`, body, contentType, timeoutMs);
    let parsed: { ok?: boolean; result?: T; description?: string } = {};
    try {
      parsed = JSON.parse(res.text);
    } catch {
      /* non-JSON error page */
    }
    if (!parsed.ok) throw new Error(`bale ${method} failed: ${res.status} ${parsed.description ?? ''}`.trim());
    return parsed.result as T;
  }

  call<T>(method: string, params: Record<string, unknown> = {}, timeoutMs = CALL_TIMEOUT_MS): Promise<T> {
    return this.send<T>(method, Buffer.from(JSON.stringify(params)), 'application/json', timeoutMs);
  }

  private async upload<T>(method: string, field: string, file: { data: Uint8Array; name: string; type: string }, params: Record<string, unknown>): Promise<T> {
    const form = new FormData();
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined) continue;
      form.append(k, typeof v === 'string' || typeof v === 'number' ? String(v) : JSON.stringify(v));
    }
    form.append(field, new Blob([file.data], { type: file.type }), file.name);
    // Let the platform encode multipart (boundary included), then send it on a fresh connection.
    const encoded = new Response(form);
    const body = Buffer.from(await encoded.arrayBuffer());
    return this.send<T>(method, body, encoded.headers.get('content-type')!);
  }

  getUpdates(offset: number, timeoutSec: number): Promise<BaleUpdate[]> {
    return this.call<BaleUpdate[]>('getUpdates', { offset, timeout: timeoutSec }, (timeoutSec + 15) * 1000);
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
