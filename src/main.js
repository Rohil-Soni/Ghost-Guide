import * as THREE from 'three';
import gsap from 'gsap';
import './styles/base.css';
import './styles/tour.css';
import './styles/explore.css';

import { loadData, shotFor, CATEGORIES } from './data/store.js';
import { bus } from './utils/events.js';
import { readLocFromHash, setLocHash } from './utils/url.js';
import { hasWebGL, createRenderer } from './core/Renderer.js';
import { SceneManager } from './core/SceneManager.js';
import { CameraRig } from './core/CameraRig.js';
import { GROUND } from './core/ProceduralCampus.js';
import { TourPath } from './story/TourPath.js';
import { buildChapters } from './story/Chapters.js';
import { ScrollEngine } from './story/ScrollEngine.js';
import { createGhost } from './story/Mascot.js';
import { Pins } from './explore/Pins.js';
import { Picking } from './explore/Picking.js';
import { Router, walkMinutes } from './explore/Router.js';
import { RouteLine } from './explore/RouteLine.js';
import { initSearch } from './ui/Search.js';
import { initDirectory } from './ui/Directory.js';
import { initPanel } from './ui/Panel.js';
import { initLoader } from './ui/Loader.js';

const OVERVIEW = { pos: new THREE.Vector3(0, 120, 95), target: new THREE.Vector3(0, 0, 30) };
const $ = (s) => document.querySelector(s);

let reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
try { reducedMotion ||= localStorage.getItem('gg-reduce-motion') === '1'; } catch {}

