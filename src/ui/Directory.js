import { CATEGORIES } from '../data/store.js';
import { bus } from '../utils/events.js';

// Plain-HTML directory: building → floor → rooms. Also the screen-reader / no-WebGL fallback.
export function initDirectory(locations) {
  const root = document.getElementById('directory');
  const filters = document.getElementById('directory-filters');
  const list = document.getElementById('directory-list');
  const active = new Set();

  const cats = [...new Set(locations.map((l) => l.category))];
  filters.innerHTML = cats.map((c) => `<button type="button" class="chip" aria-pressed="false" data-cat="${c}">${CATEGORIES[c]?.icon ?? ''} ${CATEGORIES[c]?.label ?? c}</button>`).join('');
  filters.addEventListener('click', (e) => {
    const b = e.target.closest('.chip');
    if (!b) return;
    const on = b.getAttribute('aria-pressed') !== 'true';
    b.setAttribute('aria-pressed', String(on));
    on ? active.add(b.dataset.cat) : active.delete(b.dataset.cat);
    render();
  });

  const a11yLine = (a) => {
    const fmt = (v) => (v === true ? '✅ yes' : v === false ? '❌ no' : v ? `✅ ${v}` : '❔ not surveyed');
    return `<ul class="dir-a11y">
      <li>Step-free entrance: ${fmt(a.stepFreeEntrance)}</li>
      <li>Ramp: ${fmt(a.ramp)}</li><li>Lift: ${fmt(a.lift)}</li>
      <li>Accessible washroom: ${fmt(a.accessibleWashroom)}</li></ul>`;
  };

  const render = () => {
    const shown = locations.filter((l) => !active.size || active.has(l.category));
    const groups = Map.groupBy ? Map.groupBy(shown, (l) => l.category) : shown.reduce((m, l) => m.set(l.category, [...(m.get(l.category) || []), l]), new Map());
    list.innerHTML = [...groups].map(([cat, locs]) => `
      <h3 class="dir-cat">${CATEGORIES[cat]?.icon ?? ''} ${CATEGORIES[cat]?.label ?? cat} <span class="dir-count">${locs.length}</span></h3>
      ${locs.map((l) => `
        <details class="dir-item">
          <summary><span class="dir-name">${l.name}</span>${l.mapLoc ? '' : '<span class="tag" title="Position not captured yet">not mapped</span>'}${l.verified ? '' : '<span class="tag" title="Not yet verified on campus">unverified</span>'}</summary>
          <div class="dir-body">
            ${l.building ? `<p class="muted">${l.building}</p>` : ''}
            ${l.description ? `<p>${l.description}</p>` : ''}
            ${l.whereToFind ? `<p><strong>Where to find it:</strong> ${l.whereToFind}</p>` : ''}
            ${l.subLocations?.length ? `<p><strong>Includes:</strong> ${l.subLocations.join(', ')}</p>` : ''}
            ${l.hours ? `<p><strong>Hours:</strong> ${l.hours}</p>` : ''}
            ${l.floors.length ? l.floors.map((f) => `<p class="dir-floor">Floor ${f.level}</p><ul>${f.rooms.map((r) => `<li>${r.code ? `<code>${r.code}</code> ` : ''}${r.name}${r.accessible ? ' ♿' : ''}</li>`).join('')}</ul>`).join('') : '<p class="muted">Rooms not listed yet.</p>'}
            ${a11yLine(l.accessibility)}
            <button type="button" class="btn btn-small" data-action="focus" data-loc="${l.id}">${l.mapLoc ? '📍 Show on map' : 'ℹ️ Details'}</button>
          </div>
        </details>`).join('')}`).join('');
  };
  render();

  const open = () => {
    root.classList.add('is-open');
    root.focus();
  };
  const close = () => root.classList.remove('is-open');
  bus.on('directory:open', open);
  bus.on('directory:close', close);
  root.addEventListener('keydown', (e) => e.key === 'Escape' && close());
}
