import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const base = import.meta.env.BASE_URL;
export const manager = new THREE.LoadingManager();

const gltf = new GLTFLoader(manager);
gltf.setMeshoptDecoder(MeshoptDecoder);

// HEAD first so a missing model is a quiet fallback rather than a console error from the loader.
async function exists(url) {
  try {
    const res = await fetch(url, { method: 'HEAD' });
    const type = res.headers.get('content-type') || '';
    return res.ok && !type.includes('text/html');
  } catch { return false; }
}

export async function loadCampusGLB(onProgress) {
  const url = `${base}models/campus.opt.glb`;
  if (!(await exists(url))) return null;
  return new Promise((resolve, reject) => {
    gltf.load(url, (g) => resolve(g.scene), (e) => e.total && onProgress?.(e.loaded / e.total), reject);
  });
}

export async function loadGroundTexture() {
  const url = `${base}textures/campus-ground.webp`;
  if (!(await exists(url))) return null;
  const tex = await new THREE.TextureLoader(manager).loadAsync(url);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}
