import * as THREE from 'three';
import type { FloorFinish, PaletteKey } from './types';

const PALETTE: Record<PaletteKey, number> = {
  white: 0xf1efea,
  lightGrey: 0xd9d8d4,
  midGrey: 0x7c7b80,
  darkGrey: 0x4a4a4f,
  charcoal: 0x2d2d31,
  wood: 0xd2a874,
  mustard: 0xe0a93a,
  green: 0x2f9e7a,
  purple: 0x6a4fb0,
};

const FLOORS: Record<FloorFinish, number> = {
  carpet: 0x8d8b90,
  'carpet-meeting': 0x9a948c,
  kitchen: 0xb9b5ae,
  'lounge-rug': 0x55545a,
};

const cache = new Map<string, THREE.Material>();

function cached<T extends THREE.Material>(key: string, make: () => T): T {
  let m = cache.get(key);
  if (!m) {
    m = make();
    cache.set(key, m);
  }
  return m as T;
}

export function paletteMaterial(key: PaletteKey, roughness = 0.8): THREE.MeshStandardMaterial {
  return cached(`p:${key}:${roughness}`, () =>
    new THREE.MeshStandardMaterial({ color: PALETTE[key], roughness, metalness: 0 }),
  );
}

export function floorMaterial(finish: FloorFinish): THREE.MeshStandardMaterial {
  return cached(`f:${finish}`, () =>
    new THREE.MeshStandardMaterial({ color: FLOORS[finish], roughness: 0.95 }),
  );
}

export const MATERIALS = {
  get wall() {
    return cached('wall', () => new THREE.MeshStandardMaterial({ color: 0xe6e4df, roughness: 0.9 }));
  },
  get wallCap() {
    return cached('wallCap', () => new THREE.MeshStandardMaterial({ color: 0x2b2b2f, roughness: 0.8 }));
  },
  get ground() {
    return cached('ground', () => new THREE.MeshStandardMaterial({ color: 0xe8e6e2, roughness: 1 }));
  },
  get glass() {
    return cached(
      'glass',
      () =>
        new THREE.MeshStandardMaterial({
          color: 0xbfd9e6,
          roughness: 0.1,
          transparent: true,
          opacity: 0.22,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
    );
  },
  get windowGlass() {
    return cached(
      'windowGlass',
      () =>
        new THREE.MeshStandardMaterial({
          color: 0xcfe6f5,
          roughness: 0.1,
          transparent: true,
          opacity: 0.45,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
    );
  },
  get frame() {
    return cached('frame', () => new THREE.MeshStandardMaterial({ color: 0x26262a, roughness: 0.6 }));
  },
  get door() {
    return cached('door', () => new THREE.MeshStandardMaterial({ color: 0xf4f3f0, roughness: 0.7 }));
  },
  get deskTop() {
    return cached('deskTop', () => new THREE.MeshStandardMaterial({ color: 0xeceae5, roughness: 0.6 }));
  },
  get metal() {
    return cached('metal', () =>
      new THREE.MeshStandardMaterial({ color: 0xb9bbbf, roughness: 0.4, metalness: 0.5 }),
    );
  },
  get plastic() {
    return cached('plastic', () => new THREE.MeshStandardMaterial({ color: 0x1f1f23, roughness: 0.5 }));
  },
  get screenOff() {
    return cached('screenOff', () =>
      new THREE.MeshStandardMaterial({ color: 0x15171c, roughness: 0.3, metalness: 0.2 }),
    );
  },
  get screenOn() {
    return cached(
      'screenOn',
      () =>
        new THREE.MeshStandardMaterial({
          color: 0x9fd8ff,
          emissive: 0x6cc4ff,
          emissiveIntensity: 1.6,
          roughness: 0.3,
        }),
    );
  },
  get foliage() {
    return cached('foliage', () =>
      new THREE.MeshStandardMaterial({ color: 0x8fb24a, roughness: 0.9, flatShading: true }),
    );
  },
  get foliageDark() {
    return cached('foliageDark', () =>
      new THREE.MeshStandardMaterial({ color: 0x5f8a34, roughness: 0.9, flatShading: true }),
    );
  },
  get pot() {
    return cached('pot', () => new THREE.MeshStandardMaterial({ color: 0xb06c3c, roughness: 0.85 }));
  },
};
