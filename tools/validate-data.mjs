// node tools/validate-data.mjs
// Checks locations.json / chapters.json / nav.json against each other and, if present,
// that every LOC_<id> in the optimised GLB has a JSON entry and vice versa.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const errors = [], warnings = [];

const locations = read('public/data/locations.json');
const chapters = read('public/data/chapters.json');
const nav = read('public/data/nav.json');
const ids = new Set();

for (const l of locations) {
  if (ids.has(l.id)) errors.push(`duplicate location id "${l.id}"`);
  ids.add(l.id);
  if (!/^[a-z0-9_]+$/.test(l.id)) errors.push(`location id "${l.id}" should be lower_snake_case`);
  if (l.anchor !== null && (!Array.isArray(l.anchor) || l.anchor.length !== 3)) errors.push(`${l.id}: anchor must be [x, y, z] or null`);
  if (l.anchor === null && !l.parent) warnings.push(`${l.id}: no map position yet (listed and searchable, no pin)`);
  for (const n of l.nearby ?? []) if (!locations.some((x) => x.id === n)) errors.push(`${l.id}: nearby "${n}" is not a location`);
  for (const k of ['stepFreeEntrance', 'ramp', 'lift', 'accessibleWashroom']) {
    if (!(k in (l.accessibility || {}))) errors.push(`${l.id}: accessibility.${k} missing`);
  }
  if (Object.values(l.accessibility || {}).every((v) => v === null)) warnings.push(`${l.id}: accessibility not surveyed`);
}

for (const l of locations) if (l.parent && !locations.some((x) => x.id === l.parent && x.anchor)) errors.push(`${l.id}: parent "${l.parent}" missing or has no anchor`);

for (const c of chapters) {
  for (const id of c.locationIds) if (!ids.has(id)) errors.push(`chapter ${c.id} references unknown location "${id}"`);
  if (!c.shot && !c.locationIds.length) errors.push(`chapter ${c.id} has no shot and no location to derive one from`);
}

const nodes = new Set(Object.keys(nav.nodes));
for (const [a, b] of nav.edges) for (const n of [a, b]) if (!nodes.has(n)) errors.push(`nav edge uses unknown node "${n}"`);
for (const n of nodes) {
  const m = n.match(/^ent_(.+)_\d+$/);
  if (m && !ids.has(m[1])) errors.push(`entrance node "${n}" refers to unknown location "${m[1]}"`);
  if (!nav.edges.some(([a, b]) => a === n || b === n)) warnings.push(`nav node "${n}" has no edges`);
}

const glbPath = path.join(root, 'public/models/campus.opt.glb');
if (fs.existsSync(glbPath)) {
  const buf = fs.readFileSync(glbPath);
  const jsonLen = buf.readUInt32LE(12);
  const gltf = JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8'));
  const locNodes = new Set((gltf.nodes || []).map((n) => n.name?.match(/^LOC_([a-z0-9_]+)/)?.[1]).filter(Boolean));
  for (const id of locNodes) if (!ids.has(id)) errors.push(`GLB has LOC_${id} but locations.json does not`);
  for (const id of ids) if (!locNodes.has(id)) warnings.push(`locations.json has "${id}" but GLB has no LOC_${id}`);
} else {
  warnings.push('public/models/campus.opt.glb not found (site uses the procedural placeholder campus)');
}

for (const w of warnings) console.log('  warn ', w);
for (const e of errors) console.log('  ERROR', e);
console.log(`\n${locations.length} locations, ${chapters.length} chapters, ${nodes.size} nav nodes: ${errors.length} errors, ${warnings.length} warnings`);
process.exit(errors.length ? 1 : 0);
