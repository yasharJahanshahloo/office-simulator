/**
 * Bakes the static office into a few meshes: one per (material, shadow flags). The office is
 * built from ~900 small meshes that never move; drawn one by one (twice, with the shadow pass)
 * they cost ~1,800 draw calls a frame for ~30k triangles.
 *
 * Kept as separate objects, re-parented to `root` with their world transform:
 *   - meshes in `keep` (monitor screens, whose material the presence layer switches),
 *   - transparent meshes (glass: merging would break their back-to-front sorting),
 *   - mirrored meshes (negative scale would flip the merged triangles' winding).
 */
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export function mergeStatic(root: THREE.Group, keep: ReadonlySet<THREE.Object3D>): void {
  root.updateMatrixWorld(true);
  const buckets = new Map<string, { material: THREE.Material; cast: boolean; receive: boolean; parts: THREE.BufferGeometry[] }>();
  const kept: THREE.Mesh[] = [];

  root.traverseVisible((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const mirrored = o.matrixWorld.determinant() < 0;
    const materials: THREE.Material[] = Array.isArray(o.material) ? o.material : [o.material];
    if (keep.has(o) || mirrored || materials.some((m) => m.transparent)) {
      kept.push(o);
      return;
    }
    for (const { material, geometry } of splitByMaterial(o)) {
      const key = `${material.uuid}|${o.castShadow}|${o.receiveShadow}`;
      let b = buckets.get(key);
      if (!b) buckets.set(key, (b = { material, cast: o.castShadow, receive: o.receiveShadow, parts: [] }));
      const g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
      for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
      g.clearGroups();
      b.parts.push(g.applyMatrix4(o.matrixWorld));
    }
  });

  for (const m of kept) root.attach(m);
  root.clear();
  for (const m of kept) root.add(m);
  for (const b of buckets.values()) {
    const merged = mergeGeometries(b.parts);
    for (const p of b.parts) p.dispose();
    if (!merged) throw new Error(`mergeStatic: incompatible geometries for ${b.material.name || b.material.type}`);
    const mesh = new THREE.Mesh(merged, b.material);
    mesh.castShadow = b.cast;
    mesh.receiveShadow = b.receive;
    mesh.matrixAutoUpdate = false;
    root.add(mesh);
  }
}

/** One (material, geometry) pair per material a mesh uses; multi-material meshes split by group. */
function splitByMaterial(mesh: THREE.Mesh): { material: THREE.Material; geometry: THREE.BufferGeometry }[] {
  if (!Array.isArray(mesh.material)) return [{ material: mesh.material, geometry: mesh.geometry }];
  const src = mesh.geometry;
  const index = src.index;
  if (!index) throw new Error('mergeStatic: multi-material mesh without an index');
  return src.groups.map((group) => {
    const g = src.clone();
    g.setIndex(Array.from(index.array.slice(group.start, group.start + group.count)));
    return { material: (mesh.material as THREE.Material[])[group.materialIndex ?? 0]!, geometry: g };
  });
}