async function boot() {
  const data = await loadData();
  const { locations, chapters, byId } = data;

  initDirectory(locations);
  initSearch(locations);
  const panel = initPanel(locations, byId);
  wireActions();

  if (!hasWebGL()) return fallback2D(locations);

  const loader = initLoader();
  const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.5, 900);
  camera.position.copy(OVERVIEW.pos);
  const { renderer, labels, resize } = createRenderer($('#webgl'), $('#labels'));
  resize(camera);

  const sm = new SceneManager();
  try {
    await sm.load((p) => loader.progress(p * 0.9));
  } catch (err) {
    console.error(err);
    loader.done();
    return fallback2D(locations);
  }

  const rig = new CameraRig(camera, renderer.domElement);
  rig.reducedMotion = reducedMotion;
  const chapterUI = buildChapters($('#tour'), chapters);
  const tour = new TourPath(chapters.map((c) => c.shot ?? serialiseShot(shotFor(byId.get(c.locationIds[0])))));
  rig.setTour(tour);

  const pins = new Pins(sm.scene, locations, sm);
  const picking = new Picking(camera, renderer.domElement, sm, $('#tooltip'), byId);
  const router = new Router(data.nav, byId);
  const routeLine = new RouteLine(sm.scene);
  const ghost = createGhost();
  sm.scene.add(ghost);
  buildLayerToggles(pins, () => invalidate());

  let mode = 'story';
  let dirty = true;
  const invalidate = () => { dirty = true; };
  picking.onChange = invalidate;

  // ---- Story mode -------------------------------------------------------
  let lastChapter = -1;
  const onProgress = (p) => {
    if (mode !== 'story') return;
    rig.setStoryProgress(p);
    const { index, local } = tour.chapterAt(p);
    const show = index === 0 || local > 0.3 ? index : -1;
    chapterUI.setActive(show);
    if (index !== lastChapter) {
      lastChapter = index;
      const ids = chapters[index]?.locationIds ?? [];
      sm.highlight(ids);
      pins.setStoryIds(ids);
    }
  };
  const scroll = new ScrollEngine({ onProgress, onReduce: () => enterExplore({ instant: true }) });

  // ---- Explore mode -----------------------------------------------------
  function enterExplore({ instant = reducedMotion, focus = null } = {}) {
    if (mode !== 'explore') {
      mode = 'explore';
      document.body.classList.replace('mode-story', 'mode-explore') || document.body.classList.add('mode-explore');
      scroll.stop();
      chapterUI.setActive(-1);
      sm.highlight([]);
      pins.setMode('explore');
      picking.setEnabled(true);
      ghost.visible = false;
      window.scrollTo(0, 0);
    }
    if (focus) focusLocation(focus, { instant });
    else rig.flyTo(OVERVIEW, { instant, onDone: invalidate });
    invalidate();
  }

  function replayTour() {
    panel.close();
    clearRoute();
    mode = 'story';
    document.body.classList.replace('mode-explore', 'mode-story');
    pins.setMode('story');
    pins.setSelected(null);
    picking.setEnabled(false);
    ghost.visible = true;
    rig.setMode('story');
    rig.u = rig.targetU = 0;
    lastChapter = -1;
    scroll.start();
    onProgress(0);
  }

  function focusLocation(id, { instant = reducedMotion } = {}) {
    const loc = byId.get(id);
    if (!loc) return;
    const target = loc.mapLoc?.id ?? null;
    sm.highlight(target ? [target] : []);
    pins.setSelected(target);
    bus.emit('panel:open', id);
    setLocHash(id);
    bus.emit('directory:close');
    const shot = shotFor(loc);
    if (shot) rig.flyTo(shot, { instant, onDone: invalidate });
    else invalidate();
  }

  function clearRoute() {
    routeLine.clear();
    $('#route-info').hidden = true;
    invalidate();
  }

  bus.on('select', (id) => (mode === 'explore' ? focusLocation(id) : enterExplore({ focus: id })));
  bus.on('mode:explore', () => enterExplore());
  bus.on('mode:story', replayTour);
  bus.on('panel:closed', () => {
    sm.highlight([]);
    pins.setSelected(null);
    setLocHash(null);
    clearRoute();
  });
  bus.on('route', ({ from, to, accessible }) => {
    const info = $('#route-info');
    const r = router.route(from, to, { accessible });
    info.hidden = false;
    if (!r) {
      routeLine.clear();
      info.innerHTML = `<strong>No ${accessible ? 'step-free ' : ''}route found</strong> between these places yet.`;
      return invalidate();
    }
    const box = routeLine.show(r.points);
    sm.highlight([byId.get(from).mapLoc.id, byId.get(to).mapLoc.id]);
    info.innerHTML = `<strong>${byId.get(from).name} → ${byId.get(to).name}</strong>
      <span>${Math.round(r.metres / 10) * 10} m · ~${walkMinutes(r.metres, accessible)} min ${accessible ? '♿ step-free' : 'walk'}</span>
      <button type="button" class="btn btn-ghost btn-small" data-action="clear-route">Clear</button>`;
    rig.frameBox(box, { onDone: invalidate });
  });
  bus.on('route:clear', clearRoute);
  bus.on('motion', (on) => {
    reducedMotion = rig.reducedMotion = on;
    if (on && mode === 'story') enterExplore({ instant: true });
  });

  // ---- Render loop --------------------------------------------------------
  const timer = new THREE.Timer();
  timer.connect(document);
  const tmpDir = new THREE.Vector3(), tmpRight = new THREE.Vector3();

  function render() {
    renderer.render(sm.scene, camera);
    pins.update(camera);
    labels.render(sm.scene, camera);
    dirty = false;
  }

  gsap.ticker.add((t) => {
    timer.update();
    const dt = Math.min(timer.getDelta(), 0.1);
    const elapsed = timer.getElapsed();
    const moving = rig.update(dt, elapsed);

    if (mode === 'story') {
      // The ghost floats a little ahead and to the right of the camera.
      camera.getWorldDirection(tmpDir);
      tmpRight.crossVectors(tmpDir, camera.up).normalize();
      ghost.position.copy(camera.position).addScaledVector(tmpDir, 10).addScaledVector(tmpRight, 3.2);
      ghost.position.y += -1.6 + Math.sin(elapsed * 2) * 0.25;
      ghost.lookAt(camera.position);
      ghost.rotation.z += Math.sin(elapsed * 1.3) * 0.08;
    }
    const animating = routeLine.update(elapsed);
    if (mode !== 'explore' || moving || animating || dirty) render();
  });

  // Keep the focused building centred in the space left of the detail panel (desktop only).
  const view = { x: 0 };
  const applyView = () => {
    if (view.x) camera.setViewOffset(innerWidth, innerHeight, view.x, 0, innerWidth, innerHeight);
    else camera.clearViewOffset();
    invalidate();
  };
  const setPanelOffset = (open) => {
    const x = open && innerWidth > 760 ? 200 : 0;
    gsap.to(view, { x, duration: reducedMotion ? 0 : 0.5, ease: 'power2.out', onUpdate: applyView });
  };
  bus.on('panel:open', () => setPanelOffset(true));
  bus.on('panel:closed', () => setPanelOffset(false));

  addEventListener('resize', () => { resize(camera); applyView(); });

  loader.done();
  document.body.classList.replace('mode-loading', 'mode-story');

  const deepLink = readLocFromHash();
  if (deepLink && byId.has(deepLink)) enterExplore({ instant: true, focus: deepLink });
  else if (reducedMotion || new URLSearchParams(location.search).get('mode') === 'explore') enterExplore({ instant: true });
  addEventListener('hashchange', () => {
    const id = readLocFromHash();
    if (id && byId.has(id) && id !== panel.current) bus.emit('select', id);
  });

  // Exposed for debugging in the console.
  window.__gg = { sm, rig, router, data };
}

