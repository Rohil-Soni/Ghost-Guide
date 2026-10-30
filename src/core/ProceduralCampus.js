import * as THREE from 'three';
import { mulberry32, distToSegment2, pointInPolygon } from '../utils/math.js';

// Placeholder campus built from code until `public/models/campus.opt.glb` is exported from
// Jaypee_Map.blend. All coordinates are Blender X/Y (read off model_topdown.png); shapes are drawn
// in the XY plane and rotated -90° about X, which is exactly the Blender→three remap (x, z, -y).

export const GROUND = { minX: -85.6, maxX: 85.6, minY: -86, maxY: 21.5 };

const ROADS = [
  // west loop round the lake
  [[-52, -32], [-50, -15], [-47, -2], [-42, 7], [-33, 10], [-25, 7], [-17, 5]],
  // north loop
  [[-17, 5], [-10, 12], [-5, 17], [0, 18.5], [15, 18.5], [32, 18.5], [47, 17], [49, 10], [49, 0], [48, -8], [47, -15], [48, -30], [45, -40]],
  // far north-east loop
  [[49, 8], [56, 10], [64, 9], [66, 2], [63, -5], [55, -6], [49, -4]],
  // central diagonal
  [[-17, 5], [-8, -4], [0, -12], [8, -18], [15, -25], [23, -33], [30, -40]],
  // south loop
  [[-52, -32], [-50, -45], [-45, -55], [-36, -62], [-20, -70], [0, -78], [6, -79], [12, -72], [20, -58], [27, -47], [30, -40], [45, -40]],
  // south-east road
  [[6, -79], [20, -77], [35, -76], [50, -74], [65, -71], [80, -67], [84, -64]],
  // east road
  [[50, -74], [50, -55], [50, -42], [48, -30]],
  // ring round H17–21 / Annapurna
  [[22, -12], [28, -6], [36, -6], [42, -9], [47, -15]],
  [[22, -12], [15, -25]],
  [[32, 18.5], [30, 8], [28, -6]],
  // gate spur to A-B Road
  [[-52, -32], [-58, -30], [-64, -27]],
  // helipad spur + lake path
  [[-36, -62], [-28, -50], [-21, -41]],
  [[-50, -30], [-40, -32], [-30, -37], [-25, -37]],
  // east spurs
  [[48, -30], [54, -30], [57, -29]],
  [[47, -15], [54, -16]],
  // footpaths between hostels
  [[-5, 17], [0, 8], [8, 0], [15, 18.5]],
  [[8, 0], [0, -12]],
  [[15, -25], [30, -27], [30, -40]],
  [[30, -27], [22, -12]],
  // residence streets
  [[-20, -45], [5, -50], [20, -58]],
  [[-12, -48], [-14, -62]], [[-4, -49], [-6, -66]], [[4, -50], [2, -70]],
];

const HIGHWAY = [[-86, -62], [-76, -30], [-64, 0], [-55, 22]];

const LAKE = [[-38, 6], [-33, 7], [-29, 4], [-28, -4], [-26, -12], [-23, -20], [-22, -27], [-24, -33], [-29, -35],
  [-36, -34], [-38, -30], [-33, -27], [-31, -21], [-34, -15], [-37, -8], [-40, -1]];

// Building recipes keyed by location id. h = height in units (~0.4 / floor).
const HOSTELS = {
  hostel_h01: [-7, 5, 10], hostel_h02: [-3, 5, 10], hostel_h03: [-1, 1, 70],
  hostel_h04: [2, -4, 10], hostel_h05: [7, -4, 10], hostel_h06: [8, -9, 70],
  hostel_h07: [11, 5, 10], hostel_h08: [16, 5, 10], hostel_h09: [17, 1, 70],
  hostel_h10: [22, -20, 10], hostel_h11: [27, -20, 10], hostel_h12: [28, -25, 70],
  hostel_h14: [33, -29, 10], hostel_h15: [38, -29, 10], hostel_h16: [39, -34, 70],
  hostel_h17: [30, -11, 10], hostel_h18: [35, -11, 10], hostel_h19: [37, -16, 70], hostel_h20: [40, -18, 10], hostel_h21: [41, -22, 70],
};

