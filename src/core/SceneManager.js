import * as THREE from 'three';
import { buildProceduralCampus } from './ProceduralCampus.js';
import { loadCampusGLB, loadGroundTexture } from './Assets.js';
import { lowEnd } from './Renderer.js';

const ACCENT = new THREE.Color('#7C5CFF');

export class SceneManager {
  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#0f0e17');
    if (!lowEnd) this.scene.fog = new THREE.Fog('#0f0e17', 140, 380);
    this.locObjects = new Map(); // locId -> Object3D
    this.pickables = [];
    this.highlighted = new Set();
    this.hovered = null;
    this.source = 'procedural';
    this.addLights();
  }

  addLights() {
    this.scene.add(new THREE.HemisphereLight('#dfe8ff', '#4a3f35', 1.4));
    const sun = new THREE.DirectionalLight('#fff3e0', 2.4);
    sun.position.set(-60, 90, -40);
    sun.target.position.set(0, 0, 30);
    sun.castShadow = !lowEnd;
    Object.assign(sun.shadow.camera, { left: -110, right: 110, top: 80, bottom: -80, near: 10, far: 260 });
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.04;
    this.scene.add(sun, sun.target);
  }

  async load(onProgress) {
    let root = null;
    try { root = await loadCampusGLB(onProgress); } catch (err) { console.warn('campus.opt.glb failed, using procedural campus', err); }
    if (root) {
      this.source = 'glb';
    } else {
      const groundTexture = await loadGroundTexture().catch(() => null);
      root = buildProceduralCampus({ groundTexture });
    }
    this.scene.add(root);
    this.index(root);
    return root;
  }

  // Find every LOC_<id> object (glTF keeps Blender names) and give it its own materials for highlighting.
  index(root) {
    root.traverse((o) => {
      const m = o.name?.match(/^LOC_([\w-]+?)(?:[._]\d+)?$/);
      if (m && !this.locObjects.has(m[1])) {
        const id = m[1];
        this.locObjects.set(id, o);
        o.traverse((c) => {
          c.userData.locId = id;
          if (c.isMesh) {
            c.material = c.material.clone();
            c.userData.baseEmissive = c.material.emissive?.clone();
            this.pickables.push(c);
          }
        });
      } else if (o.isMesh && !o.name.startsWith('ENV_')) {
        o.castShadow = o.receiveShadow = !lowEnd;
      }
    });
  }

  boundsOf(id) {
    const o = this.locObjects.get(id);
    return o ? new THREE.Box3().setFromObject(o) : null;
  }

  heightOf(id) {
    const b = this.boundsOf(id);
    return b ? b.max.y : 0;
  }

  applyMaterialState() {
    for (const [id, obj] of this.locObjects) {
      const on = this.highlighted.has(id), hover = this.hovered === id;
      obj.traverse((c) => {
        if (!c.isMesh || !c.material.emissive) return;
        c.material.emissive.copy(on || hover ? ACCENT : c.userData.baseEmissive);
        c.material.emissiveIntensity = on ? 0.55 : hover ? 0.3 : 1;
      });
    }
  }

  highlight(ids = []) {
    this.highlighted = new Set(ids);
    this.applyMaterialState();
  }

  hover(id) {
    if (this.hovered === id) return false;
    this.hovered = id;
    this.applyMaterialState();
    return true;
  }
}
