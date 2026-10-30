import * as THREE from 'three';

// The "ghost guide": a little low-poly ghost that floats just in front of the camera during the tour.
export function createGhost() {
  const g = new THREE.Group();
  g.name = 'GhostMascot';
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xb7a6ff, emissiveIntensity: 0.35, roughness: 0.4, transparent: true, opacity: 0.92 });

  const pts = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    pts.push(new THREE.Vector2(0.5 * Math.sin(Math.min(1, t * 1.8) * Math.PI / 2), 1 - t * 1.1));
  }
  pts.push(new THREE.Vector2(0.55, -0.3));
  const body = new THREE.LatheGeometry(pts, 20);
  // wavy hem
  const pos = body.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    if (pos.getY(i) < -0.15) {
      const a = Math.atan2(pos.getZ(i), pos.getX(i));
      pos.setY(i, pos.getY(i) + Math.sin(a * 5) * 0.08);
    }
  }
  body.computeVertexNormals();
  g.add(new THREE.Mesh(body, mat));

  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x1b1530 });
  for (const x of [-0.17, 0.17]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), eyeMat);
    eye.scale.set(1, 1.4, 0.6);
    eye.position.set(x, 0.55, 0.42);
    g.add(eye);
  }
  g.scale.setScalar(0.7);
  return g;
}
