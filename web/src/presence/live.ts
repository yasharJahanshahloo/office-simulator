/**
 * Live presence: GET /api/presence once, then follow the SSE stream at /api/stream.
 * EventSource reconnects on its own; if the server answers a reconnect with an
 * error status the browser gives up (readyState CLOSED), so we reopen it ourselves.
 * The server sends a snapshot at least every 30 s; a stream silent for longer than
 * STALE_MS counts as dead (a proxy can keep a stream open after the server is gone).
 */
import type { PresenceSnapshot } from './contract';

export type ConnectionStatus = 'connecting' | 'online' | 'offline';

export interface LiveOptions {
  onSnapshot: (snapshot: PresenceSnapshot) => void;
  onStatus: (status: ConnectionStatus) => void;
  base?: string;
}

const RETRY_MS = 5000;
const STALE_MS = 45_000;

function parseSnapshot(raw: unknown): PresenceSnapshot | null {
  if (!raw || typeof raw !== 'object') return null;
  const s = raw as Partial<PresenceSnapshot>;
  if (!Array.isArray(s.seats) || typeof s.serverTime !== 'string') return null;
  return s as PresenceSnapshot;
}

export function connectLive({ onSnapshot, onStatus, base = '/api' }: LiveOptions): () => void {
  let latest = '';
  let source: EventSource | undefined;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let watchdog: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;

  // The fetch and the stream race; never let an older snapshot overwrite a newer one.
  const accept = (raw: unknown) => {
    const snap = parseSnapshot(raw);
    if (!snap) {
      console.warn('presence: malformed snapshot ignored', raw);
      return;
    }
    if (snap.serverTime < latest) return;
    latest = snap.serverTime;
    onSnapshot(snap);
  };

  const reopen = () => {
    source?.close();
    clearTimeout(retry);
    retry = setTimeout(open, RETRY_MS);
  };

  const feedWatchdog = () => {
    clearTimeout(watchdog);
    watchdog = setTimeout(() => {
      console.warn('presence: stream silent, reconnecting');
      onStatus('offline');
      reopen();
      feedWatchdog();
    }, STALE_MS);
  };

  const open = () => {
    if (stopped) return;
    source = new EventSource(`${base}/stream`);
    source.onopen = () => {
      onStatus('online');
      feedWatchdog();
    };
    source.addEventListener('snapshot', (e) => {
      feedWatchdog();
      try {
        accept(JSON.parse((e as MessageEvent<string>).data));
      } catch (err) {
        console.warn('presence: bad snapshot event', err);
      }
      onStatus('online');
    });
    source.onerror = () => {
      onStatus('offline');
      if (source?.readyState === EventSource.CLOSED) reopen();
    };
  };

  onStatus('connecting');
  fetch(`${base}/presence`)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
    .then(accept)
    .catch((err) => {
      console.warn('presence: initial fetch failed', err);
      if (source?.readyState !== EventSource.OPEN) onStatus('offline');
    });
  open();
  feedWatchdog();

  return () => {
    stopped = true;
    clearTimeout(retry);
    clearTimeout(watchdog);
    source?.close();
  };
}
