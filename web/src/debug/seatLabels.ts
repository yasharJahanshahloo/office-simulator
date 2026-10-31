/** CSS2D seat-id labels (`?labels=1` or the debug panel toggle). */
import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import type { Seat } from '../office/types';

export interface SeatLabels {
  root: THREE.Group;
  setVisible(on: boolean): void;
}

export function buildSeatLabels(seats: Seat[]): SeatLabels {
  const root = new THREE.Group();
  root.name = 'seat-labels';
  for (const s of seats) {
    const el = document.createElement('div');
    el.className = `seat-label zone-${s.zone}`;
    el.textContent = s.id.replace(/^(desk|meeting|lounge)-/, '');
    el.title = s.id;
    const obj = new CSS2DObject(el);
    obj.position.set(s.position.x, 1.6, s.position.z);
    root.add(obj);
  }
  return {
    root,
    setVisible(on) {
      root.visible = on;
      // CSS2DRenderer keeps hidden elements in the DOM; hide them explicitly.
      root.traverse((o) => {
        if (o instanceof CSS2DObject) o.element.style.display = on ? '' : 'none';
      });
    },
  };
}
