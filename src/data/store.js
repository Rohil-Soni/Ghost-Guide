import { v3 } from '../utils/math.js';

const base = import.meta.env.BASE_URL;

async function getJSON(path, fallback) {
  try {
    const res = await fetch(`${base}${path}`);
    if (!res.ok) throw new Error(res.status);
    return await res.json();
  } catch (err) {
    if (fallback !== undefined) return fallback;
    throw err;
  }
}

export const CATEGORIES = {
  academic:    { label: 'Academic',    icon: '🏫', color: '#4f8cff' },
  hostel:      { label: 'Hostels',     icon: '🛏', color: '#f2a65a' },
  food:        { label: 'Food',        icon: '🍽', color: '#ff6b6b' },
  sports:      { label: 'Sports',      icon: '🏐', color: '#3ecf8e' },
  landmark:    { label: 'Landmarks',   icon: '📍', color: '#b98cff' },
  gate:        { label: 'Gates',       icon: '🚪', color: '#ffd166' },
  residential: { label: 'Residences',  icon: '🏠', color: '#9ad1d4' },
  service:     { label: 'Other',       icon: '🏢', color: '#c9c9c9' },
  admin:       { label: 'Admin',       icon: '🗂', color: '#e0b0ff' },
  medical:     { label: 'Medical',     icon: '⚕', color: '#ff8fab' },
};

export const POI_TYPES = {
  washroom: { label: 'Washrooms', icon: '🚻' },
  water:    { label: 'Water',     icon: '🚰' },
  entrance: { label: 'Accessible entrances', icon: '♿' },
  lift:     { label: 'Lifts',     icon: '🛗' },
  ramp:     { label: 'Ramps',     icon: '➡' },
  atm:      { label: 'ATM',       icon: '🏧' },
};

export async function loadData() {
  const [locations, chapters, nav, shots] = await Promise.all([
    getJSON('data/locations.json'),
    getJSON('data/chapters.json'),
    getJSON('data/nav.json'),
    getJSON('data/shots.json', {}),
  ]);

  // shots.json (exported from Blender CAM_/TGT_ empties) overrides hand-authored values.
  const anchors = shots._anchors || {};
  for (const loc of locations) {
    if (anchors[`LOC_${loc.id}`]) loc.anchor = anchors[`LOC_${loc.id}`];
    if (shots[loc.id]?.target) loc.shot = { ...loc.shot, ...shots[loc.id] };
    loc.anchorV = v3(loc.anchor);
  }
  for (const ch of chapters) {
    const key = ch.shotId || `chapter_${ch.id}`;
    if (shots[key]?.target) ch.shot = { ...ch.shot, ...shots[key] };
  }

  const byId = new Map(locations.map((l) => [l.id, l]));
  return { locations, chapters, nav, byId };
}

// Default framing for a location without an authored shot.
export function shotFor(loc, radius = 1.5) {
  if (loc.shot?.pos && loc.shot?.target) return { pos: v3(loc.shot.pos), target: v3(loc.shot.target) };
  const t = loc.anchorV.clone();
  const r = (loc.category === 'residential' || loc.id === 'lake' ? 2.2 : 1) * radius;
  return { pos: t.clone().add({ x: 10 * r, y: 13 * r, z: 17 * r }), target: t };
}
