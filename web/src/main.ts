import './style.css';
import * as THREE from 'three';
import { AvatarLayer } from './avatars/avatars';
import { mountDebugPanel } from './debug/debugPanel';
import { buildSeatLabels } from './debug/seatLabels';
import { mountHud } from './hud/hud';
import { buildOffice } from './office/buildOffice';
import { OFFICE_LAYOUT } from './office/layout';
import type { PresenceSnapshot } from './presence/contract';
import { demoSnapshot } from './presence/demo';
import { connectLive } from './presence/live';
import { Stage, type ViewMode } from './scene/stage';

/*
 * URL parameters
 *   ?demo=<seed>   fake snapshot instead of the server (no-server preview)
 *   ?view=top      start in the top-down view
 *   ?labels=1      show seat id labels
 *   ?debug=1       debug panel
 *   ?tvAfter=<s>   seconds without input before TV auto-orbit (default 60)
 */
const params = new URLSearchParams(location.search);

const app = document.querySelector<HTMLElement>('#app')!;
const stage = new Stage(app, OFFICE_LAYOUT.bounds);

const office = buildOffice(OFFICE_LAYOUT);
stage.scene.add(office.root);

const avatars = new AvatarLayer(OFFICE_LAYOUT, office, Math.min(stage.maxAnisotropy, 16));
stage.scene.add(avatars.root);

const hud = mountHud(app);
// Keep the office framed below the HUD (its size depends on viewport width and fonts).
const syncInset = () => stage.setTopInset(hud.bottom() + 8);
syncInset();
window.addEventListener('resize', syncInset);
void document.fonts?.ready.then(() => {
  syncInset();
  stage.resetView();
});

let current: PresenceSnapshot | null = null;

/** Single entry point for presence data, live or fake. */
export function applySnapshot(snapshot: PresenceSnapshot): void {
  current = snapshot;
  avatars.applySnapshot(snapshot);
  hud.update(snapshot);
}

const demo = params.get('demo');
if (demo !== null) {
  applySnapshot(demoSnapshot(Number(demo) || 1, avatars.seatIds));
} else {
  connectLive({ onSnapshot: applySnapshot, onStatus: hud.setStatus });
}

// View toggle (45-degree orbit vs straight top-down).
const viewToggle = document.createElement('div');
viewToggle.className = 'panel view-toggle';
viewToggle.innerHTML = `
  <button data-view="angled">3D</button>
  <button data-view="top">Top-down</button>
  <button data-reset>Reset</button>
`;
app.appendChild(viewToggle);
const syncToggle = () => {
  viewToggle.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((b) => {
    b.classList.toggle('active', b.dataset.view === stage.viewMode);
  });
};
viewToggle.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest('button');
  if (!btn) return;
  if (btn.dataset.view) stage.setView(btn.dataset.view as ViewMode);
  else stage.resetView();
  syncToggle();
});
if (params.get('view') === 'top') stage.setView('top');
syncToggle();

const labelsOn = params.get('labels') === '1';
const seatLabels = buildSeatLabels(OFFICE_LAYOUT.seats);
stage.scene.add(seatLabels.root);
seatLabels.setVisible(labelsOn);

if (params.get('debug') === '1') {
  mountDebugPanel(app, {
    seatIds: avatars.seatIds,
    labels: seatLabels,
    labelsOn,
    apply: applySnapshot,
    current: () => current,
  });
}

// TV mode: after a quiet spell with no input, slowly orbit; any input stops it.
const tvAfterMs = (Number(params.get('tvAfter')) || 60) * 1000;
let lastInput = performance.now();
const onInput = () => {
  lastInput = performance.now();
  if (stage.autoOrbiting) {
    stage.setAutoOrbit(false);
    app.classList.remove('tv');
  }
};
for (const type of ['pointerdown', 'pointermove', 'wheel', 'keydown', 'touchstart']) {
  window.addEventListener(type, onInput, { passive: true, capture: true });
}

// Handy in the browser console.
Object.assign(window, { applySnapshot, OFFICE_LAYOUT });

const timer = new THREE.Timer();
timer.connect(document);
stage.renderer.setAnimationLoop((timestamp) => {
  timer.update(timestamp);
  if (!stage.autoOrbiting && performance.now() - lastInput > tvAfterMs && stage.viewMode === 'angled') {
    stage.setAutoOrbit(true);
    app.classList.add('tv');
  }
  avatars.update(timer.getElapsed());
  stage.render(timer.getDelta());
});
