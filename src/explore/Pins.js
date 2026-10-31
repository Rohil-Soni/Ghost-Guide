import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { CATEGORIES } from '../data/store.js';
import { bus } from '../utils/events.js';

const PRIORITY = { gate: 0, landmark: 1, food: 1, academic: 2, sports: 3, residential: 3, service: 4, hostel: 5 };
const MIN_GAP = 46; // px between pin centres before lower-priority pins hide

export class Pins {
  constructor(scene, locations, sceneManager) {
    this.items = [];
    this.layers = new Set(Object.keys(CATEGORIES));
    this.mode = 'story';
    this.storyIds = new Set();
    this.selected = null;
    this.v = new THREE.Vector3();

    for (const loc of locations.filter((l) => l.anchorV)) {
      const cat = CATEGORIES[loc.category] || CATEGORIES.service;
      const el = document.createElement('button');
      el.type = 'button';
      el.className = `pin pin--${loc.category}`;
      el.style.setProperty('--pin', cat.color);
      el.setAttribute('aria-label', `${loc.name}, show details`);
      el.innerHTML = `<span class="pin-icon" aria-hidden="true">${cat.icon}</span><span class="pin-label">${loc.blockCode || shortName(loc.name)}</span>`;
      el.addEventListener('click', (e) => { e.stopPropagation(); bus.emit('select', loc.id); });
      el.addEventListener('pointerdown', (e) => e.stopPropagation());

      const obj = new CSS2DObject(el);
      const h = sceneManager.heightOf(loc.id);
      obj.position.copy(loc.anchorV).setY(h + 1.2);
      obj.center.set(0.5, 1);
      scene.add(obj);
      this.items.push({ loc, obj, el, prio: PRIORITY[loc.category] ?? 4 });
    }
  }

  setMode(mode) { this.mode = mode; }
  setStoryIds(ids) { this.storyIds = new Set(ids); }
  setSelected(id) {
    this.selected = id;
    for (const it of this.items) it.el.classList.toggle('is-selected', it.loc.id === id);
  }
  toggleLayer(cat, on) { on ? this.layers.add(cat) : this.layers.delete(cat); }

  // Screen-space declutter: highest priority wins, overlapping pins hide.
  update(camera) {
    const w = innerWidth / 2, h = innerHeight / 2;
    const candidates = [];
    for (const it of this.items) {
      const id = it.loc.id;
      let want = this.mode === 'explore' ? this.layers.has(it.loc.category) : this.storyIds.has(id);
      if (id === this.selected) want = true;
      if (!want) { it.obj.visible = false; continue; }
      this.v.copy(it.obj.position).project(camera);
      if (this.v.z > 1 || Math.abs(this.v.x) > 1.1 || Math.abs(this.v.y) > 1.1) { it.obj.visible = false; continue; }
      it.sx = this.v.x * w; it.sy = this.v.y * h; it.d = this.v.z;
      candidates.push(it);
    }
    candidates.sort((a, b) => (b.loc.id === this.selected) - (a.loc.id === this.selected) || a.prio - b.prio || a.d - b.d);
    const shown = [];
    for (const it of candidates) {
      const clash = it.loc.id !== this.selected && this.mode === 'explore' &&
        shown.some((s) => Math.abs(s.sx - it.sx) < MIN_GAP && Math.abs(s.sy - it.sy) < MIN_GAP * 0.6);
      it.obj.visible = !clash;
      if (!clash) shown.push(it);
    }
  }
}

export const shortName = (name) => name.replace(/\s*\(.*\)\s*/, '').replace(/^Boys' Hostel /, '');
