import * as THREE from 'three';
import { bus } from '../utils/events.js';

// Raycast hover/click on LOC_ meshes. A click is ignored if the pointer moved (that was a pan).
export class Picking {
  constructor(camera, dom, sceneManager, tooltipEl, byId) {
    this.camera = camera;
    this.sm = sceneManager;
    this.enabled = false;
    this.ray = new THREE.Raycaster();
    this.ndc = new THREE.Vector2();
    this.down = null;
    this.onChange = null;

    dom.addEventListener('pointermove', (e) => {
      if (!this.enabled || e.pointerType === 'touch') return;
      const id = this.pick(e);
      if (this.sm.hover(id)) this.onChange?.();
      dom.style.cursor = id ? 'pointer' : '';
      if (id) {
        tooltipEl.textContent = byId.get(id)?.name ?? id;
        tooltipEl.style.transform = `translate(${e.clientX + 14}px, ${e.clientY + 12}px)`;
        tooltipEl.hidden = false;
      } else tooltipEl.hidden = true;
    });
    dom.addEventListener('pointerleave', () => { tooltipEl.hidden = true; });
    dom.addEventListener('pointerdown', (e) => { this.down = [e.clientX, e.clientY]; });
    dom.addEventListener('pointerup', (e) => {
      if (!this.enabled || !this.down) return;
      const moved = Math.hypot(e.clientX - this.down[0], e.clientY - this.down[1]);
      this.down = null;
      if (moved > 6) return;
      const id = this.pick(e);
      if (id) bus.emit('select', id);
    });
  }

  pick(e) {
    this.ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    this.ray.setFromCamera(this.ndc, this.camera);
    const hit = this.ray.intersectObjects(this.sm.pickables, false)[0];
    return hit?.object.userData.locId ?? null;
  }

  setEnabled(on) {
    this.enabled = on;
    if (!on && this.sm.hover(null)) this.onChange?.();
  }
}
