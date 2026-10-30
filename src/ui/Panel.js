import { CATEGORIES } from '../data/store.js';
import { bus } from '../utils/events.js';
import { shareUrl } from '../utils/url.js';

const fmt = (v) => (v === true ? '<span class="ok">Yes</span>' : v === false ? '<span class="no">No</span>' : v ? `<span class="ok">${v}</span>` : '<span class="unk">Not surveyed yet</span>');

// Detail drawer for the focused building, with the accessibility card and directions form.
export function initPanel(locations, byId) {
  const panel = document.getElementById('panel');
  let current = null;

  const options = (selected) => locations
    .slice().sort((a, b) => a.name.localeCompare(b.name))
    .map((l) => `<option value="${l.id}" ${l.id === selected ? 'selected' : ''}>${l.name}</option>`).join('');

  function open(id) {
    const l = byId.get(id);
    if (!l) return;
    current = id;
    const cat = CATEGORIES[l.category] || CATEGORIES.service;
    const a = l.accessibility;
    panel.innerHTML = `
      <div class="panel-head">
        <p class="panel-cat" style="--pin:${cat.color}">${cat.icon} ${cat.label}${l.verified ? '' : ' · <span class="tag">draft data</span>'}</p>
        <h2 class="panel-title">${l.name}</h2>
        <button type="button" class="btn btn-icon panel-close" data-action="close-panel" aria-label="Close details">✕</button>
      </div>
      ${l.photos[0] ? `<img class="panel-photo" src="${l.photos[0]}" alt="${l.name}" loading="lazy" />` : ''}
      ${l.description ? `<p>${l.description}</p>` : ''}
      ${l.hours ? `<p><strong>Hours</strong> ${l.hours}</p>` : ''}
      ${l.floors.length ? `<details><summary>What's inside</summary>${l.floors.map((f) => `<p class="dir-floor">Floor ${f.level}</p><ul>${f.rooms.map((r) => `<li>${r.code ? `<code>${r.code}</code> ` : ''}${r.name}${r.accessible ? ' ♿' : ''}</li>`).join('')}</ul>`).join('')}</details>` : ''}
      <section class="a11y-card" aria-labelledby="a11y-h">
        <h3 id="a11y-h">♿ Accessibility</h3>
        <dl>
          <dt>Step-free entrance</dt><dd>${fmt(a.stepFreeEntrance)}</dd>
          <dt>Ramp</dt><dd>${fmt(a.ramp)}</dd>
          <dt>Lift</dt><dd>${fmt(a.lift)}</dd>
          <dt>Accessible washroom</dt><dd>${fmt(a.accessibleWashroom)}</dd>
        </dl>
        ${a.notes ? `<p class="a11y-notes">${a.notes}</p>` : ''}
      </section>
      <form class="directions" id="directions-form">
        <h3>Directions</h3>
        <label>From <select name="from">${options(id === 'main_gate' ? 'annapurna' : 'main_gate')}</select></label>
        <label class="check"><input type="checkbox" name="accessible" /> Step-free route only</label>
        <div class="row">
          <button type="submit" class="btn">Show route</button>
          <button type="button" class="btn btn-ghost" data-action="share">🔗 Share</button>
        </div>
      </form>`;
    panel.hidden = false;
    requestAnimationFrame(() => panel.classList.add('is-open'));

    panel.querySelector('#directions-form').addEventListener('submit', (e) => {
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
