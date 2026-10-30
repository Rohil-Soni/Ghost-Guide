import * as THREE from 'three';
import gsap from 'gsap';
import { MapControls } from 'three/addons/controls/MapControls.js';
import { GROUND } from './ProceduralCampus.js';

// The single owner of the camera. Only one mode drives it at a time: story | explore | flyto.
export class CameraRig {
  constructor(camera, dom) {
    this.camera = camera;
    this.mode = 'story';
    this.lookTarget = new THREE.Vector3(0, 0, 30);
    this.tour = null;
    this.u = 0;
    this.targetU = 0;
    this.reducedMotion = false;
    this.tween = null;

    const c = (this.controls = new MapControls(camera, dom));
    c.enableDamping = true;
    c.dampingFactor = 0.08;
    c.minDistance = 8;
    c.maxDistance = 190;
    c.maxPolarAngle = 1.2;
    c.screenSpacePanning = false;
    c.enabled = false;
    c.addEventListener('change', () => this.clampTarget());
  }

  clampTarget() {
    const t = this.controls.target, before = t.clone();
    t.x = THREE.MathUtils.clamp(t.x, GROUND.minX, GROUND.maxX);
    t.z = THREE.MathUtils.clamp(t.z, -GROUND.maxY, -GROUND.minY);
    t.y = 0;
    this.camera.position.add(t.clone().sub(before));
  }

  setTour(tour) { this.tour = tour; }

  setStoryProgress(p) {
    if (this.mode !== 'story' || !this.tour) return;
    this.targetU = this.tour.progressToU(p);
  }

  setMode(mode) {
    this.mode = mode;
    this.controls.enabled = mode === 'explore';
    if (mode !== 'flyto') this.tween?.kill();
  }

  // Returns true while the camera is moving (render-on-demand hint).
  update(dt, elapsed) {
    if (this.mode === 'story' && this.tour) {
      const prev = this.u;
      this.u = this.reducedMotion ? this.targetU : THREE.MathUtils.damp(this.u, this.targetU, 4, dt);
      this.tour.sample(this.u, this.camera.position, this.lookTarget, elapsed);
      this.camera.lookAt(this.lookTarget);
      return Math.abs(prev - this.u) > 1e-5;
    }
    if (this.mode === 'explore') return this.controls.update(dt);
    return this.mode === 'flyto';
  }

  flyTo({ pos, target }, { duration = 1.6, instant = this.reducedMotion, onDone } = {}) {
    this.setMode('flyto');
    const from = { p: this.camera.position.clone(), t: this.currentTarget() };
    const finish = () => {
      this.controls.target.copy(target);
      this.camera.position.copy(pos);
      this.camera.lookAt(target);
      this.setMode('explore');
      onDone?.();
    };
    if (instant) return finish();
    const s = { k: 0 };
    const tmpT = new THREE.Vector3();
    // Arc up a little mid-flight so long hops don't skim through buildings.
    const lift = Math.min(40, from.p.distanceTo(pos) * 0.25);
    this.tween = gsap.to(s, {
      k: 1, duration, ease: 'power2.inOut',
      onUpdate: () => {
        this.camera.position.lerpVectors(from.p, pos, s.k);
        this.camera.position.y += Math.sin(s.k * Math.PI) * lift;
        this.camera.lookAt(tmpT.lerpVectors(from.t, target, s.k));
      },
      onComplete: finish,
    });
  }

  currentTarget() {
    if (this.mode === 'explore') return this.controls.target.clone();
    if (this.mode === 'story') return this.lookTarget.clone();
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    const t = -this.camera.position.y / (dir.y || -1);
    return this.camera.position.clone().addScaledVector(dir, Math.max(5, t));
  }

  // Frame a bounding box from the current viewing direction.
  frameBox(box, opts) {
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3()).length();
    const dist = Math.max(25, size * 1.1);
    const pos = center.clone().add(new THREE.Vector3(0.35, 0.8, 0.5).normalize().multiplyScalar(dist));
    this.flyTo({ pos, target: center.setY(0) }, opts);
  }
}
