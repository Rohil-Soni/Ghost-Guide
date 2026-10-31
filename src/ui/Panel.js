import { CATEGORIES } from '../data/store.js';
import { bus } from '../utils/events.js';
import { shareUrl } from '../utils/url.js';

const fmt = (v) => (v === true ? '<span class="ok">Yes</span>' : v === false ? '<span class="no">No</span>' : v ? `<span class="ok">${v}</span>` : '<span class="unk">Not surveyed yet</span>');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function mapStatus(l) {
  if (l.anchorV) return '';
  if (l.mapLoc) return `<p class="map-note">📍 Shown at <strong>${esc(l.mapLoc.name)}</strong>. Its exact position is still to be captured.</p>`;
  return '<p class="map-note">📍 Not on the map yet: its position is still to be captured on campus. See “Where to find it” below.</p>';
}

// Detail drawer for the focused building, with the accessibility card and directions form.
export function initPanel(locations, byId) {
  const panel = document.getElementById('panel');
  let current = null;

  const routable = locations.filter((l) => l.mapLoc).sort((a, b) => a.name.localeCompare(b.name));
  const options = (selected) => routable
    .map((l) => `<option value="${l.id}" ${l.id === selected ? 'selected' : ''}>${esc(l.name)}</option>`).join('');

  function open(id) {
    const l = byId.get(id);
    if (!l) return;
    current = id;
    const cat = CATEGORIES[l.category] || CATEGORIES.service;
    const a = l.accessibility;
    const nearby = (l.nearby ?? []).map((n) => byId.get(n)).filter(Boolean);
    panel.innerHTML = `
      <div class="panel-head">
        <p class="panel-cat" style="--pin:${cat.color}">${cat.icon} ${cat.label}${l.verified ? '' : ' · <span class="tag" title="Not yet verified on campus">unverified</span>'}</p>
        <h2 class="panel-title">${esc(l.name)}</h2>
        ${l.building ? `<p class="panel-building">${esc(l.building)}</p>` : ''}
        <button type="button" class="btn btn-icon panel-close" data-action="close-panel" aria-label="Close details">✕</button>
      </div>
      ${mapStatus(l)}
      ${l.photos[0] ? `<img class="panel-photo" src="${l.photos[0]}" alt="${esc(l.name)}" loading="lazy" />` : ''}
      ${l.description ? `<p>${esc(l.description)}</p>` : ''}
      ${l.whereToFind ? `<section class="panel-block"><h3>🧭 Where to find it</h3><p>${esc(l.whereToFind)}</p></section>` : ''}
      ${l.hours ? `<p><strong>Hours</strong> ${esc(l.hours)}</p>` : ''}
      ${l.subLocations?.length ? `<section class="panel-block"><h3>Inside / includes</h3><ul class="pill-list">${l.subLocations.map((s) => `<li>${esc(s)}</li>`).join('')}</ul></section>` : ''}
      ${l.floors.length ? `<details><summary>What's inside</summary>${l.floors.map((f) => `<p class="dir-floor">Floor ${f.level}</p><ul>${f.rooms.map((r) => `<li>${r.code ? `<code>${r.code}</code> ` : ''}${esc(r.name)}${r.accessible ? ' ♿' : ''}</li>`).join('')}</ul>`).join('')}</details>` : ''}
      ${nearby.length ? `<section class="panel-block"><h3>Nearby</h3><div class="chips">${nearby.map((n) => `<button type="button" class="chip" data-action="focus" data-loc="${n.id}">${CATEGORIES[n.category]?.icon ?? ''} ${esc(n.name)}</button>`).join('')}</div>${l.nearbyNotes ? `<p class="small muted">${esc(l.nearbyNotes)}</p>` : ''}</section>` : ''}
      <section class="a11y-card" aria-labelledby="a11y-h">
        <h3 id="a11y-h">♿ Accessibility</h3>
        <dl>
          <dt>Step-free entrance</dt><dd>${fmt(a.stepFreeEntrance)}</dd>
          <dt>Ramp</dt><dd>${fmt(a.ramp)}</dd>
          <dt>Lift</dt><dd>${fmt(a.lift)}</dd>
          <dt>Accessible washroom</dt><dd>${fmt(a.accessibleWashroom)}</dd>
        </dl>
        ${a.notes ? `<p class="a11y-notes">${esc(a.notes)}</p>` : ''}
      </section>
      ${l.mapLoc ? `
      <form class="directions" id="directions-form">
        <h3>Directions</h3>
        <label>From <select name="from">${options(id === 'main_gate' ? 'annapurna' : 'main_gate')}</select></label>
        <label class="check"><input type="checkbox" name="accessible" /> Step-free route only</label>
        <div class="row">
          <button type="submit" class="btn">Show route</button>
          <button type="button" class="btn btn-ghost" data-action="share">🔗 Share</button>
        </div>
      </form>` : '<div class="row"><button type="button" class="btn btn-ghost" data-action="share">🔗 Share</button></div>'}
      ${l.sources?.length ? `<details class="sources"><summary>Sources (${l.sources.length})</summary><ul>${l.sources.map((s) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a></li>`).join('')}</ul></details>` : ''}`;
    panel.hidden = false;
    requestAnimationFrame(() => panel.classList.add('is-open'));

    panel.querySelector('#directions-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      bus.emit('route', { from: fd.get('from'), to: id, accessible: fd.get('accessible') === 'on' });
    });
    panel.querySelector('[data-action="share"]').addEventListener('click', async (e) => {
      const url = shareUrl(id);
      try { await navigator.clipboard.writeText(url); e.target.textContent = '✅ Link copied'; } catch { prompt('Copy this link', url); }
    });
  }

  function close() {
    if (!current) return;
    current = null;
    panel.classList.remove('is-open');
    panel.hidden = true;
    bus.emit('panel:closed');
  }

  bus.on('panel:open', open);
  bus.on('panel:close', close);
  addEventListener('keydown', (e) => e.key === 'Escape' && current && document.activeElement?.id !== 'search-input' && close());
  return { open, close, get current() { return current; } };
}
