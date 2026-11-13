/* Peta provinsi 3D (Three.js r128, dimuat saat dibutuhkan).
   Provinsi datar, warna = kategori ISPU rata-rata; tiap stasiun berdiri sebagai tiang, tinggi = rata-rata PM2.5 stasiun.
   Zoom roda mengarah ke titik di bawah kursor. */
const THREE_URLS = ['https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
  'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js'];
let threeP = null, MAP3D = null, MAP3D_B = null;   // MAP3D = peta T1 di Ringkasan, MAP3D_B = peta jaringan (T5) di Ringkasan
function loadThree() {
  if (window.THREE && THREE.OrbitControls) return Promise.resolve();
  if (threeP) return threeP;
  const add = src => new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
  threeP = add(THREE_URLS[0]).then(() => add(THREE_URLS[1])).catch(e => { threeP = null; throw e; });
  return threeP;
}
function disposeMap3D(k) { if (k !== 'b' && MAP3D) { MAP3D.dispose(); MAP3D = null; } if (k !== 'a' && MAP3D_B) { MAP3D_B.dispose(); MAP3D_B = null; } }

function makeMap3D(host, o) {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true }); } catch (e) { return null; }
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const K = 20, LON0 = 118, LAT0 = -2.4, PX = (lon, lat) => [(lon - LON0) * K, (lat - LAT0) * K]; // shape-space: y ke utara
  const pv = r => o.pinVal ? o.pinVal(r) : r.mean, maxMean = o.pinMax || Math.max(60, ...o.rows.map(r => pv(r) || 0)), HS = 34 / maxMean, FLAT = 3.2;
  const dark = curTheme() === 'dark';
  const surf = new THREE.Color(cv('--surface'));
  const bg = dark ? '#1a2634' : '#e6eaf0', edge = dark ? '#0f1822' : '#ffffff', empty = new THREE.Color(cv('--muted')).lerp(surf, 0.8);
  const plinthCol = bg, gridCol = dark ? 0x2b3a4b : 0xc5cdd8;
  const soft = c => new THREE.Color(c).lerp(surf, 0.18); // = warna peta datar (isi 82% di atas latar)

  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setClearColor(bg, 1);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = true;   // bayangan hanya diperbarui saat ada perubahan, animasi hiasan tidak memicunya
  host.appendChild(renderer.domElement);
  const tip = document.createElement('div'); tip.className = 'tip3d'; tip.hidden = true; host.appendChild(tip);
  const hint = document.createElement('div'); hint.className = 'hint3d'; 

  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(32, 2, 1, 8000);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xffffff, 0.66));
  const sun = new THREE.DirectionalLight(0xffffff, 0.4);
  sun.position.set(-260, 720, 320); sun.castShadow = true; sun.shadow.radius = 4;
  Object.assign(sun.shadow.camera, { left: -600, right: 600, top: 400, bottom: -400, near: 10, far: 2000 });
  sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0006; scene.add(sun);
  // alas diorama: papan abu lembut dengan kisi tipis
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(2600, 10, 1800), new THREE.MeshStandardMaterial({ color: plinthCol, roughness: 0.95 }));
  plinth.position.set(0, -5.02, 2); plinth.receiveShadow = true; scene.add(plinth);
  const grid = new THREE.GridHelper(2600, 70, gridCol, gridCol); grid.scale.z = 1800 / 2600; grid.position.set(0, 0.06, 2);
  grid.material.transparent = true; grid.material.opacity = 0.55; scene.add(grid);

  // provinsi: satu grup per provinsi (beberapa poligon), bisa "tumbuh" lewat scale.y
  const provs = [], pick = [];
  for (const ft of PROV_GEO.features) {
    const name = ft.properties.name, a = o.agg[name], h = FLAT;
    const pc = o.provCol ? o.provCol(name) : null, color = pc ? new THREE.Color(pc[0]).lerp(surf, pc[1]) : o.provCol ? empty : a ? soft(ispuCol(a.mean)) : empty;
    const shapes = [], lines = [];
    for (const poly of ft.geometry.coordinates) {
      const r = poly[0], s = new THREE.Shape();
      r.forEach(([lon, lat], i) => { const [x, y] = PX(lon, lat); i ? s.lineTo(x, y) : s.moveTo(x, y); });
      shapes.push(s);
      for (let i = 1; i < r.length; i++) { const p = PX(...r[i - 1]), q = PX(...r[i]); lines.push(p[0], p[1], 0, q[0], q[1], 0); }
    }
    const geo = new THREE.ExtrudeGeometry(shapes, { depth: 1, bevelEnabled: false, curveSegments: 1 });
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0, emissive: 0x000000 });
    const mesh = new THREE.Mesh(geo, mat); mesh.castShadow = false; mesh.receiveShadow = true; mesh.userData = { prov: name };
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
    const border = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: edge, transparent: true, opacity: 0.9 }));
    border.position.z = 1.001; // tepat di atap provinsi (sebelum rotasi: sumbu z = tinggi)
    const g = new THREE.Group(); g.add(mesh, border); g.rotation.x = -Math.PI / 2;
    const P = { name, a, h, g, mat, cur: h };
    g.scale.z = P.cur; scene.add(g); provs.push(P); pick.push(mesh);
  }
  const provBy = Object.fromEntries(provs.map(p => [p.name, p]));

  // stasiun: tiang di atas provinsinya, tinggi = rata-rata PM2.5
  const pinGeo = new THREE.CylinderGeometry(2.6, 2.6, 1, 20); pinGeo.translate(0, 0.5, 0);
  const capGeo = new THREE.SphereGeometry(3.3, 22, 16), ringGeo = new THREE.RingGeometry(4.4, 6.6, 32); ringGeo.rotateX(-Math.PI / 2);
  const pins = o.rows.map(r => {
    const [x, y] = PX(r.s.lon, r.s.lat), P = provBy[r.s.prov], h = Math.max(3, (pv(r) || 0) * HS), col = o.pinCol ? o.pinCol(r) : ispuCol(r.mean);
    const mat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.55 });
    const m = new THREE.Mesh(pinGeo, mat), cap = new THREE.Mesh(capGeo, mat);
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 }));
    m.castShadow = cap.castShadow = true; m.userData = cap.userData = { code: r.code };
    scene.add(m, cap, ring); pick.push(m, cap);
    return { r, x, z: -y, P, m, cap, ring, mat, h, cur: reduce ? h : 0.01 };
  });
  const placePins = () => pins.forEach(q => { const b = q.P ? q.P.cur : FLAT;
    q.m.position.set(q.x, b, q.z); q.m.scale.y = q.cur; q.cap.position.set(q.x, b + q.cur, q.z); q.ring.position.set(q.x, b + 0.25, q.z); });
  // pemandangan hiasan: pohon di daratan dan warga berbusana adat dari beberapa wilayah (ilustrasi, bukan data)
  const scenery = (() => { try {
    const rnd = (a, b) => a + Math.random() * (b - a), polys = [];
    for (const ft of PROV_GEO.features) for (const poly of ft.geometry.coordinates) {
      const r = poly[0].map(([lo, la]) => PX(lo, la)); let ar = 0, x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      for (let i = 0; i < r.length; i++) { const a = r[i], b = r[(i + 1) % r.length]; ar += a[0] * b[1] - b[0] * a[1]; x0 = Math.min(x0, a[0]); x1 = Math.max(x1, a[0]); y0 = Math.min(y0, a[1]); y1 = Math.max(y1, a[1]); }
      ar = Math.abs(ar) / 2; if (ar > 30) polys.push({ r, ar, x0, x1, y0, y1 });
    }
    const inside = (P, x, y) => { let c = false; const r = P.r; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { if ((r[i][1] > y) !== (r[j][1] > y) && x < (r[j][0] - r[i][0]) * (y - r[i][1]) / (r[j][1] - r[i][1]) + r[i][0]) c = !c; } return c; };
    const onLand = (x, y) => polys.some(P => x >= P.x0 && x <= P.x1 && y >= P.y0 && y <= P.y1 && inside(P, x, y));
    const tot = polys.reduce((a, P) => a + P.ar, 0), cum = []; polys.reduce((a, P, i) => (cum[i] = a + P.ar), 0);
    const pickPoly = () => { const t = Math.random() * tot; let lo = 0, hi = cum.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; cum[m] < t ? lo = m + 1 : hi = m; } return polys[lo]; };
    const snap = (lon, lat) => { const [x, y] = PX(lon, lat); if (onLand(x, y)) return [x, y];
      for (let rad = 4; rad < 60; rad += 4) for (let k = 0; k < 12; k++) { const a = k * Math.PI / 6, px = x + rad * Math.cos(a), py = y + rad * Math.sin(a); if (onLand(px, py)) return [px, py]; } return [x, y]; };
    // orang dulu, supaya pohon tidak menimpa
    const CUL = [
      { lon: 100.4, lat: -0.9, body: 0xc62828, trim: 0xf2b544, head: 'tanduk' },    // Minangkabau: merah, songket emas
      { lon: 110.2, lat: -7.4, body: 0x1f3a93, trim: 0xe0b45a, head: 'blangkon' },  // Jawa: batik biru tua, emas
      { lon: 115.1, lat: -8.5, body: 0xf7f2e8, trim: 0xd9a21b, head: 'udeng' },     // Bali: putih, kain emas
      { lon: 113.8, lat: -1.6, body: 0x2b2b2b, trim: 0xd32f2f, head: 'bulu' },      // Dayak: hitam, merah
      { lon: 120.1, lat: -3.4, body: 0x8e24aa, trim: 0xf2b544, head: 'songkok' },   // Bugis: ungu, emas
      { lon: 138.9, lat: -4.3, body: 0xe65100, trim: 0xfff176, head: 'cendrawasih' } // Papua: jingga, kuning
    ];
    const skinC = [0xc68e5e, 0xb07a4d, 0xd9a273, 0x9a6a42], M = c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 });
    const mk3 = (geo, mat, x, y, z, rx = 0, rz = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.x = rx; m.rotation.z = rz; return m; };
    const figs = CUL.map((c, i) => {
      const g = new THREE.Group(), cloth = M(c.body), trim = M(c.trim), skin = M(skinC[i % skinC.length]), ink = M(0x1c1c1c);
      // alas bulat putih dengan cincin warna busana, supaya jelas berbeda dari pohon
      g.add(mk3(new THREE.CylinderGeometry(5.6, 6, 0.6, 28), M(0xf4efe6), 0, 0.1, 0), mk3(new THREE.TorusGeometry(5.7, 0.3, 6, 32), trim, 0, 0.45, 0, Math.PI / 2));
      // kain bawah dengan tiga pita hiasan
      g.add(mk3(new THREE.ConeGeometry(3.6, 7, 16), cloth, 0, 3.5, 0));
      [1.2, 2.8, 4.4].forEach(h => g.add(mk3(new THREE.TorusGeometry(3.6 * (1 - h / 7) + 0.12, 0.34, 6, 22), trim, 0, h, 0, Math.PI / 2)));
      // badan, ikat pinggang, selempang menyilang, kalung
      g.add(mk3(new THREE.CylinderGeometry(1.8, 2.3, 4.6, 14), cloth, 0, 9.3, 0), mk3(new THREE.TorusGeometry(2.1, 0.45, 6, 16), trim, 0, 7.2, 0, Math.PI / 2), mk3(new THREE.SphereGeometry(0.6, 8, 6), trim, 0, 7.2, 2.2));
      const sash = mk3(new THREE.BoxGeometry(0.95, 5.4, 0.5), trim, 0, 9.5, 1.95); sash.rotation.z = -0.6; g.add(sash);
      g.add(mk3(new THREE.TorusGeometry(1.55, 0.3, 6, 16), trim, 0, 11.4, 0, Math.PI / 2));
      // kepala dan wajah
      g.add(mk3(new THREE.SphereGeometry(1.9, 16, 12), skin, 0, 13.3, 0), mk3(new THREE.SphereGeometry(0.24, 8, 6), ink, 0.7, 13.5, 1.7), mk3(new THREE.SphereGeometry(0.24, 8, 6), ink, -0.7, 13.5, 1.7));
      // lengan: kiri turun, kanan melambai
      const arm = side => { const p = new THREE.Group(); p.position.set(side * 2.3, 11.4, 0); p.add(mk3(new THREE.CylinderGeometry(0.58, 0.5, 4.4, 8), cloth, 0, -2.2, 0), mk3(new THREE.SphereGeometry(0.78, 10, 8), skin, 0, -4.6, 0)); g.add(p); return p; };
      const armR = arm(1), armL = arm(-1); armL.rotation.z = -0.3;
      const fan = (n, len, cols, y, spread) => { for (let k = 0; k < n; k++) { const t = n === 1 ? 0 : k / (n - 1) - 0.5; g.add(mk3(new THREE.CylinderGeometry(0.18, 0.34, len, 6), M(cols[k % cols.length]), t * spread * 2.2, y + len / 2 - Math.abs(t) * 1.6, 0, 0, -t * spread)); } };
      if (c.head === 'tanduk') { g.add(mk3(new THREE.CylinderGeometry(1.9, 2, 0.9, 14), trim, 0, 14.9, 0), mk3(new THREE.ConeGeometry(0.9, 3.4, 8), cloth, 1.3, 16.6, 0, 0, -0.65), mk3(new THREE.ConeGeometry(0.9, 3.4, 8), cloth, -1.3, 16.6, 0, 0, 0.65)); }
      else if (c.head === 'blangkon') { g.add(mk3(new THREE.SphereGeometry(2.05, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), M(0x4e342e), 0, 14.4, 0), mk3(new THREE.SphereGeometry(0.8, 8, 6), M(0x4e342e), 0, 14.8, -1.8), mk3(new THREE.TorusGeometry(2.05, 0.22, 6, 16), trim, 0, 14.5, 0, Math.PI / 2)); }
      else if (c.head === 'udeng') { g.add(mk3(new THREE.CylinderGeometry(2.05, 2.05, 1.1, 14), cloth, 0, 14.6, 0), mk3(new THREE.ConeGeometry(0.9, 2.4, 6), cloth, 0.2, 16.3, 0.8, 0, 0.35), mk3(new THREE.TorusGeometry(2.05, 0.2, 6, 16), trim, 0, 14.2, 0, Math.PI / 2)); }
      else if (c.head === 'bulu') { g.add(mk3(new THREE.CylinderGeometry(2, 2, 0.9, 14), trim, 0, 14.7, 0)); fan(9, 7, [0x1c1c1c, 0xf5f5f5], 15, 0.55); }
      else if (c.head === 'songkok') { g.add(mk3(new THREE.CylinderGeometry(1.8, 2, 2.3, 14), ink, 0, 15, 0), mk3(new THREE.CylinderGeometry(2.02, 2.02, 0.4, 14), trim, 0, 14.3, 0)); }
      else { g.add(mk3(new THREE.CylinderGeometry(2, 2, 0.8, 14), trim, 0, 14.7, 0)); fan(11, 8.5, [0xd9822b, 0xe53935, 0xf2b544, 0x1e88e5], 15, 0.6); }
      const [x, y] = snap(c.lon, c.lat); g.scale.setScalar(2.0); g.position.set(x, FLAT, -y); scene.add(g);
      return { g, x, y, ph: Math.random() * 6.28, armR };
    });
    // pohon: InstancedMesh (batang + tajuk), disebar menurut luas daratan
    const NT = 380, trunkG = new THREE.CylinderGeometry(0.6, 0.85, 3.2, 6), leafG = new THREE.ConeGeometry(3, 8, 7);
    const trunks = new THREE.InstancedMesh(trunkG, M(dark ? 0x5a3f2b : 0x7a5638), NT), leaves = new THREE.InstancedMesh(leafG, M(0xffffff), NT), d = new THREE.Object3D(), col = new THREE.Color();
    const pinPts = pins.map(q => [q.x, -q.z]); let n = 0;
    for (let tries = 0; n < NT && tries < NT * 30; tries++) {
      const P = pickPoly(), x = rnd(P.x0, P.x1), y = rnd(P.y0, P.y1); if (!inside(P, x, y)) continue;
      if (pinPts.some(q => Math.hypot(q[0] - x, q[1] - y) < 9) || figs.some(f => Math.hypot(f.x - x, f.y - y) < 18)) continue;
      const k = rnd(0.6, 1.1); d.position.set(x, FLAT + 1.6 * k, -y); d.rotation.set(0, 0, 0); d.scale.set(k, k, k); d.updateMatrix(); trunks.setMatrixAt(n, d.matrix);
      d.position.y = FLAT + (3.2 + 3.6) * k; d.rotation.y = Math.random() * 6; d.updateMatrix(); leaves.setMatrixAt(n, d.matrix);
      col.setHSL(rnd(0.27, 0.40), rnd(0.42, 0.6), dark ? rnd(0.24, 0.34) : rnd(0.34, 0.46)); leaves.setColorAt(n, col); n++;
    }
    trunks.count = leaves.count = n; trunks.instanceMatrix.needsUpdate = leaves.instanceMatrix.needsUpdate = true; if (leaves.instanceColor) leaves.instanceColor.needsUpdate = true;
    trunks.frustumCulled = leaves.frustumCulled = false; scene.add(trunks, leaves);
    return { tick(t) { figs.forEach(f => { f.armR.rotation.z = 2.55 + Math.sin(t * 4.2 + f.ph) * 0.5; }); } };
  } catch (e) { return null; } })();
  // asap dan angin (hiasan): partikel naik dari tiap tiang, awan tipis dan garis angin melayang ke timur; tidak memakai data arah angin
  const amb = reduce ? null : (() => { try {
    const PPN = 12, NH = 9, NS = 64, nP = pins.length * PPN + NH, rnd = (a, b) => a + Math.random() * (b - a);
    const pos = new Float32Array(nP * 3), size = new Float32Array(nP), alp = new Float32Array(nP), col = new Float32Array(nP * 3);
    const seeds = Array.from({ length: nP }, () => ({ ph: Math.random(), sp: rnd(0.07, 0.13), jx: rnd(-6, 6), jz: rnd(-6, 6) }));
    pins.forEach((q, i) => { const c = q.mat.color; for (let j = 0; j < PPN; j++) { const k = (i * PPN + j) * 3; col[k] = c.r * 0.85 + 0.15; col[k + 1] = c.g * 0.85 + 0.15; col[k + 2] = c.b * 0.85 + 0.15; } });
    const hz = Array.from({ length: NH }, (_, j) => { const k = (pins.length * PPN + j) * 3; col[k] = col[k + 1] = col[k + 2] = dark ? 0.62 : 1; return { x: rnd(-650, 650), z: rnd(-330, 330), y: rnd(70, 120), sp: rnd(6, 12), s: rnd(150, 230) }; });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(alp, 1)); geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    const u = { value: 600 };
    const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uScale: u },
      vertexShader: 'attribute float aSize; attribute float aAlpha; attribute vec3 aColor; uniform float uScale; varying float vA; varying vec3 vC; void main() { vA = aAlpha; vC = aColor; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = aSize * uScale / -mv.z; gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'varying float vA; varying vec3 vC; void main() { float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.05, d) * vA; if (a < 0.01) discard; gl_FragColor = vec4(vC, a); }' });
    const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; pts.renderOrder = 3; scene.add(pts);
    // garis angin: ekor memudar ke warna latar
    const st = Array.from({ length: NS }, () => ({ x0: rnd(-750, 750), z: rnd(-340, 340), y: rnd(8, 46), len: rnd(60, 150), sp: rnd(22, 38) }));
    const sp = new Float32Array(NS * 6), sc = new Float32Array(NS * 6), bgC = new THREE.Color(bg), lnC = new THREE.Color(dark ? 0x86a9cc : 0x6f87a3);
    for (let i = 0; i < NS; i++) { sc.set([bgC.r, bgC.g, bgC.b, lnC.r, lnC.g, lnC.b], i * 6); }
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(sp, 3)); lg.setAttribute('color', new THREE.BufferAttribute(sc, 3));
    const lines = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.9, fog: false })); lines.frustumCulled = false; scene.add(lines);
    const cap = document.createElement('div'); cap.className = 'amb3d'; cap.textContent = 'Hiasan (pohon, warga berbusana adat, asap, angin): ilustrasi, bukan data'; host.appendChild(cap);
    // hiasan peta: air bergelombang, nama laut, kapal berlayar, riak dari stasiun, kompas (semuanya ilustrasi)
    const deco = (() => {
      const ink = dark ? '200,220,245' : '58,92,134';
      const flatTex = (draw, w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t; };
      const flat = (tex, w, h, x, z, y = 0.5, order = 1) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, fog: false })); m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); m.renderOrder = order; scene.add(m); return m; };
      // 1) air: kilau lembut yang bergerak di atas alas
      const wu = { value: 0 };
      const water = new THREE.Mesh(new THREE.PlaneGeometry(2600, 1800), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uT: wu, uC: { value: new THREE.Color(dark ? 0x4f8fd0 : 0x6fa8dc) } },
        vertexShader: 'varying vec2 vP; void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: 'uniform float uT; uniform vec3 uC; varying vec2 vP; void main() { float a = sin(vP.x * 0.050 + uT * 0.55) * sin(vP.y * 0.060 - uT * 0.40) + sin((vP.x + vP.y) * 0.032 + uT * 0.30); float k = smoothstep(0.55, 1.6, a); gl_FragColor = vec4(uC, 0.04 + 0.11 * k); }' }));
      water.rotation.x = -Math.PI / 2; water.position.set(0, 0.03, 2); water.renderOrder = 0; scene.add(water);
      // 2) nama laut (huruf besar tipis, miring)
      [['SAMUDRA HINDIA', 95.5, -9.5, 300], ['LAUT CINA SELATAN', 107, 5.8, 330], ['LAUT BANDA', 127, -5.9, 190], ['SAMUDRA PASIFIK', 142, 6.5, 330], ['LAUT ARAFURA', 136.5, -9.2, 240]].forEach(([txt, lon, lat, w]) => {
        const [x, y] = PX(lon, lat), tex = flatTex((g, cw, ch) => { g.clearRect(0, 0, cw, ch); g.font = 'italic 600 46px Inter, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = `rgba(${ink},0.34)`;
          if ('letterSpacing' in g) g.letterSpacing = '10px'; g.fillText(txt, cw / 2, ch / 2); }, 1024, 96);
        flat(tex, w, w * 96 / 1024, x, -y, 0.45, 1).rotation.z = 0.06;
      });
      // 3) kompas di pojok tenggara
      { const [x, y] = PX(139.5, -12.4), tex = flatTex((g, cw, ch) => { g.clearRect(0, 0, cw, ch); g.translate(cw / 2, ch / 2); g.strokeStyle = `rgba(${ink},0.55)`; g.fillStyle = `rgba(${ink},0.55)`; g.lineWidth = 5;
          g.beginPath(); g.arc(0, 0, 150, 0, 7); g.stroke(); g.lineWidth = 2; g.beginPath(); g.arc(0, 0, 118, 0, 7); g.stroke();
          for (let i = 0; i < 4; i++) { g.save(); g.rotate(i * Math.PI / 2); g.beginPath(); g.moveTo(0, -150); g.lineTo(18, 0); g.lineTo(0, 30); g.lineTo(-18, 0); g.closePath(); g.globalAlpha = i === 0 ? 1 : 0.55; g.fill(); g.restore(); }
          g.font = '700 48px Inter, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.globalAlpha = 1; g.fillText('U', 0, -188); }, 512, 512);
        flat(tex, 130, 130, x, -y, 0.5, 1); }
      // 4) kapal: berlayar bolak-balik di jalur laut terbuka
      const wake = flatTex((g, cw, ch) => { const gr = g.createLinearGradient(0, 0, cw, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(255,255,255,0.85)'); g.fillStyle = gr; g.beginPath(); g.moveTo(0, ch / 2); g.lineTo(cw, 0); g.lineTo(cw, ch); g.closePath(); g.fill(); }, 128, 32);
      const hullM = new THREE.MeshStandardMaterial({ color: dark ? 0xdfe8f2 : 0xffffff, roughness: 0.6 }), cabM = new THREE.MeshStandardMaterial({ color: 0x234a6e, roughness: 0.6 });
      const lanes = [[93.4, 4, 96.8, -6.5, 15], [104, -10.2, 117, -10.4, 13], [107.2, -5.2, 115, -5.2, 12], [124.5, -5.4, 131, -6.6, 12], [143, 3.5, 133.5, 2.8, 14], [106, 4.6, 112.5, 6, 12], [121, 3.4, 125.5, 4.4, 10]]
        .map(([a, b, c, d, v], i) => { const [x0, y0] = PX(a, b), [x1, y1] = PX(c, d), len = Math.hypot(x1 - x0, y1 - y0);
          const g = new THREE.Group(), hull = new THREE.Mesh(new THREE.BoxGeometry(9, 1.8, 3.4), hullM), cab = new THREE.Mesh(new THREE.BoxGeometry(3, 2.4, 2.6), cabM); cab.position.set(-1.6, 2, 0);
          const bow = new THREE.Mesh(new THREE.ConeGeometry(1.7, 3, 4), hullM); bow.rotation.z = -Math.PI / 2; bow.rotation.x = Math.PI / 4; bow.position.set(5.9, 0, 0);
          const wk = new THREE.Mesh(new THREE.PlaneGeometry(26, 6), new THREE.MeshBasicMaterial({ map: wake, transparent: true, depthWrite: false, opacity: 0.8, fog: false })); wk.rotation.x = -Math.PI / 2; wk.position.set(-17, -0.7, 0); wk.renderOrder = 1;
          g.add(hull, cab, bow, wk); g.scale.setScalar(1.9); g.position.y = 2.2; scene.add(g); return { g, x0, z0: -y0, x1, z1: -y1, len, v, off: i * 0.37 }; });
      // 5) riak yang menyebar dari dasar tiap stasiun
      const rip = pins.map((q, i) => { const m = new THREE.Mesh(new THREE.RingGeometry(0.88, 1, 48), new THREE.MeshBasicMaterial({ color: q.mat.color, transparent: true, depthWrite: false, opacity: 0, fog: false })); m.rotation.x = -Math.PI / 2; m.renderOrder = 2; scene.add(m); return m; });
      return t => {
        wu.value = t;
        lanes.forEach(L => { const u = Math.abs(((t * L.v / L.len + L.off) % 2) - 1), fw = ((t * L.v / L.len + L.off) % 2) < 1 ? 1 : -1, dx = (L.x1 - L.x0) * fw, dz = (L.z1 - L.z0) * fw;
          L.g.position.x = L.x0 + (L.x1 - L.x0) * u; L.g.position.z = L.z0 + (L.z1 - L.z0) * u; L.g.rotation.y = Math.atan2(-dz, dx); });
        pins.forEach((q, i) => { const m = rip[i], ints = clamp((pv(q.r) || 0) / maxMean, 0.25, 1), ph = (t * 0.28 + i * 0.137) % 1, on = q.cur > q.h * 0.6 && q.lit !== false;
          m.position.set(q.x, (q.P ? q.P.cur : FLAT) + 0.5, q.z); const sc = 5 + ph * (24 + 22 * ints); m.scale.set(sc, sc, 1); m.material.opacity = on ? 0.5 * ints * (1 - ph) * (1 - ph) : 0; });
      };
    })();
    const W = 0.9;
    return { u, tick(t) {
      deco(t); if (scenery) scenery.tick(t);
      pins.forEach((q, i) => {
        const top = (q.P ? q.P.cur : FLAT) + q.cur, ints = clamp((pv(q.r) || 0) / maxMean, 0.25, 1), live = q.cur > q.h * 0.6 && q.lit !== false;
        for (let j = 0; j < PPN; j++) {
          const k = i * PPN + j, sd = seeds[k], ph = (sd.ph + t * sd.sp) % 1, on = live && j / PPN < ints;
          pos[k * 3] = q.x + sd.jx * 0.3 + ph * 60 * W + ph * ph * 30; pos[k * 3 + 1] = top + 2 + ph * (26 + 30 * ints); pos[k * 3 + 2] = q.z + sd.jz * 0.3 + ph * 14 * W;
          size[k] = (14 + 34 * ph) * (0.7 + 0.5 * ints);
          alp[k] = on ? 0.5 * ints * (ph < 0.15 ? ph / 0.15 : 1 - (ph - 0.15) / 0.85) : 0;
        }
      });
      hz.forEach((h, j) => { const k = pins.length * PPN + j; pos[k * 3] = ((h.x + t * h.sp + 700) % 1400) - 700; pos[k * 3 + 1] = h.y; pos[k * 3 + 2] = h.z; size[k] = h.s; alp[k] = dark ? 0.07 : 0.13; });
      geo.attributes.position.needsUpdate = geo.attributes.aSize.needsUpdate = geo.attributes.aAlpha.needsUpdate = true;
      st.forEach((a, i) => { const x = ((a.x0 + t * a.sp + 750) % 1500) - 750; sp.set([x - a.len, a.y, a.z, x, a.y, a.z], i * 6); });
      lg.attributes.position.needsUpdate = true;
    } };
  } catch (e) { return null; } })();
  // label kecil di atas lima stasiun terburuk
  const layer = document.createElement('div'); layer.className = 'lbl3d-layer'; host.appendChild(layer);
  const labs = (o.labelPins ? o.labelPins(pins) : pins.slice().sort((a, b) => b.r.mean - a.r.mean).slice(0, 5)).map(q => { const el = document.createElement('div'); el.className = 'lbl3d'; el.innerHTML = `<b>${q.r.code}</b>${o.labelTxt ? o.labelTxt(q.r) : Math.round(q.r.mean)}`; layer.appendChild(el); return { q, el }; });
  const v3 = new THREE.Vector3();
  const placeLabels = () => { const w = host.clientWidth, h = host.clientHeight, used = [];
    labs.forEach(({ q, el }) => { v3.set(q.x, (q.P ? q.P.cur : FLAT) + q.cur + 8, q.z).project(camera);
      const x = (v3.x * .5 + .5) * w, y = (-v3.y * .5 + .5) * h;
      let ok = v3.z < 1 && q.cur > q.h * 0.7 && x > 30 && x < w - 30 && y > 24;
      if (ok && used.some(u => Math.abs(u[0] - x) < 78 && Math.abs(u[1] - y) < 24)) ok = false;
      if (ok) used.push([x, y]);
      el.style.opacity = ok ? 1 : 0;
      el.style.transform = `translate(-50%, -100%) translate(${x}px, ${y}px)`; }); };

  // kamera & kontrol
  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  Object.assign(controls, { enableDamping: true, dampingFactor: 0.08, enableZoom: false, screenSpacePanning: false,
    minPolarAngle: 0.1, maxPolarAngle: 1.25, rotateSpeed: 0.55, panSpeed: 0.9 });
  const HOME_POLAR = 0.9, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  let home = null, intro = null, need = true, alive = true, raf = 0, active = false, minD = 40, maxD = 2000;
  const HX = 26, camAt = (d, polar, az = 0) => { controls.target.set(HX, 0, 10); camera.position.set(HX + d * Math.sin(polar) * Math.sin(az), d * Math.cos(polar), 10 + d * Math.sin(polar) * Math.cos(az)); controls.update(); };
  function fit() {
    const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    if (amb) amb.u.value = renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    const vf = THREE.MathUtils.degToRad(camera.fov), hf = 2 * Math.atan(Math.tan(vf / 2) * camera.aspect);
    const d = 0.96 * Math.max(485 / Math.tan(hf / 2), 150 / Math.tan(vf / 2));
    maxD = d * 1.5; minD = d * 0.08;
    scene.fog = new THREE.Fog(bg, d * 1.15, d * 2.1);
    const first = !home; home = { d, polar: HOME_POLAR }; need = true;
    if (first) { if (reduce) camAt(d, HOME_POLAR); else intro = { t0: performance.now(), dur: 1700 }; }
  }
  const reset = () => { intro = null; camAt(home.d, home.polar); };
  // zoom ke arah titik P: kamera dan target sama-sama didekatkan ke P
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), tmp = new THREE.Vector3();
  function zoomAt(P, f) {
    const d = camera.position.distanceTo(controls.target), nd = clamp(d * f, minD, maxD); f = nd / d;
    camera.position.sub(P).multiplyScalar(f).add(P);
    controls.target.sub(P).multiplyScalar(f).add(P); controls.target.y = 0;
    controls.update(); need = true;
  }
  const centerZoom = f => zoomAt(controls.target.clone(), f);

  const cvs = renderer.domElement, ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
  const setPtr = e => { const b = cvs.getBoundingClientRect(); ptr.set(((e.clientX - b.left) / b.width) * 2 - 1, -((e.clientY - b.top) / b.height) * 2 + 1); ray.setFromCamera(ptr, camera); };
  const hit = e => { setPtr(e); const h = ray.intersectObjects(pick)[0]; return h ? h.object.userData : null; };
  const onWheel = e => {
    if (!active) return;
    e.preventDefault(); intro = null;
    setPtr(e); const P = ray.ray.intersectPlane(plane, tmp) ? tmp.clone() : controls.target.clone();
    zoomAt(P, Math.pow(1.0018, e.deltaY));
  };
  let hover = null, down = null;
  const setHover = u => {
    const key = u ? (u.code || u.prov) : null; if (key === (hover && (hover.code || hover.prov))) return;
    hover = u; need = true;
    provs.forEach(p => p.mat.emissive.setHex(u && !u.code && p.name === u.prov ? 0x262626 : 0x000000));
    pins.forEach(q => { const k = u && u.code === q.r.code ? 1.5 : 1; q.m.scale.x = q.m.scale.z = k; q.cap.scale.setScalar(k); });
    cvs.style.cursor = u && (u.code || o.agg[u.prov]) ? 'pointer' : '';
    if (u) tip.innerHTML = u.code ? o.tipSt(u.code) : o.tipProv(u.prov);
  };
  const onMove = e => {
    if (fly) return;
    if (e.buttons) { tip.hidden = true; return; }
    const u = hit(e); setHover(u); tip.hidden = !u;
    if (u) { const b = host.getBoundingClientRect(), x = e.clientX - b.left, y = e.clientY - b.top, w = tip.offsetWidth, th = tip.offsetHeight;
      tip.style.transform = `translate(${clamp(x + 14, 6, b.width - w - 6)}px, ${y - th - 12 < 6 ? y + 16 : y - th - 12}px)`; }
  };
  const onDown = e => { down = [e.clientX, e.clientY]; intro = null; if (!active) { active = true; host.classList.add('active'); hint.hidden = true; } };
  // klik stasiun/provinsi: kamera terbang ke tiang stasiun, baru pindah ke profil
  let fly = null;
  const flyTo = (q, done) => {
    intro = null; tip.hidden = true;
    const c0 = camera.position.clone(), g0 = controls.target.clone(), g1 = new THREE.Vector3(q.x, 0, q.z);
    const dir = c0.clone().sub(g0).normalize(), d1 = Math.max(minD, c0.distanceTo(g0) * 0.28);
    fly = { t0: performance.now(), dur: 800, c0, g0, g1, c1: g1.clone().add(dir.multiplyScalar(d1)), done };
  };
  const pickFly = u => {
    const code = u.code || (o.agg[u.prov] && o.agg[u.prov].g[0].code), q = pins.find(p => p.r.code === code);
    if (!q || reduce) return o.onPick(u);
    flyTo(q, () => o.onPick(u));
  };
  const onUp = e => {
    if (fly) { down = null; return; }
    if (down && Math.hypot(e.clientX - down[0], e.clientY - down[1]) < 5) { const u = hit(e); if (u) pickFly(u); }
    down = null;
  };
  const onLeave = () => { active = false; host.classList.remove('active'); hint.hidden = false; tip.hidden = true; setHover(null); };
  cvs.addEventListener('wheel', onWheel, { passive: false });
  cvs.addEventListener('pointermove', onMove); cvs.addEventListener('pointerdown', onDown); cvs.addEventListener('pointerup', onUp);
  host.addEventListener('pointerleave', onLeave);
  controls.addEventListener('change', () => { need = true; });

  let visible = true;
  const io = new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible) need = true; }); io.observe(host);
  const ro = new ResizeObserver(fit); ro.observe(host);
  const ease = t => 1 - Math.pow(1 - t, 3);
  let lastAmb = 0;
  function loop() {
    if (!alive) return;
    raf = requestAnimationFrame(loop);
    if (!visible || !home) return;
    let moving = false;
    if (intro) { // kamera turun sambil memutar
      const t = Math.min(1, (performance.now() - intro.t0) / intro.dur), e = ease(t);
      camAt(home.d * (1.4 - 0.4 * e), home.polar, -0.35 * (1 - e)); moving = true;
      if (t >= 1) intro = null;
    }
    if (fly) {
      const t = Math.min(1, (performance.now() - fly.t0) / fly.dur), e = t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      camera.position.lerpVectors(fly.c0, fly.c1, e); controls.target.lerpVectors(fly.g0, fly.g1, e); moving = true;
      if (t >= 1) { const cb = fly.done; fly = null; cb && cb(); }
    }
    for (const p of provs) if (Math.abs(p.h - p.cur) > 0.02) { p.cur += (p.h - p.cur) * 0.08; p.g.scale.z = p.cur; moving = true; }
    for (const q of pins) if (Math.abs(q.h - q.cur) > 0.05) { q.cur += (q.h - q.cur) * 0.07; moving = true; }
    if (moving) placePins();
    moving = controls.update() || moving;
    const now = performance.now(), struct = moving || need, ambTick = amb && now - lastAmb > 40;
    if (struct) renderer.shadowMap.needsUpdate = true;
    if (ambTick) { amb.tick(now / 1000); lastAmb = now; }
    if (struct || ambTick) { renderer.render(scene, camera); placeLabels(); need = false; }
  }
  placePins(); fit(); loop();
  return {
    zin: () => centerZoom(0.72), zout: () => centerZoom(1.38), reset,
    focus(codes) {
      const on = codes ? new Set(codes) : null;
      pins.forEach(q => { const lit = !on || on.has(q.r.code); q.lit = lit; q.mat.transparent = !lit; q.mat.opacity = lit ? 1 : 0.12; q.ring.material.opacity = lit ? 0.85 : 0.1;
        const k = on && lit ? 1.35 : 1; q.m.scale.x = q.m.scale.z = k; q.cap.scale.setScalar(k); q.mat.needsUpdate = true; });
      labs.forEach(({ q, el }) => { el.style.visibility = !on || on.has(q.r.code) ? '' : 'hidden'; });
      need = true;
    },
    dispose() {
      alive = false; cancelAnimationFrame(raf); io.disconnect(); ro.disconnect(); controls.dispose();
      cvs.removeEventListener('wheel', onWheel); host.removeEventListener('pointerleave', onLeave);
      scene.traverse(n => { if (n.geometry) n.geometry.dispose(); if (n.material) n.material.dispose(); });
      renderer.dispose(); if (renderer.forceContextLoss) renderer.forceContextLoss(); host.innerHTML = '';
    },
  };
}
