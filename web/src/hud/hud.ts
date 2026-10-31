/**
 * TV overlay: "N of M working with AI now", per-tool counts, Tehran clock,
 * and the offline badge.
 */
import type { PresenceSnapshot, Tool } from '../presence/contract';
import type { ConnectionStatus } from '../presence/live';
import { TOOL_ORDER, TOOL_STYLES } from '../presence/tools';

const TZ = 'Asia/Tehran';
const timeFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const dateFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short' });
const persianDateFmt = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
  timeZone: TZ,
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

export interface Hud {
  update(snapshot: PresenceSnapshot): void;
  setStatus(status: ConnectionStatus): void;
  /** Bottom edge of the HUD panels in CSS px (what the 3D view should keep clear). */
  bottom(): number;
}

export function mountHud(host: HTMLElement): Hud {
  const stats = document.createElement('section');
  stats.className = 'hud hud-stats';
  stats.innerHTML = `
    <div class="hud-headline">
      <span class="hud-n">0</span>
      <div class="hud-text">
        <div class="hud-of">of <span class="hud-m">0</span></div>
        <div class="hud-caption">working with AI now</div>
      </div>
    </div>
    <div class="hud-tools">
      ${TOOL_ORDER.map((t) => {
        const s = TOOL_STYLES[t];
        return `<div class="hud-tool" data-tool="${t}" title="${s.name}">
          <span class="tool-mark" style="background:${s.color}">${s.mark}</span>
          <span class="tool-name">${s.name}</span>
          <span class="tool-count">0</span>
        </div>`;
      }).join('')}
    </div>`;

  const clock = document.createElement('section');
  clock.className = 'hud hud-clock';
  clock.innerHTML = `
    <div class="clock-time"></div>
    <div class="clock-date"></div>
    <div class="clock-fa" dir="rtl" lang="fa"></div>`;

  const badge = document.createElement('div');
  badge.className = 'offline-badge';
  badge.textContent = 'offline · reconnecting…';
  badge.hidden = true;

  host.append(stats, clock, badge);

  const nEl = stats.querySelector<HTMLElement>('.hud-n')!;
  const mEl = stats.querySelector<HTMLElement>('.hud-m')!;
  const toolEls = new Map<Tool, HTMLElement>();
  for (const t of TOOL_ORDER) toolEls.set(t, stats.querySelector<HTMLElement>(`[data-tool="${t}"]`)!);

  const timeEl = clock.querySelector<HTMLElement>('.clock-time')!;
  const dateEl = clock.querySelector<HTMLElement>('.clock-date')!;
  const faEl = clock.querySelector<HTMLElement>('.clock-fa')!;
  const tick = () => {
    const now = new Date();
    timeEl.textContent = timeFmt.format(now);
    dateEl.textContent = `${dateFmt.format(now)} · Tehran`;
    faEl.textContent = persianDateFmt.format(now);
  };
  tick();
  // align ticks to the start of each second so the minute flips on time
  setTimeout(() => {
    tick();
    setInterval(tick, 1000);
  }, 1000 - (Date.now() % 1000));

  return {
    update(snapshot) {
      const working = snapshot.seats.filter((s) => s.state === 'working');
      nEl.textContent = String(working.length);
      mEl.textContent = String(snapshot.seats.length);
      for (const t of TOOL_ORDER) {
        const n = working.filter((s) => s.tool === t).length;
        const el = toolEls.get(t)!;
        el.querySelector('.tool-count')!.textContent = String(n);
        el.classList.toggle('zero', n === 0);
      }
    },
    setStatus(status) {
      badge.hidden = status !== 'offline';
    },
    bottom() {
      const top = host.getBoundingClientRect().top;
      return Math.max(stats.getBoundingClientRect().bottom, clock.getBoundingClientRect().bottom) - top;
    },
  };
}
