import { v3 } from '../utils/math.js';

// A* over nav.json. Accessible mode drops stairs edges and makes unpaved edges 3× as costly.
export class Router {
  constructor(nav, byId) {
    this.metresPerUnit = nav.metresPerUnit || 8;
    this.nodes = new Map(Object.entries(nav.nodes).map(([k, p]) => [k, v3(p)]));
    this.adj = new Map([...this.nodes.keys()].map((k) => [k, []]));
    for (const [a, b, flags = {}] of nav.edges) {
      if (!this.nodes.has(a) || !this.nodes.has(b)) { console.warn('nav edge to unknown node', a, b); continue; }
      const len = this.nodes.get(a).distanceTo(this.nodes.get(b));
      this.adj.get(a).push({ to: b, len, ...flags });
      this.adj.get(b).push({ to: a, len, ...flags });
    }
    this.byId = byId;
  }

  // Entrance nodes for a location, or the nearest plain node to its anchor.
  nodesFor(locId) {
    const ents = [...this.nodes.keys()].filter((k) => k.startsWith(`ent_${locId}_`));
    if (ents.length) return ents;
    const a = this.byId.get(locId)?.anchorV;
    if (!a) return [];
    let best = null, bd = Infinity;
    for (const [k, p] of this.nodes) {
      if (k.startsWith('ent_')) continue;
      const d = p.distanceTo(a);
      if (d < bd) { bd = d; best = k; }
    }
    return best ? [best] : [];
  }

  route(fromId, toId, { accessible = false } = {}) {
    const starts = this.nodesFor(fromId), goals = new Set(this.nodesFor(toId));
    if (!starts.length || !goals.size) return null;
    const goalPts = [...goals].map((g) => this.nodes.get(g));
    const h = (k) => Math.min(...goalPts.map((g) => this.nodes.get(k).distanceTo(g)));

    const g = new Map(), came = new Map(), open = new Set(starts);
    const f = new Map();
    for (const s of starts) { g.set(s, 0); f.set(s, h(s)); }

    while (open.size) {
      let cur = null;
      for (const k of open) if (cur === null || f.get(k) < f.get(cur)) cur = k;
      if (goals.has(cur)) return this.build(cur, came, fromId, toId, g.get(cur));
      open.delete(cur);
      for (const e of this.adj.get(cur)) {
        if (accessible && e.stairs) continue;
        const cost = e.len * (accessible && e.unpaved ? 3 : 1);
        const tentative = g.get(cur) + cost;
        if (tentative < (g.get(e.to) ?? Infinity)) {
          came.set(e.to, cur);
          g.set(e.to, tentative);
          f.set(e.to, tentative + h(e.to));
          open.add(e.to);
        }
      }
    }
    return null;
  }

  build(end, came, fromId, toId) {
    const keys = [end];
    while (came.has(keys[0])) keys.unshift(came.get(keys[0]));
    const points = keys.map((k) => this.nodes.get(k).clone());
    // start/end at the building anchors when the graph node is only "nearest"
    const a = this.byId.get(fromId).anchorV, b = this.byId.get(toId).anchorV;
    if (!keys[0].startsWith('ent_')) points.unshift(a.clone());
    if (!keys.at(-1).startsWith('ent_')) points.push(b.clone());
    let units = 0;
    for (let i = 1; i < points.length; i++) units += points[i].distanceTo(points[i - 1]);
    const metres = units * this.metresPerUnit;
    return { keys, points, metres };
  }
}

export const walkMinutes = (m, wheelchair) => Math.max(1, Math.round(m / (wheelchair ? 0.8 : 1.2) / 60));