const COLORS = {
  building: 0xedebe6, roof: 0xdedad2, road: 0x9a9a9a, highway: 0x8a8370,
  ground: 0xb7a58a, outer: 0x1c1a24, lake: 0x1d3446, grass: 0x6f8f4e, tree: 0x4e7a3a,
};

function rectShape(cx, cy, w, d, rotDeg = 0) {
  const r = THREE.MathUtils.degToRad(rotDeg), c = Math.cos(r), s = Math.sin(r);
  const pts = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]]
    .map(([x, y]) => new THREE.Vector2(cx + x * c - y * s, cy + x * s + y * c));
  return new THREE.Shape(pts);
}

function yShape(cx, cy, rotDeg, L = 2.7, w = 1.3) {
  const pts = [];
  const j = w / Math.sqrt(3);
  for (let k = 0; k < 3; k++) {
    const a = THREE.MathUtils.degToRad(rotDeg + k * 120);
    const u = [Math.cos(a), Math.sin(a)], n = [-u[1], u[0]];
    pts.push(new THREE.Vector2(cx + L * u[0] - (w / 2) * n[0], cy + L * u[1] - (w / 2) * n[1]));
    pts.push(new THREE.Vector2(cx + L * u[0] + (w / 2) * n[0], cy + L * u[1] + (w / 2) * n[1]));
    const b = a + Math.PI / 3;
    pts.push(new THREE.Vector2(cx + j * Math.cos(b), cy + j * Math.sin(b)));
  }
  return new THREE.Shape(pts);
}

function extrude(shapes, height, mat) {
  const geo = new THREE.ExtrudeGeometry(shapes, { depth: height, bevelEnabled: false });
  geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}

function flat(shapes, y, mat) {
  const geo = new THREE.ShapeGeometry(shapes);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, y, 0);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  return mesh;
}

// Flat ribbon along a polyline (Blender XY), merged into one geometry for one draw call.
function ribbonGeometry(lines, width, y) {
  const pos = [], idx = [];
  for (const line of lines) {
    const start = pos.length / 3;
    for (let i = 0; i < line.length; i++) {
      const p = line[i], a = line[Math.max(0, i - 1)], b = line[Math.min(line.length - 1, i + 1)];
      let dx = b[0] - a[0], dy = b[1] - a[1];
      const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
      const nx = -dy * width / 2, ny = dx * width / 2;
      pos.push(p[0] + nx, y, -(p[1] + ny), p[0] - nx, y, -(p[1] - ny));
      if (i > 0) {
        const k = start + (i - 1) * 2;
        idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
      }
    }
    // round-ish caps so junctions don't show gaps
    for (const p of [line[0], line[line.length - 1]]) {
      const c = pos.length / 3, seg = 12;
      pos.push(p[0], y, -p[1]);
      for (let s = 0; s <= seg; s++) {
        const t = (s / seg) * Math.PI * 2;
        pos.push(p[0] + Math.cos(t) * width / 2, y, -(p[1] + Math.sin(t) * width / 2));
      }
      for (let s = 0; s < seg; s++) idx.push(c, c + 2 + s, c + 1 + s);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

function buildingMat(color = COLORS.building) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0 });
}

function makeLoc(id, ...children) {
  const g = new THREE.Group();
  g.name = `LOC_${id}`;
  g.userData.locId = id;
  children.forEach((c) => g.add(c));
  return g;
}

