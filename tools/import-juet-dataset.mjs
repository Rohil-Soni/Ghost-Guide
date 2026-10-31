// node tools/import-juet-dataset.mjs
// Merges data-sources/juet_campus_dataset/juet_campus_places.json into public/data/locations.json.
// Text, aliases, nearby links and sources come from the dataset; map anchors and geometry stay ours.
// The dataset has no coordinates, so places we can't place stay anchorless (searchable + directory,
// no pin) instead of getting a guessed position. Re-run whenever the dataset is updated.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOCS = path.join(root, 'public/data/locations.json');
const dataset = JSON.parse(fs.readFileSync(path.join(root, 'data-sources/juet_campus_dataset/juet_campus_places.json'), 'utf8'));
const locations = JSON.parse(fs.readFileSync(LOCS, 'utf8'));

// dataset id -> our id. Existing ids keep their map anchor and 3D geometry.
const ID_MAP = {
  'main-gate': 'main_gate',
  'nehru-plaza': 'nehru_plaza',
  'academic-blocks': 'academic',
  'lt-1': 'lt_1',
  'lt-2-to-lt-5': 'lt_2_to_5',
  'lrc': 'lrc',
  'administrative-offices': 'admin_offices',
  'tagore-hall-mph': 'tagore_hall',
  'sports-ground': 'sports_ground',
  'shopping-centre-cluster': 'shopping_centre',
  'annapurna-mess': 'annapurna',
  'hostel-area': 'hostel_area',
};

const CATEGORY_MAP = {
  campus_entry: 'gate', campus_landmark: 'landmark', academic_area: 'academic', lecture_theatre: 'academic',
  lecture_theatre_group: 'academic', library: 'academic', administration: 'admin', event_venue: 'venue',
  sports_recreation: 'sports', retail_and_food: 'shops', dining: 'food', residential: 'hostel',
};

// Places that live inside a mapped area: selecting them focuses that area until they get their own pin.
const PARENT = { lt_1: 'academic', lt_2_to_5: 'academic', lrc: 'academic' };

const sources = new Map(dataset.sources.map((s) => [s.source_id, { title: s.title, url: s.url }]));
const byId = new Map(locations.map((l) => [l.id, l]));
const blank = (id) => ({
  id, name: '', aliases: [], category: 'service', chapter: null, blockCode: null, description: '', hours: null,
  floors: [], accessibility: { stepFreeEntrance: null, ramp: null, lift: null, accessibleWashroom: null, notes: null },
  pois: [], anchor: null, shot: null, photos: [], contact: null, verified: false,
});

let added = 0, updated = 0;
for (const p of dataset.places) {
  const id = ID_MAP[p.id];
  if (!id) { console.warn('no id mapping for', p.id, '(skipped)'); continue; }
  let loc = byId.get(id);
  if (loc) updated++;
  else { loc = blank(id); locations.push(loc); byId.set(id, loc); added++; }

  loc.name = p.name;
  loc.aliases = [...new Set([...p.aliases.map((a) => a.toLowerCase()), ...loc.aliases])];
  if (!loc.anchor) loc.category = CATEGORY_MAP[p.category] ?? loc.category;
  loc.description = p.description;
  loc.building = p.building_or_area ?? null;
  loc.whereToFind = p.where_to_find_it ?? null;
  loc.subLocations = p.sub_location_names ?? [];
  loc.nearby = (p.nearby_place_ids ?? []).map((n) => ID_MAP[n]).filter(Boolean);
  loc.nearbyNotes = p.nearby_notes ?? null;
  loc.sources = (p.source_ids ?? []).map((s) => sources.get(s)).filter(Boolean);
  loc.verified = !!p.field_verified;
  if (PARENT[id]) loc.parent = PARENT[id];
  const { latitude, longitude } = p.coordinates ?? {};
  loc.gps = latitude != null && longitude != null ? [latitude, longitude] : null;
}

// Hostel blocks: point back to the sourced hostel facts.
const hostelArea = byId.get('hostel_area');
for (const l of locations) {
  if (l.category !== 'hostel' || !l.blockCode) continue;
  l.description = `Y-shaped boys' hostel block ${l.blockCode}. JUET's hostel page lists 21 boys' hostel blocks and a separate girls' hostel; which physical block carries which number is still to be confirmed on site.`;
  l.nearby = ['annapurna', 'shopping_centre'];
  l.sources = hostelArea?.sources ?? [];
}

// Keep mapped places first (stable order for the tour), then the anchorless ones.
locations.sort((a, b) => (a.anchor ? 0 : 1) - (b.anchor ? 0 : 1));
fs.writeFileSync(LOCS, JSON.stringify(locations, null, 1) + '\n');
console.log(`dataset v${dataset.dataset_version}: ${updated} updated, ${added} added, ${locations.length} total`);