function serialiseShot({ pos, target }) {
  return { pos: pos.toArray(), target: target.toArray() };
}

function buildLayerToggles(pins, onChange) {
  const box = $('#layers');
  const used = [...new Set(pins.items.map((i) => i.loc.category))];
  box.innerHTML = used.map((c) => `<button type="button" class="chip" aria-pressed="true" data-cat="${c}" style="--pin:${CATEGORIES[c]?.color}">${CATEGORIES[c]?.icon ?? ''} ${CATEGORIES[c]?.label ?? c}</button>`).join('');
  box.addEventListener('click', (e) => {
    const b = e.target.closest('.chip');
    if (!b) return;
    const on = b.getAttribute('aria-pressed') !== 'true';
    b.setAttribute('aria-pressed', String(on));
    pins.toggleLayer(b.dataset.cat, on);
    onChange();
  });
}

function wireActions() {
  const motionBtn = $('#btn-motion');
  motionBtn.setAttribute('aria-pressed', String(reducedMotion));
  motionBtn.addEventListener('click', () => {
    reducedMotion = !reducedMotion;
    motionBtn.setAttribute('aria-pressed', String(reducedMotion));
    try { localStorage.setItem('gg-reduce-motion', reducedMotion ? '1' : '0'); } catch {}
    bus.emit('motion', reducedMotion);
  });

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const action = el.dataset.action;
    if (['explore', 'replay-tour', 'open-directory', 'close-directory', 'close-panel', 'focus', 'clear-route'].includes(action)) e.preventDefault();
    switch (action) {
      case 'explore': bus.emit('mode:explore'); break;
      case 'replay-tour': bus.emit('mode:story'); break;
      case 'open-directory': bus.emit('directory:open'); break;
      case 'close-directory': bus.emit('directory:close'); break;
      case 'close-panel': bus.emit('panel:close'); break;
      case 'focus': bus.emit('select', el.dataset.loc); break;
      case 'clear-route': bus.emit('route:clear'); break;
    }
  });
}

// No WebGL: static 2D map with % positioned pins, plus the full directory and search.
function fallback2D(locations) {
  document.body.className = 'mode-fallback';
  $('#fallback').hidden = false;
  $('#loader')?.remove();
  const map = $('#fallback-map');
  const w = GROUND.maxX - GROUND.minX, d = GROUND.maxY - GROUND.minY;
  map.style.aspectRatio = `${w} / ${d}`;
  map.style.backgroundImage = `url(${import.meta.env.BASE_URL}fallback/campus-2d.webp)`;
  map.innerHTML = locations.filter((l) => l.anchor).map((l) => {
    const left = ((l.anchor[0] - GROUND.minX) / w) * 100;
    const top = ((GROUND.maxY + l.anchor[2]) / d) * 100;
    const cat = CATEGORIES[l.category] || CATEGORIES.service;
    return `<button type="button" class="pin pin--flat" style="left:${left}%;top:${top}%;--pin:${cat.color}" data-action="focus" data-loc="${l.id}" aria-label="${l.name}"><span class="pin-icon" aria-hidden="true">${cat.icon}</span></button>`;
  }).join('');
  bus.on('select', (id) => {
    bus.emit('panel:open', id);
    setLocHash(id);
  });
  bus.on('route', () => {
    const info = $('#route-info');
    info.hidden = false;
    info.textContent = 'Walking directions need the 3D view.';
  });
  const id = readLocFromHash();
  if (id) bus.emit('select', id);
}

boot().catch((err) => {
  console.error(err);
  document.body.classList.add('mode-error');
  const l = $('#loader .loader-text');
  if (l) l.textContent = 'Could not load campus data. Please refresh.';
});
