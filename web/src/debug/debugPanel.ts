/**
 * Debug panel (`?debug=1`): pushes fake snapshots through the normal applySnapshot path.
 * In live mode the next server snapshot overrides whatever was set here.
 */
import type { AvatarState, PresenceSnapshot } from '../presence/contract';
import { demoSnapshot } from '../presence/demo';
import type { SeatLabels } from './seatLabels';

export interface DebugPanelOptions {
  seatIds: string[];
  labels: SeatLabels;
  labelsOn: boolean;
  apply: (snapshot: PresenceSnapshot) => void;
  current: () => PresenceSnapshot | null;
}

export function mountDebugPanel(host: HTMLElement, opts: DebugPanelOptions): void {
  const panel = document.createElement('div');
  panel.className = 'panel debug-panel';
  panel.innerHTML = `
    <div class="panel-title">Debug</div>
    <button data-action="random">Random snapshot</button>
    <button data-action="working">All working</button>
    <button data-action="busy">All working + busy</button>
    <button data-action="idle">All idle</button>
    <button data-action="away">All away</button>
    <button data-action="empty">Nobody registered</button>
    <label><input type="checkbox" data-action="labels" /> Seat labels</label>
    <div class="stats" data-stats></div>
  `;
  host.appendChild(panel);
  const stats = panel.querySelector<HTMLElement>('[data-stats]')!;

  const refreshStats = () => {
    const snap = opts.current();
    const counts: Record<AvatarState, number> = { working: 0, idle: 0, away: 0 };
    for (const s of snap?.seats ?? []) counts[s.state]++;
    stats.textContent = `${opts.seatIds.length} desks · ${snap?.seats.length ?? 0} registered · working ${counts.working} · idle ${counts.idle} · away ${counts.away}`;
  };

  const everyone = (state: AvatarState, busy: boolean): PresenceSnapshot => {
    const base = demoSnapshot(7, opts.seatIds);
    const byId = new Map(base.seats.map((s) => [s.seatId, s]));
    return {
      serverTime: new Date().toISOString(),
      seats: opts.seatIds.map((seatId, i) => ({
        ...(byId.get(seatId) ?? { seatId, label: seatId.replace(/^desk-/, ''), name: `@user${i + 1}`, userKey: `u${i}` }),
        state,
        busy,
        tool: (['claude', 'cursor', 'codex', 'hermes'] as const)[i % 4]!,
      })),
    };
  };

  panel.addEventListener('click', (e) => {
    const action = (e.target as HTMLElement).closest('button')?.dataset.action;
    if (!action) return;
    if (action === 'random') opts.apply(demoSnapshot(Math.floor(Math.random() * 1e6), opts.seatIds));
    else if (action === 'working') opts.apply(everyone('working', false));
    else if (action === 'busy') opts.apply(everyone('working', true));
    else if (action === 'idle') opts.apply(everyone('idle', false));
    else if (action === 'away') opts.apply(everyone('away', false));
    else if (action === 'empty') opts.apply({ seats: [], serverTime: new Date().toISOString() });
    refreshStats();
  });

  const labelToggle = panel.querySelector<HTMLInputElement>('[data-action="labels"]')!;
  labelToggle.checked = opts.labelsOn;
  labelToggle.addEventListener('change', () => opts.labels.setVisible(labelToggle.checked));
  refreshStats();
  setInterval(refreshStats, 2000);
}
