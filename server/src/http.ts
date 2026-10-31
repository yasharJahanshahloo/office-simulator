import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { ACTIVITY_KINDS, TOOLS, type ActivityKind, type Tool } from '../../shared/presence';
import type { CredentialCodec } from './credential';
import type { Store } from './db';
import type { Presence } from './presence';

export interface HttpDeps {
  store: Store;
  codec: CredentialCodec;
  presence: Presence;
  webDist: string;
  /** Called on a reporter's install test ping. */
  onTestPing: (userId: string, tool: Tool) => void;
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

const MAX_EVENT_BYTES = 4096;

export function createHttpServer(d: HttpDeps): http.Server {
  return http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://x');
    try {
      if (url.pathname === '/api/events' && req.method === 'POST') return handleEvent(d, req, res);
      if (url.pathname === '/api/presence' && req.method === 'GET') return json(res, 200, d.presence.snapshot());
      if (url.pathname === '/api/stream' && req.method === 'GET') return handleStream(d, req, res);
      if (url.pathname === '/healthz') return json(res, 200, { ok: true });
      if (req.method === 'GET' || req.method === 'HEAD') return serveStatic(d.webDist, url.pathname, res);
      json(res, 404, { error: 'not found' });
    } catch (err) {
      console.error('[http]', err);
      if (!res.headersSent) json(res, 500, { error: 'internal' });
    }
  });
}

function json(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

function handleEvent(d: HttpDeps, req: http.IncomingMessage, res: http.ServerResponse): void {
  const chunks: Buffer[] = [];
  let size = 0;
  req.on('data', (c: Buffer) => {
    size += c.length;
    if (size > MAX_EVENT_BYTES) req.destroy();
    else chunks.push(c);
  });
  req.on('end', () => {
    let body: { credential?: unknown; tool?: unknown; event?: unknown; v?: unknown };
    try {
      body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch {
      return json(res, 400, { error: 'invalid json' });
    }
    const tool = body.tool as Tool;
    const kind = body.event as ActivityKind;
    const version = typeof body.v === 'string' ? body.v.slice(0, 8) : '?';
    if (!TOOLS.includes(tool) || !ACTIVITY_KINDS.includes(kind) || typeof body.credential !== 'string') {
      console.log(`[event] rejected 400: tool=${String(body.tool).slice(0, 12)} event=${String(body.event).slice(0, 12)}`);
      return json(res, 400, { error: 'invalid event' });
    }
    const cred = d.codec.decode(body.credential.trim());
    const user = cred ? d.store.getUser(cred.userId) : undefined;
    const why = !cred ? 'undecodable' : !user ? `unknown user ${cred.userId}` : user.cred_version !== cred.version
      ? `stale credential v${cred.version} (current v${user.cred_version}) for ${user.name_tag}`
      : d.store.isBanned(user.user_id) ? `banned ${user.user_id}` : null;
    if (why || !user) {
      console.log(`[event] rejected 401: ${why} (${tool} ${kind} r${version})`);
      return json(res, 401, { error: 'invalid credential' });
    }
    if (!user.seat_label) {
      console.log(`[event] rejected 409: ${user.name_tag} has no seat (${tool} ${kind} r${version})`);
      return json(res, 409, { error: 'no seat registered' });
    }

    console.log(`[event] ${user.seat_label} ${user.name_tag} ${tool} ${kind} r${version}`);
    d.store.setReporterVersion(user.user_id, version);
    if (kind === 'test') {
      // An install check proves the wiring, not AI use: it never changes the avatar.
      d.store.markConnected(user.user_id);
      d.onTestPing(user.user_id, tool);
    } else {
      d.presence.record(user.user_id, tool, kind);
    }
    json(res, 200, { ok: true, seat: user.seat_label });
  });
}

function handleStream(d: HttpDeps, req: http.IncomingMessage, res: http.ServerResponse): void {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-store',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write('retry: 5000\n\n');
  const send = (snap: unknown) => res.write(`event: snapshot\ndata: ${JSON.stringify(snap)}\n\n`);
  send(d.presence.snapshot());
  const unsubscribe = d.presence.subscribe(send);
  req.on('close', unsubscribe);
}

function serveStatic(root: string, pathname: string, res: http.ServerResponse): void {
  const safe = path.normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, '');
  let file = path.join(root, safe);
  if (!file.startsWith(root)) return json(res, 403, { error: 'forbidden' });
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(root, 'index.html');
  if (!fs.existsSync(file)) return json(res, 404, { error: 'web app not built' });
  const ext = path.extname(file);
  res.writeHead(200, {
    'Content-Type': MIME[ext] ?? 'application/octet-stream',
    'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
  });
  fs.createReadStream(file).pipe(res);
}