function buildLocations() {
  const out = [];
  for (const [id, [x, y, rot]] of Object.entries(HOSTELS)) {
    out.push(makeLoc(id, extrude(yShape(x, y, rot), 1.6, buildingMat())));
  }

  // Annapurna: block with an open courtyard
  const ann = rectShape(28, -1, 9, 7, 8);
  ann.holes.push(new THREE.Path(rectShape(28, -1, 4.5, 3, 8).getPoints().reverse()));
  out.push(makeLoc('annapurna', extrude(ann, 1.4, buildingMat(0xf3e9dc))));

  out.push(makeLoc('block_ne', extrude(rectShape(40, 5, 13, 3, 3), 1.2, buildingMat())));
  out.push(makeLoc('block_central', extrude(rectShape(17, -14, 6, 6, 45), 1.8, buildingMat())));

  out.push(makeLoc('academic',
    extrude(rectShape(1, -24, 7, 4, -35), 2.0, buildingMat()),
    extrude(rectShape(6, -30, 8, 4, -35), 2.0, buildingMat()),
    extrude(rectShape(-3, -31, 4, 4, -35), 1.6, buildingMat()),
    extrude(rectShape(10, -23, 4, 6, -35), 1.6, buildingMat()),
  ));

  out.push(makeLoc('hall_south', extrude(rectShape(18, -47, 7, 9, -35), 1.8, buildingMat(0xf7f7f4))));
  out.push(makeLoc('civil_dept',
    extrude(rectShape(57, -14, 3, 8, 0), 1.2, buildingMat(0xd8a48f)),
    extrude(rectShape(57, -21, 3, 5, 0), 1.2, buildingMat(0xd8a48f))));

  const court = flat(rectShape(55, -38, 6, 4, 0), 0.05, new THREE.MeshStandardMaterial({ color: 0x3f8f6b, roughness: 0.9 }));
  const courtLine = flat(rectShape(55, -38, 0.15, 4, 0), 0.07, new THREE.MeshBasicMaterial({ color: 0xffffff }));
  out.push(makeLoc('handball', court, courtLine));

  // Faculty residences: small blocks along the streets
  const res = [];
  const rng = mulberry32(7);
  for (let i = 0; i < 26; i++) {
    const x = -18 + (i % 9) * 3.6 + rng() * 0.6, y = -52 - Math.floor(i / 9) * 5 - rng() * 0.6;
    res.push(extrude(rectShape(x, y, 2.2, 1.6, -10), 0.8 + rng() * 0.4, buildingMat(0xe9e2d6)));
  }
  out.push(makeLoc('faculty_res', ...res));

  // Helipad: pad disk + "H"
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 0.12, 40), new THREE.MeshStandardMaterial({ color: 0x8c8c8c, roughness: 0.9 }));
  pad.position.set(-21, 0.06, 38); pad.receiveShadow = true;
  const ring = new THREE.Mesh(new THREE.RingGeometry(2.4, 2.7, 40), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  ring.rotation.x = -Math.PI / 2; ring.position.set(-21, 0.14, 38);
  const H = flat([rectShape(-21.7, -38, 0.3, 2, 0), rectShape(-20.3, -38, 0.3, 2, 0), rectShape(-21, -38, 1.4, 0.3, 0)], 0.14,
    new THREE.MeshBasicMaterial({ color: 0xffffff }));
  out.push(makeLoc('helipad', pad, ring, H));

  // Main gate: two pillars + beam over the spur road
  const gm = buildingMat(0xc9b79c);
  const pillarA = extrude(rectShape(-58.3, -28.4, 0.8, 0.8), 1.6, gm);
  const pillarB = extrude(rectShape(-57.7, -31.6, 0.8, 0.8), 1.6, gm);
  const beam = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 4), gm);
  beam.position.set(-58, 1.6, 30); beam.rotation.y = -0.18; beam.castShadow = true;
  out.push(makeLoc('main_gate', pillarA, pillarB, beam));

  const lake = flat(new THREE.Shape(LAKE.map(([x, y]) => new THREE.Vector2(x, y))), 0.04,
    new THREE.MeshStandardMaterial({ color: COLORS.lake, roughness: 0.45, metalness: 0 }));
  out.push(makeLoc('lake', lake));
  return out;
}

