import Fuse from 'fuse.js';
import { CATEGORIES } from '../data/store.js';
import { bus } from '../utils/events.js';

// Fuse.js combobox. Buildings, rooms and facility points are flattened into one index.
export function initSearch(locations) {
  const input = document.getElementById('search-input');
  const list = document.getElementById('search-results');

  const docs = [];
  for (const loc of locations) {
    docs.push({ kind: 'Buildings', locId: loc.id, name: loc.name, aliases: [...loc.aliases, ...(loc.subLocations ?? [])], category: CATEGORIES[loc.category]?.label ?? loc.category, code: loc.blockCode ?? '', sub: loc.building ?? undefined });
    for (const floor of loc.floors) for (const r of floor.rooms) {
      docs.push({ kind: 'Rooms', locId: loc.id, name: r.name, code: r.code, aliases: [r.type], sub: `${loc.name} · floor ${floor.level}` });
    }
    for (const p of loc.pois) docs.push({ kind: 'Facilities', locId: loc.id, name: p.label, aliases: [p.type], sub: loc.name });
  }
  const fuse = new Fuse(docs, {
    keys: [{ name: 'name', weight: 3 }, { name: 'aliases', weight: 2.5 }, { name: 'code', weight: 2 }, { name: 'category', weight: 1 }],
    threshold: 0.38, ignoreLocation: true, includeScore: true,
  });

  let results = [], active = -1;

  const close = () => { list.hidden = true; input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant'); active = -1; };

  const render = () => {
    list.innerHTML = '';
    if (!results.length) {
      list.innerHTML = input.value.trim() ? '<li class="search-empty" role="presentation">No match yet. Try "mess", "H7" or "gate".</li>' : '';
      list.hidden = !input.value.trim();
      input.setAttribute('aria-expanded', String(!list.hidden));
      return;
    }
    let group = null;
    results.forEach((r, i) => {
      if (r.kind !== group) {
        group = r.kind;
        const h = document.createElement('li');
        h.className = 'search-group'; h.role = 'presentation'; h.textContent = group;
        list.appendChild(h);
      }
      const li = document.createElement('li');
      li.id = `sr-${i}`; li.role = 'option'; li.className = 'search-item';
      li.setAttribute('aria-selected', String(i === active));
      li.innerHTML = `<span class="search-name"></span><span class="search-sub"></span>`;
      li.firstChild.textContent = r.code && r.kind === 'Rooms' ? `${r.code} · ${r.name}` : r.name;
      li.lastChild.textContent = r.sub || r.category || '';
      li.addEventListener('mousedown', (e) => { e.preventDefault(); choose(i); });
      list.appendChild(li);
    });
    list.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    if (active >= 0) input.setAttribute('aria-activedescendant', `sr-${active}`);
  };

  const choose = (i) => {
    const r = results[i];
    if (!r) return;
    input.value = r.name;
    close();
    input.blur();
    bus.emit('select', r.locId);
  };

  input.addEventListener('input', () => {
    const q = input.value.trim();
    // group order: Buildings, Rooms, Facilities, keeping Fuse ranking inside each group
    const order = ['Buildings', 'Rooms', 'Facilities'];
    results = q ? fuse.search(q, { limit: 8 }).map((r) => r.item).sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind)) : [];
    active = results.length ? 0 : -1;
    render();
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!results.length) return;
      e.preventDefault();
      active = (active + (e.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length;
      render();
    } else if (e.key === 'Enter') { e.preventDefault(); choose(Math.max(0, active)); }
    else if (e.key === 'Escape') close();
  });
  input.addEventListener('blur', () => setTimeout(close, 120));
  input.addEventListener('focus', () => input.value.trim() && input.dispatchEvent(new Event('input')));
  addEventListener('keydown', (e) => {
    if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') { e.preventDefault(); input.focus(); }
  });
}