function buildTrees(blocked) {
  const rng = mulberry32(42);
  const roadSegs = [];
  for (const l of [...ROADS, HIGHWAY]) for (let i = 1; i < l.length; i++) roadSegs.push([...l[i - 1], ...l[i]]);
  const spots = [];
  for (let tries = 0; tries < 6000 && spots.length < 420; tries++) {
    const x = THREE.MathUtils.lerp(GROUND.minX + 2, GROUND.maxX - 2, rng());
    const y = THREE.MathUtils.lerp(GROUND.minY + 2, GROUND.maxY - 2, rng());
    if (pointInPolygon(x, y, LAKE)) continue;
    if (roadSegs.some(([ax, ay, bx, by]) => distToSegment2(x, y, ax, ay, bx, by) < 4)) continue;
    if (blocked.some(([bx, by, r]) => (x - bx) ** 2 + (y - by) ** 2 < r * r)) continue;
    spots.push([x, y]);
  }
  const geo = new THREE.ConeGeometry(0.7, 1.8, 6);
  geo.translate(0, 0.9, 0);
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: COLORS.tree, roughness: 1, flatShading: true }), spots.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  const tint = new THREE.Color();
  spots.forEach(([x, y], i) => {
    const k = 0.7 + rng() * 0.7;
    s.set(k, k * (0.8 + rng() * 0.5), k);
    p.set(x, 0, -y);
    mesh.setMatrixAt(i, m.compose(p, q, s));
    mesh.setColorAt(i, tint.setHSL(0.27 + rng() * 0.06, 0.35, 0.25 + rng() * 0.12));
  });
  mesh.castShadow = true;
  mesh.name = 'ENV_trees';
  return mesh;
}

export function buildProceduralCampus({ groundTexture } = {}) {
  const root = new THREE.Group();
  root.name = 'ProceduralCampus';

  const w = GROUND.maxX - GROUND.minX, d = GROUND.maxY - GROUND.minY;
  const cz = -(GROUND.maxY + GROUND.minY) / 2;
  const groundMat = new THREE.MeshStandardMaterial({ color: groundTexture ? 0xffffff : COLORS.ground, roughness: 1, map: groundTexture || null });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(w, d), groundMat);
  ground.rotation.x = -Math.PI / 2; ground.position.set(0, 0, cz);
  ground.receiveShadow = true; ground.name = 'ENV_ground';
  root.add(ground);

  // Large dark surround so the map fades into fog instead of ending abruptly.
  const outer = new THREE.Mesh(new THREE.CircleGeometry(420, 64), new THREE.MeshStandardMaterial({ color: COLORS.outer, roughness: 1 }));
  outer.rotation.x = -Math.PI / 2; outer.position.set(0, -0.05, cz); outer.name = 'ENV_outer';
  root.add(outer);

  if (!groundTexture) {
    const roads = new THREE.Mesh(ribbonGeometry(ROADS, 1.9, 0.03), new THREE.MeshStandardMaterial({ color: COLORS.road, roughness: 0.95 }));
    roads.receiveShadow = true; roads.name = 'ENV_road';
    root.add(roads);
    const hw = new THREE.Mesh(ribbonGeometry([HIGHWAY], 6, 0.025), new THREE.MeshStandardMaterial({ color: COLORS.highway, roughness: 0.95 }));
    hw.name = 'ENV_highway';
    root.add(hw);
  }

  const locs = buildLocations();
  locs.forEach((l) => root.add(l));

  const blocked = [
    ...Object.values(HOSTELS).map(([x, y]) => [x, y, 4]),
    [28, -1, 7], [40, 5, 8], [17, -14, 6], [4, -27, 10], [18, -47, 8], [57, -17, 6], [55, -38, 5],
    [-21, -38, 5], [-58, -30, 5], [-4, -57, 16],
  ];
  root.add(buildTrees(blocked));
  return root;
}
