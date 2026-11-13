/* Siaga Udara: halaman. Tiap halaman menjawab satu pertanyaan. */
'use strict';

/* ================= helper analitik ================= */
function stRows(codes = active().map(s => s.code), r = range()) {
  return codes.map(c => ({ code: c, ...sstat(c, r), s: BY[c] }));
}
function pooled(codes, r = range()) {
  let n = 0, s = 0, ex = 0; const cats = [0, 0, 0, 0, 0];
  for (const c of codes) { const t = sstat(c, r); n += t.n; s += t.mean * t.n || 0; ex += t.ex; t.cats.forEach((v, i) => cats[i] += v); }
  return { n, mean: n ? s / n : null, ex, pct: n ? 100 * ex / n : null, cats };
}
function monthlySeries(codes, pol = 'pm25') {   // rata-rata antarstasiun per bulan dalam rentang
  const out = []; for (let m = S.from; m <= S.to; m++) out.push(mean(codes.map(c => D.mon[c].n[m] ? D.mon[c][pol][m] : null)));
  return out;
}
function hourProfile(codes, m0 = S.from, m1 = S.to) {
  const h = new Array(24).fill(0).map((_, k) => mean(codes.flatMap(c => { const a = []; for (let m = m0; m <= m1; m++) a.push(D.hm[c][m][k]); return a; })));
  return h;
}
function moyProfile(codes, r = range()) {   // bulan-dalam-tahun 1..12 dari harian
  const s = new Array(12).fill(0), n = new Array(12).fill(0);
  for (const c of codes) { const a = D.pm25[c]; for (let i = r[0]; i <= r[1]; i++) if (a[i] != null) { const mo = dayDate(i).getUTCMonth(); s[mo] += a[i]; n[mo]++; } }
  return s.map((v, i) => n[i] ? v / n[i] : null);
}
function rank(a) { const idx = a.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0]); const r = new Array(a.length); let i = 0;
  while (i < idx.length) { let j = i; while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++; for (let k = i; k <= j; k++) r[idx[k][1]] = (i + j) / 2; i = j + 1; } return r; }
function pearson(x, y) { const n = x.length; if (n < 3) return null; const mx = mean(x), my = mean(y); let a = 0, b = 0, c = 0;
  for (let i = 0; i < n; i++) { a += (x[i] - mx) * (y[i] - my); b += (x[i] - mx) ** 2; c += (y[i] - my) ** 2; } return b && c ? a / Math.sqrt(b * c) : null; }
const spearman = (x, y) => pearson(rank(x), rank(y));
function eta2(vals, groups) { const m = mean(vals), g = {}; vals.forEach((v, i) => (g[groups[i]] = g[groups[i]] || []).push(v));
  let ssb = 0; for (const k in g) ssb += g[k].length * (mean(g[k]) - m) ** 2; const sst = vals.reduce((s, v) => s + (v - m) ** 2, 0); return sst ? ssb / sst : null; }
function rsWindow(rs, out, i0, i1) { const a = D.health[rs][out]; const r = []; for (let i = i0; i <= i1; i++) r.push(a[i]); return r; }
function kaltengDeaths(yr) {
  const i0 = dayIdx(`${yr}-09-01`), i1 = dayIdx(`${yr}-10-13`);
  return mean([...rsWindow('RS-XXX-04', 'death', i0, i1), ...rsWindow('RS-XXX-05', 'death', i0, i1)].map((v, i, arr) => v)) * 2;
}
const useTag = t => { const c = { andal: '--ok', parsial: '--warn', rusak: '--bad' }[t.use] || '--muted'; return `<span style="display:inline-block;margin-top:3px;padding:1px 8px;border-radius:99px;font-weight:700;font-size:11.5px;background:color-mix(in srgb, var(${c}) 18%, transparent);color:var(${c})">Data ${esc(t.use)}</span>`; };
const legendKel = (list = KEL) => list.map(k => `<span><i style="background:var(${KEL_VAR[k]})"></i>${k}</span>`).join('');
const rankRef = P => P.thn || P.std;
const rankCol = (v, P) => { const r = v / rankRef(P); return cv(r <= 1 ? '--ok' : r <= 2 ? '--warn' : '--bad'); };
const legendRank = P => `<span><i style="background:var(--ok)"></i>Memenuhi baku</span><span><i style="background:var(--warn)"></i>Melewati baku (sampai 2×)</span><span><i style="background:var(--bad)"></i>Jauh melewati (lebih dari 2×)</span>`;
const legendIspu = () => ISPU.map(c => `<span><i style="background:var(${c.v})"></i>${c.l}</span>`).join('');
const emptyMsg = '<div class="empty">Tidak ada stasiun yang cocok dengan filter. Ubah atau reset filter di atas.</div>';

/* ================= peta (tanpa basemap: koordinat asli, sesuai aturan "tanpa dataset tambahan") ================= */
function sizeMap(id) { const el = document.getElementById(id); if (el) el.style.height = Math.max(240, Math.min(520, el.clientWidth / 2.6)) + 'px'; }
function mapOpt(pts, o) {
  const cent = PULAU.map(p => { const g = ST.filter(s => s.pulau === p); return { name: p, value: [mean(g.map(s => s.lon)), mean(g.map(s => s.lat)) + (p === 'Jawa' ? -2.2 : 2.3)] }; });
  const series = [
    { type: 'line', data: [[94, 0], [141, 0]], symbol: 'none', silent: true, lineStyle: { color: cv('--line-2'), width: 1 }, z: 1,
      },
    { type: 'scatter', data: [{ value: [141, -0.9] }], symbolSize: 0, silent: true, z: 2, label: { show: !o.narrow, formatter: 'khatulistiwa', position: 'left', color: cv('--muted'), fontSize: 10 } },
    { type: 'scatter', data: cent, symbolSize: 0, silent: true, z: 2, labelLayout: { hideOverlap: true }, label: { show: !o.narrow, formatter: '{b}', color: cv('--muted'), fontSize: 13, fontWeight: 700, opacity: .4 } },
  ];
  if (o.prov && window.PROV_GEO) series.unshift({ type: 'lines', coordinateSystem: 'cartesian2d', polyline: true, silent: true, z: 0, large: true,
    data: PROV_GEO.features.flatMap(ft => ft.geometry.coordinates.map(poly => ({ coords: poly[0] }))), lineStyle: { color: cv('--line-2'), width: .8, opacity: .9 } });
  if (o.lines) series.push({ type: 'lines', coordinateSystem: 'cartesian2d', polyline: false, silent: true, z: 3, data: o.lines, lineStyle: { color: cv('--muted'), width: 1, opacity: .45, type: 'solid' } });
  if (o.kmLabels) series.push({ type: 'scatter', data: o.kmLabels, symbolSize: 0, silent: true, z: 4, label: { show: true, formatter: p => p.data.t, fontSize: 9.5, color: cv('--muted'), backgroundColor: cv('--surface'), padding: [1, 3], borderRadius: 3 }, labelLayout: { hideOverlap: true } });
  series.push({ type: 'scatter', z: 5, data: pts, cursor: 'pointer',
    itemStyle: { borderColor: cv('--surface'), borderWidth: 1.5, opacity: .95 },
    emphasis: { scale: 1.25, itemStyle: { borderColor: cv('--ink'), borderWidth: 2 } },
    label: { show: true, position: 'right', fontSize: 10.5, color: cv('--ink-2'), formatter: p => p.data.lbl || '' },
    labelLayout: { hideOverlap: true } });
  const grat = { show: true, lineStyle: { color: cv('--line'), opacity: .8 } };
  return { grid: { left: 40, right: 20, top: 6, bottom: 22 },
    xAxis: { type: 'value', min: 95, max: 141, interval: 5, axisLine: { show: false }, axisTick: { show: false }, splitLine: grat,
      axisLabel: { color: cv('--muted'), fontSize: 10, formatter: v => v + '°BT', hideOverlap: true } },
    yAxis: { type: 'value', min: -10, max: 6, interval: 5, axisLine: { show: false }, axisTick: { show: false }, splitLine: grat,
      axisLabel: { color: cv('--muted'), fontSize: 10, formatter: v => v === 0 ? '0°' : Math.abs(v) + (v > 0 ? '°LU' : '°LS') } },
    dataZoom: [{ type: 'inside', xAxisIndex: 0, filterMode: 'none', zoomOnMouseWheel: 'ctrl', moveOnMouseWheel: false, preventDefaultMouseMove: false },
      { type: 'inside', yAxisIndex: 0, filterMode: 'none', zoomOnMouseWheel: 'ctrl', moveOnMouseWheel: false, preventDefaultMouseMove: false }],
    tooltip: { trigger: 'item', formatter: o.tip }, series };
}
function mapMode(v) {
  try { if (v) sessionStorage.setItem('su-mapmode', v); else v = sessionStorage.getItem('su-mapmode'); } catch (e) {}
  return v || (innerWidth >= 720 ? '3d' : '2d'); // di HP mulai datar: seret satu jari tetap menggulir halaman
}
function map5Mode(v) {
  try { if (v) sessionStorage.setItem('su-map5mode', v); else v = sessionStorage.getItem('su-map5mode'); } catch (e) {}
  return v || (innerWidth >= 720 ? '3d' : '2d');
}
function mapYear() { const i = PRESETS.findIndex(p => p[1] === S.from && p[2] === S.to); return i === 0 ? 'all' : i > 0 && i <= 3 ? String(i) : ''; }
const toStation = p => { const c = p.data && p.data.code; if (c) go('stasiun', { st: c }); };
const backBtn = () => window.BACK_MAP ? `<a class="btn primary" href="${hashOf('overview', { st: DEF.st })}" onclick="window.SCROLL_TO='map-wrap'">← Kembali ke peta</a>` : `<a class="btn" href="${hashOf('overview', { st: S.st })}" onclick="window.SCROLL_TO='map-wrap'">${IC.pin || ''} Lihat di peta</a>`;

/* ================= RINGKASAN ================= */
PAGES.overview = {
  title: 'Overview', nav: 'Overview',
  html() {
    const A = active(), codes = A.map(s => s.code); if (!codes.length) return ph({ k: 'Overview', h: 'Overview', lede: '' }) + emptyMsg;
    const P = pooled(codes), rows = stRows(codes).filter(r => r.n);
    const above = rows.filter(r => r.mean > BAKU_THN).length, worst = rows.slice().sort((a, b) => b.mean - a.mean)[0];
    const eps = episodesIn(codes), epDays = sum(eps.map(e => e.days)), longest = eps.slice().sort((a, b) => b.days - a.days)[0];
    const M = D.model.outcomes;
    // peta: provinsi berkategori Tidak sehat dan provinsi tanpa stasiun
    const byP = {}; rows.forEach(r => (byP[r.s.prov] = byP[r.s.prov] || []).push(r.mean));
    const pUnh = Object.entries(byP).map(([p, v]) => [p, mean(v)]).filter(x => x[1] > 55.4).sort((a, b) => b[1] - a[1]), nProvSt = new Set(ST.filter(s => s.use !== 'rusak').map(s => s.prov)).size;
    const hp = hourProfile(codes), pk = hp.indexOf(Math.max(...hp.filter(v => v != null)));
    const gam = codes.filter(c => BY[c].kel === 'Gambut'), moy = moyProfile(gam.length ? gam : codes);
    const mx = moy.indexOf(Math.max(...moy.filter(v => v != null)));
    const k26 = kaltengDeaths(2026), k24 = kaltengDeaths(2024), k25 = kaltengDeaths(2025);
    const nRel = ST.filter(s => s.use === 'andal').length;
    const Fc = D.factors, fk = Object.keys(Fc), nz = fk.filter(k => ['temp', 'rh', 'ws'].every(x => Fc[k][x] == null || Math.abs(Fc[k][x]) < 0.15)).length;
    const mxLag = Math.max(...['u5', 'death'].flatMap(k => M[k].lags.slice(1).map(l => Math.abs(l.pct))));
    const rusak = ST.filter(s => s.use === 'rusak'), NW = D.network, rk = NW.corr[NW.corr_codes.indexOf('KTG-01')][NW.corr_codes.indexOf('KTG-02')];
    const T3 = t3Shares(codes), within = T3.within, between = T3.between, wxMax = Math.max(...within.slice(3).map(x => x[1] || 0));
    const WD = 'naik-turun harian dalam stasiun';
    const fac = [{ l: 'Musim (bulan)', v: within[0][1], w: WD, hi: 1 }, ...(between.length ? [{ l: 'Tipe lokasi', v: between[0][1], w: 'perbedaan antarstasiun', hi: 1 }] : []),
      { l: 'Jam dalam sehari', v: within[1][1], w: WD }, { l: 'Hari dalam seminggu', v: within[2][1], w: WD },
      { l: 'Suhu', v: within[3][1], w: WD }, { l: 'Kelembapan', v: within[4][1], w: WD }, { l: 'Kecepatan angin', v: within[5][1], w: WD }].sort((a, b) => a.v - b.v);
    const pxs = ST.filter(s => s.use === 'parsial'), farMer = fi(NW.dist['MER-01']['SRG-01']), jmbKm = fi(NW.dist['JMB-02']['JMB-01']), plbOk = f(100 * BY['PLB-01'].q.days_ok / ND, 0);
    this._d = { codes, rows, fac };
    const ans = [
      ['t1', 'Seberapa buruk?', `<b>${above} dari ${rows.length}</b> stasiun berada di atas baku tahunan 15 µg/m³. Terburuknya ada di <b>${worst ? stName(worst.code) : '–'}</b> dengan rata-rata ${f(worst?.mean)} µg/m³.`],
      ['t2', 'Kapan siaga?', `Puncak harian pukul <b>${String(pk).padStart(2, '0')}:00</b>; puncak tahunan <b>${BULAN_L[mx]}</b>${gam.length ? ' di stasiun gambut' : ''}. ${longest ? `Episode terpanjang: <b>${longest.days} hari</b> (${longest.code}).` : ''}`],
      ['t3', 'Apa penentunya?', `<b>Lokasi dan musim</b>, bukan cuaca harian. Korelasi suhu, kelembapan, dan angin dengan PM2.5 mendekati nol (|r| &lt; 0,15) di <b>${nz} dari ${fk.length}</b> stasiun.`],
      ['t4', 'Apa dampaknya?', `Tiap +10 µg/m³: ISPA balita <b>${fp(M.u5.lags[0].pct)}</b>, kematian <b>${fp(M.death.lags[0].pct)}</b> <b>di hari yang sama</b>. Efek hari-hari berikutnya hampir nol (paling besar ${f(mxLag, 1)}%).`],
      ['t5', 'Di mana alat baru?', `Dari 27 stasiun hanya <b>${nRel}</b> andal; analisis memakai ${rows.length} (${rusak.length} rusak dikecualikan). ${rusak.map(x => `${stShort(x.code)} (${esc(x.prov)})`).join(' dan ')} praktis tidak terpantau; KTG-01 dan KTG-02 memberi sinyal ${rk >= 0.99 ? 'identik' : 'sangat mirip'} (r = ${f(rk, 2)}).`],
    ];
    const ov = (n, cards) => `<section class="ov-b" id="ov-t${n}"><div class="ov-bh"><span class="step">${n}</span><div class="ov-bt"><span class="q">${ans[n - 1][1]}</span><span class="a">${ans[n - 1][2]}</span></div><a class="btn" href="${hashOf('t' + n)}">Lihat analisis T${n} →</a></div><div class="grid">${cards}</div></section>`;
    const chips = [[`${above}/${rows.length}`, 'stasiun di atas baku'], [`${String(pk).padStart(2, '0')}:00`, 'puncak harian'],
      [`${f(100 * within[0][1], 0)}%`, 'dijelaskan musim'], [fp(M.u5.lags[0].pct), 'ISPA balita per +10 µg/m³'], [`${nRel}/27`, 'stasiun andal']];
    const t3Card = card({ id: 'ovfac', span: 's6', h: 'h320', k: 'T3 · Faktor penentu →', go: hashOf('t3'), title: 'Seberapa besar tiap faktor menjelaskan PM2.5?', sub: 'Batang = persen variasi PM2.5 yang dijelaskan tiap faktor. Faktor waktu dan cuaca menjelaskan naik turun harian, tipe lokasi menjelaskan beda antarstasiun.',
      note: `Musim menjelaskan <b>${f(100 * within[0][1], 0)}%</b> naik turun harian PM2.5, jauh di atas faktor lain. Suhu, kelembapan, dan angin masing-masing di bawah ${wxMax < 0.01 ? '1' : f(100 * wxMax, 0)}%, jadi cuaca harian bukan penentu utama.`,
      info: { rumus: 'Musim, jam, hari: porsi variasi harian yang dijelaskan bulan, jam, dan hari-dalam-minggu (median antarstasiun). Suhu, kelembapan, angin: korelasi Spearman anomali dikuadratkan. Tipe lokasi: η² antarstasiun.', data: 'pm25 harian + cuaca per jam + sites.csv', filter: true, cat: `${between.length ? `Tipe lokasi menjelaskan ${f(100 * between[0][1], 0)}% perbedaan antarstasiun. ` : ''}Hubungan statistik; data tidak memuat sumber emisi, jadi penyebab di balik lokasi dan musim tetap dugaan.` } });
    const t5Card = card({ id: 'ovnet', span: 's12', title: `Seberapa andal jaringan stasiun?`, sub: 'Titik = stasiun, warna = status datanya. Pada mode 3D, tinggi tiang = persen hari berdata sah.',
      ctrl: seg('map5mode', [['3d', 'Peta 3D'], ['2d', 'Datar']], map5Mode()),
      legend: `<span><i class="dot" style="background:var(--ok)"></i>${term('andal', 'Andal')}</span><span><i class="dot" style="background:var(--warn)"></i>${term('parsial', 'Parsial')}</span><span><i class="dot" style="background:var(--bad)"></i>${term('rusak', 'Rusak')}</span><span><i style="background:color-mix(in srgb, var(--bad) 22%, var(--surface))"></i>Provinsi prioritas</span><span><i style="background:color-mix(in srgb, var(--muted) 12%, var(--surface))"></i>Tanpa stasiun</span>`,
      body: `<div class="ov-t5m"><div class="ov-map5w"><div class="chart ov-map5" id="ovmap5" role="img" aria-label="Peta 27 stasiun menurut status data: andal, parsial, rusak"></div><div class="map3d" id="ovmap5d" role="img" aria-label="Peta 3D 27 stasiun, tinggi tiang = persen hari sah" hidden></div></div><div class="ov-t5s"><div class="ov-st"><div class="s ok" data-use="andal"><b>${nRel}</b><span>andal, ≥90% hari sah</span></div><div class="s warn" data-use="parsial"><b>${pxs.length}</b><span>parsial</span></div><div class="s bad" data-use="rusak"><b>${rusak.length}</b><span>rusak</span></div></div>`
        + `<div class="ov-reg"><a href="${hashOf('t5')}" data-prov="Papua Selatan"><span class="rt">Papua Selatan</span><span class="rx">MER-01 rusak; stasiun terdekat ${farMer} km (SRG-01).</span></a>`
        + `<a href="${hashOf('t5')}" data-prov="Jambi"><span class="rt">Pedalaman gambut Jambi</span><span class="rx">JMB-02 rusak, koordinatnya hanya ${jmbKm} km dari JMB-01.</span></a>`
        + `<a href="${hashOf('t5')}" data-prov="Sumatera Selatan"><span class="rt">Sumatera Selatan</span><span class="rx">PLB-01 punya episode terbanyak, tetapi datanya hanya ${plbOk}% hari.</span></a></div></div></div>`,
      note: nt(`${pxs.map(x => x.code).join(', ')} berstatus parsial dan tetap dipakai dengan label itu. ${rusak.map(x => x.code).join(' dan ')} dikecualikan dari T1 sampai T4, tetapi dipakai di T5. KTG-01 dan KTG-02 berkorelasi r = ${f(rk, 2)}, jadi secara informasi hampir satu titik.`,
        'Jarak lurus antarkoordinat, bukan cakupan wilayah; kembarnya KTG-01 dan KTG-02 kemungkinan artefak data sintetis.'),
      info: { rumus: 'Andal: ≥90% dari 1.018 hari punya ≥18 jam data valid. Rusak: <1% hari sah. Jarak: haversine antar koordinat sites.csv.', data: 'clean_log + sites.csv', filter: false } });
    const mapCard = card({ id: 'map', span: 's12', title: `Provinsi mana yang udaranya paling buruk?`, sub: 'Warna provinsi = kategori ISPU dari rata-rata PM2.5 stasiun di dalamnya. Abu-abu = belum terpantau.',
          ctrl: `${seg('mapyr', [['all', 'Semua'], ['1', '2024'], ['2', '2025'], ['3', '2026']], mapYear())}${seg('mapmode', [['3d', 'Peta 3D'], ['2d', 'Datar']], mapMode())}<span class="zoomb" id="zoomb"><button type="button" data-z="in" aria-label="Perbesar">+</button><button type="button" data-z="out" aria-label="Perkecil">−</button><button type="button" data-z="reset" aria-label="Kembali ke tampilan awal">⟲</button></span>`,
          body: '<div id="map-wrap" class="map-wrap"><div class="chart" id="map" role="img" aria-label="Peta provinsi Indonesia diwarnai menurut kategori ISPU rata-rata PM2.5"></div><div class="map3d" id="map3d" role="img" aria-label="Peta 3D provinsi, tiang stasiun setinggi rata-rata PM2.5" hidden></div></div>',
          note: `${pUnh.length ? `Provinsi yang udaranya sudah Tidak sehat adalah <b>${pUnh.map(x => esc(x[0])).join(', ')}</b>. ` : 'Tidak ada provinsi berkategori Tidak sehat. '}Provinsi berwarna abu-abu belum terpantau, jadi bukan berarti udaranya bersih.`,
          src: 'Batas provinsi: GeoJSON 38 provinsi (ardian28, lisensi MIT), hanya untuk gambar. Warna provinsi = rata-rata dari stasiun di provinsi itu.',
          legend: legendIspu() + '<span><i style="background:color-mix(in srgb, var(--muted) 22%, var(--surface))"></i>Tidak ada stasiun</span><span><i class="dot" style="background:var(--muted);width:9px;height:9px;outline:2px solid var(--surface)"></i>Titik atau tiang = stasiun</span>',
          table: () => ({ cols: [{ k: 'code', l: 'Kode' }, { k: 'kota', l: 'Lokasi' }, { k: 'pulau', l: 'Pulau' }, { k: 'mean', l: 'Rata-rata PM2.5', num: 1, fmt: v => f(v) }, { k: 'pct', l: '% hari > 55', num: 1, fmt: v => f(v) }, { k: 'n', l: 'Hari sah', num: 1, fmt: fi }],
            rows: rows.map(r => ({ _st: r.code, code: r.code, kota: r.s.kota, pulau: r.s.pulau, mean: r.mean, pct: r.pct, n: r.n })) }),
          info: { def: 'ISPU (Indeks Standar Pencemar Udara) mengelompokkan kadar PM2.5 menjadi lima kategori: Baik (hingga 15,5 µg/m³), Sedang (hingga 55,4), Tidak sehat (hingga 150,4), Sangat tidak sehat (hingga 250,4), dan Berbahaya (di atas 250,4).', rumus: 'Warna: kategori ISPU dari rata-rata PM2.5 periode (indikatif; ISPU resmi memakai rata-rata 24 jam). Ukuran: % hari > 55 µg/m³.', data: 'sites.csv (koordinat) + pm25 harian', cat: `${pUnh.length ? `Rata-rata: ${pUnh.map(x => `${esc(x[0])} ${f(x[1])}`).join(', ')} µg/m³. ` : ''}Hanya ${nProvSt} dari 38 provinsi punya stasiun berdata; satu stasiun bisa mewakili satu provinsi penuh.` } });
    // T4: pasien per hari per RS, hari biasa vs PM2.5 +50 µg/m³ (model log-linear, lag 0)
    const DX = 50, gain = v => Math.pow(1 + v / 100, DX / 10) - 1;
    const rl = ['u5', 'o60', 'asma', 'ppok', 'cvd', 'death'].filter(k => M[k]).map(k => { const e = M[k].lags[0]; return { k, e, base: M[k].mean, add: M[k].mean * gain(e.pct), lo: M[k].mean * gain(e.lo), hi: M[k].mean * gain(e.hi), hi1: k === 'u5' || k === 'o60' }; })
      .sort((a, b) => a.e.pct - b.e.pct);
    this._d.rel = rl;
    const rB = rl.find(r => r.k === 'u5'), rO = rl.find(r => r.k === 'o60'), rD = rl.find(r => r.k === 'death');
    const relCard = card({ id: 'ovrel', span: 's6', h: 'h320', k: 'T4 · Dampak kesehatan →', go: hashOf('t4'), title: 'Apakah pasien bertambah saat udara memburuk?',
      sub: `Dua batang per kelompok: pasien per hari di satu RS rujukan pada hari biasa (abu) dan tambahannya bila PM2.5 naik ${DX} µg/m³, kira-kira dari hari Sedang ke hari ${term('ISPU', 'Tidak sehat')}.`,
      legend: `<span><i style="background:${hexA(cv('--muted'), .3)}"></i>Hari biasa</span><span><i style="background:var(--k-gambut)"></i>Tambahan ISPA balita</span><span><i style="background:var(--k-industri)"></i>Tambahan ISPA lansia</span><span><i style="background:${hexA(cv('--muted'), .75)}"></i>Tambahan luaran lain</span>`,
      note: `Saat PM2.5 naik ${DX} µg/m³, ISPA balita naik dari <b>${f(rB.base)}</b> ke <b>${f(rB.base + rB.add)}</b> pasien per hari di tiap RS, sedangkan ISPA lansia dari ${f(rO.base)} ke ${f(rO.base + rO.add)}.`,
      info: { rumus: `Tambahan = rata-rata kasus per hari per RS × ((1 + b)^(${DX}/10) − 1), dengan b = efek per +10 µg/m³ pada hari yang sama dari model Poisson distributed-lag (efek tetap RS × bulan-tahun, hari, suhu).`, data: `${fi(D.model.n)} hari-RS (25 pasangan stasiun–RS)`, filter: false, cat: `Kematian ${f(rD.base)} → ${f(rD.base + rD.add)} per hari. Perkiraan model pada data sintetis, bukan sebab-akibat; kenaikan dari efek per +10 µg/m³ diperpanjang log-linear. Dihitung sekali untuk seluruh data, tidak berubah oleh filter.` } });
    const hhf = h => String(h).padStart(2, '0') + ':00', hv = hp.filter(v => v != null), hMin = hp.indexOf(Math.min(...hv)), pmI = [15, 16, 17, 18, 19, 20, 21].reduce((b, i) => hp[i] > hp[b] ? i : b, 15);
    const mMin = moy.indexOf(Math.min(...moy.filter(v => v != null)));
    this._d.t2 = { hp, moy, pk, pmI, mx, hhf };
    const hrCard = card({ id: 'ovhr', span: 's6', h: 'h320', k: 'T2 · Waktu &amp; wilayah kritis →', go: hashOf('t2'), title: 'Jam berapa PM2.5 memuncak?', sub: 'Garis = rata-rata PM2.5 tiap jam dalam sehari, gabungan stasiun pada filter.',
      note: `PM2.5 memuncak di pagi hari pukul <b>${hhf(pk)}</b>, ${f(hp[pk] / hp[hMin], 1)} kali jam terendah. Puncak kedua muncul di sore hari pukul <b>${hhf(pmI)}</b>.`,
      info: { rumus: 'Rata-rata PM2.5 per jam (00–23 WIB) dari seluruh jam valid, semua stasiun pada filter.', data: 'pm25 per jam', filter: true, cat: `Pukul ${hhf(pk)} rata-rata ${f(hp[pk])} µg/m³, terendah ${hhf(hMin)}, sore ${f(hp[pmI])}. Kaitan dengan jam berangkat dan pulang kerja adalah dugaan; data tidak memuat lalu lintas per jam.` } });
    const moCard = card({ id: 'ovmo', span: 's6', h: 'h320', k: 'T2 · Waktu &amp; wilayah kritis →', go: hashOf('t2'), title: 'Bulan apa PM2.5 memuncak?', sub: `Batang = rata-rata PM2.5 tiap bulan${gam.length ? ' di stasiun gambut' : ''}. Garis titik hitam = baku harian 55 µg/m³.`,
      note: `PM2.5 paling tinggi pada <b>${BULAN_L[mx]}</b>, ${f(moy[mx] / moy[mMin], 1)} kali bulan terendah (${BULAN_L[mMin]}).`,
      info: { rumus: 'Rata-rata harian PM2.5 per bulan kalender (semua tahun dalam filter), stasiun gambut bila ada, selain itu semua stasiun.', data: 'pm25 harian', filter: true, cat: `${BULAN_L[mx]} rata-rata ${f(moy[mx])} µg/m³, ${BULAN_L[mMin]} ${f(moy[mMin])}. Rata-rata bulanan menyamarkan hari-hari ekstrem; hari di atas baku dibahas di halaman Waktu kritis.` } });
    const L = typeof ljAmbang === 'function' ? { A: ljAmbang(), R: ljRS(), K: ljKalender(), B: ljBeban() } : null;
    const kpis = [
      kpi({ l: 'Rata-rata PM2.5', ic: 'air', v: f(P.mean), u: 'µg/m³', c: `${f(P.mean / BAKU_THN, 1)}× baku tahunan 15 µg/m³`, spark: 'sp1', color: ispuCol(P.mean), go: hashOf('t1'),
        info: { rumus: 'Rata-rata harian PM2.5 dari semua hari sah stasiun pada filter.', data: 'pm25 harian', filter: true } }),
      kpi({ l: 'Hari tidak sehat', ic: 'warn', v: f(P.pct, 1), u: '%', c: `${fi(P.ex)} hari-stasiun di atas baku harian 55`, spark: 'sp2', color: cv('--ispu-3'), go: hashOf('t2'),
        info: { rumus: 'Hari sah dengan rata-rata PM2.5 > 55 µg/m³ ÷ semua hari sah.', data: 'pm25 harian', filter: true } }),
      kpi({ l: 'Stasiun di atas baku', ic: 'pin', v: String(above), u: `/ ${rows.length}`, c: worst ? `terburuk ${esc(stShort(worst.code))} (${f(worst.mean)})` : '', spark: 'sp3', color: cv('--ispu-4'), go: hashOf('t1'),
        info: { rumus: 'Stasiun dengan rata-rata PM2.5 periode > 15 µg/m³ (baku tahunan PP 22/2021). Batang = 5 stasiun terburuk.', data: 'pm25 harian', filter: true } }),
      L ? kpi({ l: 'Kematian di atas normal', ic: 'heart', v: fi(L.R.tot), c: '27 RS rujukan, 1 Agu–14 Okt 2026', color: cv('--ispu-5'), go: '#/rs',
        info: { rumus: 'Σ (kematian harian − rata-rata Jan–Mei 2026 RS itu), 1 Agu–14 Okt 2026.', data: 'HLT-01', filter: false } }) : '',
      kpi({ l: 'Stasiun andal', ic: 'db', v: String(nRel), u: '/ 27', c: `${38 - nProvSt} dari 38 provinsi tanpa data`, color: cv('--ok'), go: hashOf('t5'),
        info: { rumus: 'Andal: ≥ 90% dari 1.018 hari punya ≥ 18 jam data valid.', data: 'clean_log + sites.csv', filter: false } }),
    ].join('');
    return `<div class="ov-h"><h1>Overview</h1><p>${codes.length} stasiun · ${fm(S.from)} – ${fm(S.to)}</p></div>` +
      `<p class="ov-ctx">27 stasiun AQMS dan 27 RS rujukan, 1 Jan 2024 – 14 Okt 2026, dataset sintetis panitia tanpa data tambahan. KPI dan grafik ikut filter, kecuali yang ditandai. <a href="#/metodologi">Rincian pembersihan</a>.</p>` +
      `<div class="kpis">${kpis}</div>` +
      `<div class="grid ov-g">${mapCard}${hrCard}${moCard}${t3Card}${relCard}</div>` +
      `<p class="ov-next"><a class="btn primary" href="${hashOf('t1')}">Mulai dari Langkah 1: ${PAGES.t1.nav} →</a></p>`;
  },
  mount() {
    const d = this._d; if (!d) return;
    const ms = monthlySeries(d.codes), mx = []; for (let m = S.from; m <= S.to; m++) mx.push(fmShort(m));
    const pctM = []; for (let m = S.from; m <= S.to; m++) { const t = pooled(d.codes, [monStart(m), monEnd(m)]); pctM.push(t.pct); }
    const spark = (id, data, col) => document.getElementById(id) && mk(id, { grid: { left: 0, right: 0, top: 2, bottom: 0 }, xAxis: { type: 'category', show: false, data: mx }, yAxis: { type: 'value', show: false, min: 0 },
      tooltip: { trigger: 'axis', formatter: p => `${p[0].name}: <b>${f(p[0].value)}</b>` }, series: [{ type: 'line', data, symbol: 'none', smooth: .3, lineStyle: { width: 1.6, color: col }, areaStyle: { color: col, opacity: .12 } }] });
    spark('sp1', ms, cv('--brand')); spark('sp2', pctM, cv('--ispu-3'));
    const fac = d.fac;
    const t2 = d.t2, MN3 = BULAN_L.map(m => m.slice(0, 3));
    mk('ovhr', { grid: { left: 8, right: 16, top: 30, bottom: 22, containLabel: true },
      tooltip: { trigger: 'axis', formatter: ps => `${t2.hhf(ps[0].dataIndex)}: <b>${f(ps[0].value)}</b> µg/m³` },
      xAxis: ax({ type: 'category', data: t2.hp.map((_, h) => String(h).padStart(2, '0')), boundaryGap: false, axisLabel: { color: cv('--muted'), fontSize: 11, interval: 2 } }),
      yAxis: ax({ type: 'value', min: 0, splitNumber: 4 }),
      series: [{ type: 'line', data: t2.hp, symbol: 'none', smooth: .25, lineStyle: { width: 2.6, color: cv('--k-gambut') }, areaStyle: { color: cv('--k-gambut'), opacity: .12 },
        markPoint: { symbol: 'circle', symbolSize: 11, itemStyle: { color: cv('--ispu-4'), borderColor: cv('--surface'), borderWidth: 2 }, label: { show: true, position: 'top', distance: 8, formatter: p => p.name, color: cv('--ink'), fontWeight: 700, fontSize: 11.5 },
          data: [{ name: t2.hhf(t2.pk), coord: [t2.pk, t2.hp[t2.pk]] }, { name: t2.hhf(t2.pmI), coord: [t2.pmI, t2.hp[t2.pmI]] }] } }] });
    mk('ovmo', { grid: { left: 8, right: 16, top: 30, bottom: 22, containLabel: true },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: ps => `${BULAN_L[ps[0].dataIndex]}: <b>${f(ps[0].value)}</b> µg/m³` },
      xAxis: ax({ type: 'category', data: MN3, axisLabel: { color: cv('--ink-2'), fontSize: 11.5 } }), yAxis: ax({ type: 'value', min: 0, splitNumber: 4 }),
      series: [{ type: 'bar', barWidth: '62%', data: t2.moy.map((v, i) => ({ value: v, itemStyle: { color: i === t2.mx ? cv('--ispu-4') : hexA(cv('--muted'), .45), borderRadius: [4, 4, 0, 0] } })), markLine: mlBaku() }] });
    const rel = d.rel, rCol = r => r.k === 'u5' ? cv('--k-gambut') : r.k === 'o60' ? cv('--k-industri') : hexA(cv('--muted'), .75);
    mk('ovrel', { grid: { left: 8, right: 92, top: 6, bottom: 22, containLabel: true },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: ps => { const r = rel[ps[0].dataIndex]; return `<b>${OUTC[r.k].s}</b><br>Hari biasa: <b>${f(r.base, 2)}</b> per hari per RS<br>PM2.5 +50 µg/m³: <b>${f(r.base + r.add, 2)}</b> (tambah ${f(r.add, 2)}; IK 95% ${f(r.lo, 2)}–${f(r.hi, 2)})<br>Per +10 µg/m³: ${fp(r.e.pct)}`; } },
      xAxis: ax({ type: 'value', min: 0, splitNumber: 4, axisLabel: { color: cv('--muted'), fontSize: 11 } }),
      yAxis: ax({ type: 'category', data: rel.map(r => OUTC[r.k].l), axisLabel: { color: cv('--ink-2'), fontSize: 12, fontWeight: 600 } }),
      series: [{ type: 'bar', stack: 'p', barWidth: '56%', data: rel.map(r => ({ value: r.base, itemStyle: { color: hexA(cv('--muted'), .3), borderRadius: [4, 0, 0, 4] } })) },
        { type: 'bar', stack: 'p', data: rel.map(r => ({ value: r.add, itemStyle: { color: rCol(r), borderRadius: [0, 4, 4, 0] } })),
          label: { show: true, position: 'right', formatter: p => { const r = rel[p.dataIndex]; return `${f(r.base)} → ${f(r.base + r.add)}`; }, fontSize: 11.5, fontWeight: 650, color: cv('--ink-2') } }] });
    // T5: peta provinsi bergaya sama dengan blok 1, provinsi netral, warna hanya di titik stasiun
    if (!echarts.getMap('idn') && window.PROV_GEO) echarts.registerMap('idn', PROV_GEO);
    const m5 = document.getElementById('ovmap5'), PRI = ['Papua Selatan', 'Jambi', 'Sumatera Selatan'];
    if (m5 && window.PROV_GEO) {
      m5.style.height = Math.max(240, Math.min(440, m5.clientWidth / 2.1)) + 'px';
      const stc = u => cv(u === 'andal' ? '--ok' : u === 'parsial' ? '--warn' : '--bad'), narrow5 = m5.clientWidth < 520;
      const stP = {}; ST.forEach(s => (stP[s.prov] = stP[s.prov] || []).push(s));
      const regions5 = PROV_GEO.features.map(ft => { const n = ft.properties.name, pri = PRI.includes(n);
        return { name: n, itemStyle: { areaColor: pri ? hexA(cv('--bad'), .2) : stP[n] ? hexA(cv('--muted'), .3) : hexA(cv('--muted'), .12) }, emphasis: { itemStyle: { areaColor: pri ? hexA(cv('--bad'), .32) : hexA(cv('--muted'), .42) } } }; });
      const tip5 = s => { const n = D.network.nn[s.code]; return `<b>${s.code}</b> ${esc(s.kota)}, ${esc(s.prov)}<br>Status alat: ${s.status} · data: <b>${s.use}</b> (${fi(s.q.days_ok)} hari sah)<br>Terdekat: ${n.code}, ${fi(n.km)} km${s.reason ? '<br>' + esc(s.reason) : ''}`; };
      const prov5 = n => `<b>${esc(n)}</b>${PRI.includes(n) ? ' · <span style="color:var(--bad)">prioritas</span>' : ''}<br>${stP[n] ? stP[n].map(s => `${s.code} <b>${s.use}</b>`).join(', ') : '<span style="color:var(--muted)">Tidak ada stasiun AQMS</span>'}`;
      const c5 = mk('ovmap5', {
        tooltip: { trigger: 'item' },
        geo: { map: 'idn', roam: false, aspectScale: 1, center: [118, -2.4], top: 4, bottom: 4, left: 4, right: 4,
          itemStyle: { areaColor: hexA(cv('--muted'), .12), borderColor: cv('--surface'), borderWidth: 1 },
          emphasis: { label: { show: true, color: cv('--ink'), fontSize: 11, fontWeight: 700, textBorderColor: cv('--surface'), textBorderWidth: 3 }, itemStyle: { borderColor: cv('--ink'), borderWidth: 1.2 } },
          select: { disabled: true }, label: { show: false }, tooltip: Object.assign(tipBox(), { show: true, formatter: p => p.componentType === 'geo' ? prov5(p.name) : '' }), regions: regions5 },
        series: [{ type: 'scatter', coordinateSystem: 'geo', z: 5, cursor: 'pointer', tooltip: { formatter: p => p.data && p.data.code ? tip5(BY[p.data.code]) : '' },
          data: ST.map(s => ({ code: s.code, value: [s.lon, s.lat], symbolSize: s.use === 'andal' ? (narrow5 ? 7 : 9) : (narrow5 ? 10 : 13), itemStyle: { color: stc(s.use) },
            label: s.use === 'andal' ? { show: false } : { show: true, formatter: s.code, position: s.lon > 138 ? 'left' : 'right', distance: 6, color: cv('--ink-2'), fontSize: 11, fontWeight: 650, textBorderColor: cv('--surface'), textBorderWidth: 3 } })),
          itemStyle: { borderColor: cv('--surface'), borderWidth: 1.6 }, emphasis: { focus: 'self', scale: 1.5, itemStyle: { borderColor: cv('--ink'), borderWidth: 2 } }, blur: { itemStyle: { opacity: .12 }, label: { opacity: .15 } } }],
      }, toStation);
      if (c5) document.querySelectorAll('.ov-reg [data-prov]').forEach(a => {
        a.onmouseenter = () => c5.dispatchAction({ type: 'highlight', geoIndex: 0, name: a.dataset.prov });
        a.onmouseleave = () => c5.dispatchAction({ type: 'downplay', geoIndex: 0, name: a.dataset.prov });
      });
      // mode 3D: provinsi netral, tiang = persen hari sah, warna = status
      const m5d = document.getElementById('ovmap5d'), mixP = n => PRI.includes(n) ? [cv('--bad'), .72] : stP[n] ? [cv('--muted'), .55] : null;
      const rows5 = ST.map(s => ({ code: s.code, s, mean: 0 }));
      const set5 = mode => {
        const three = mode === '3d';
        m5.style.display = three ? 'none' : ''; m5d.hidden = !three;
        if (!three) { disposeMap3D('b'); const c = CH.get('ovmap5'); if (c) c.resize(); return; }
        if (MAP3D_B) return;
        m5d.style.height = Math.max(300, Math.min(560, m5d.clientWidth / 1.45)) + 'px'; m5d.classList.add('loading');
        loadThree().then(() => {
          if (!m5d.isConnected || m5d.hidden || MAP3D_B) return;
          m5d.classList.remove('loading');
          MAP3D_B = makeMap3D(m5d, { agg: {}, rows: rows5, provCol: mixP, pinVal: r => 100 * r.s.q.days_ok / ND, pinMax: 100, pinCol: r => stc(r.s.use),
            labelPins: ps => ps.filter(q => q.r.s.use !== 'andal'), labelTxt: r => `${f(100 * r.s.q.days_ok / ND, 0)}%`,
            tipSt: c => tip5(BY[c]), tipProv: prov5, onPick: u => { const c = u.code || (stP[u.prov] || [])[0]?.code; if (c) go('stasiun', { st: c }); } });
          if (!MAP3D_B) { const b = document.querySelector('[data-seg="map5mode"] [data-v="2d"]'); if (b) b.click(); }
        }).catch(() => { m5d.classList.remove('loading'); const b = document.querySelector('[data-seg="map5mode"] [data-v="2d"]'); if (b) b.click(); });
      };
      bindSeg(document, 'map5mode', v => { map5Mode(v); set5(v); });
      set5(map5Mode());
      // arahkan kursor ke kotak status: stasiun berstatus itu disorot di peta
      document.querySelectorAll('.ov-st [data-use]').forEach(b => {
        const codes = ST.filter(s => s.use === b.dataset.use).map(s => s.code), idx = ST.map((s, i) => s.use === b.dataset.use ? i : -1).filter(i => i >= 0);
        b.onmouseenter = () => { b.classList.add('on'); if (MAP3D_B && !m5d.hidden) MAP3D_B.focus(codes); else if (c5) c5.dispatchAction({ type: 'highlight', seriesIndex: 0, dataIndex: idx }); };
        b.onmouseleave = () => { b.classList.remove('on'); if (MAP3D_B) MAP3D_B.focus(null); if (c5) c5.dispatchAction({ type: 'downplay', seriesIndex: 0 }); };
      });
    }
    document.querySelectorAll('.ov-steps [data-ov]').forEach(b => b.onclick = () => { const t = document.getElementById('ov-t' + b.dataset.ov); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
    mk('ovfac', { grid: { left: 8, right: 50, top: 8, bottom: 20, containLabel: true }, tooltip: { formatter: p => `${fac[p.dataIndex].l}: <b>${f(100 * fac[p.dataIndex].v)}%</b> variasi (${fac[p.dataIndex].w})` },
      xAxis: ax({ type: 'value', max: 100, axisLabel: { formatter: '{value}%', color: cv('--muted'), fontSize: 11 } }), yAxis: ax({ type: 'category', data: fac.map(x => x.l), axisLabel: { color: cv('--ink-2'), fontSize: 12 } }),
      series: [{ type: 'bar', barWidth: '58%', data: fac.map(x => ({ value: 100 * x.v, itemStyle: { color: x.hi ? cv('--k-gambut') : hexA(cv('--muted'), .45), borderRadius: [0, 4, 4, 0] } })), label: { show: true, position: 'right', formatter: p => f(p.value, p.value < 1 ? 1 : 0) + '%', fontSize: 11, color: cv('--ink-2') } }] });
    const tipOf = code => { const r = d.rows.find(x => x.code === code); return r ? `<b>${r.code}</b> ${esc(r.s.kota)}, ${esc(r.s.prov)}<br>${r.s.kel} · ${r.s.pulau}<br>Rata-rata PM2.5 <b>${f(r.mean)}</b> µg/m³ ${ispuBadge(r.mean)}<br>Hari > 55: <b>${f(r.pct)}%</b> dari ${fi(r.n)} hari` : ''; };
    const top5 = d.rows.slice().sort((a, b) => b.mean - a.mean).slice(0, 5);
    document.getElementById('sp3') && mk('sp3', { grid: { left: 0, right: 0, top: 2, bottom: 0 },
      tooltip: { trigger: 'item', appendToBody: true, confine: false, formatter: p => tipOf(p.data.code) },
      xAxis: { type: 'category', show: false, data: top5.map(r => r.code) },
      yAxis: { type: 'value', show: false, min: 0 },
      series: [{ type: 'bar', barWidth: '70%', cursor: 'pointer', data: top5.map(r => ({ code: r.code, value: r.mean - BAKU_THN, itemStyle: { color: ispuCol(r.mean), borderRadius: [3, 3, 0, 0] } })),
        emphasis: { itemStyle: { opacity: .8 } } }] }, toStation);
    if (!echarts.getMap('idn') && window.PROV_GEO) echarts.registerMap('idn', PROV_GEO);
    const byProv = {};
    d.rows.forEach(r => (byProv[r.s.prov] = byProv[r.s.prov] || []).push(r));
    const provAgg = Object.fromEntries(Object.entries(byProv).map(([p, g]) => [p, { g: g.slice().sort((a, b) => b.mean - a.mean), mean: mean(g.map(r => r.mean)), pct: mean(g.map(r => r.pct)) }]));
    const provTip = name => {
      const a = provAgg[name];
      if (!a) return `<b>${esc(name)}</b><br><span style="color:var(--muted)">Tidak ada stasiun AQMS di provinsi ini</span>`;
      const c = ispuOf(a.mean);
      return `<b>${esc(name)}</b> ${ispuBadge(a.mean)}<br>Rata-rata PM2.5 <b>${f(a.mean)}</b> µg/m³ · kategori <b>${c.l}</b><br>Hari > 55: <b>${f(a.pct)}%</b> (rata-rata stasiun)<br>` +
        `<span style="color:var(--muted)">${a.g.length} stasiun:</span> ` + a.g.map(r => `${r.code} <b>${f(r.mean)}</b>`).join(', ');
    };
    const mEl = document.getElementById('map'), m3 = document.getElementById('map3d'), home = { zoom: 1, center: [118, -2.4] };
    const draw2d = () => {
    if (CH.get('map')) return CH.get('map').resize();
    mEl.style.height = Math.max(160, Math.min(520, mEl.clientWidth / 2.25)) + 'px';
    const narrow = mEl.clientWidth < 560;
    const regions = PROV_GEO.features.map(ft => { const a = provAgg[ft.properties.name]; return { name: ft.properties.name,
      itemStyle: { areaColor: a ? hexA(ispuCol(a.mean), .82) : hexA(cv('--muted'), .2) }, emphasis: { itemStyle: { areaColor: a ? ispuCol(a.mean) : hexA(cv('--muted'), .35) } } }; });
    const ch = mk('map', {
      tooltip: { trigger: 'item', formatter: p => p.componentType === 'geo' ? provTip(p.name) : p.data && p.data.code ? tipOf(p.data.code) : '' },
      geo: { map: 'idn', roam: 'move', aspectScale: 1, zoom: home.zoom, center: home.center, scaleLimit: { min: .9, max: 8 },
        top: 4, bottom: 4, left: 4, right: 4,
        itemStyle: { areaColor: hexA(cv('--muted'), .2), borderColor: cv('--surface'), borderWidth: 1 },
        emphasis: { label: { show: true, color: cv('--ink'), fontSize: 11, fontWeight: 700, textBorderColor: cv('--surface'), textBorderWidth: 3 }, itemStyle: { borderColor: cv('--ink'), borderWidth: 1.2 } },
        select: { disabled: true }, label: { show: false }, tooltip: Object.assign(tipBox(), { show: true, formatter: p => p.componentType === 'series' ? (p.data && p.data.code ? tipOf(p.data.code) : '') : provTip(p.name) }), regions },
      series: [{ type: 'scatter', coordinateSystem: 'geo', z: 5, cursor: 'pointer', tooltip: { formatter: p => p.data && p.data.code ? tipOf(p.data.code) : '' },
        data: d.rows.map(r => ({ code: r.code, value: [r.s.lon, r.s.lat], itemStyle: { color: ispuCol(r.mean) } })),
        symbolSize: narrow ? 7 : 9, itemStyle: { borderColor: cv('--surface'), borderWidth: 1.6 },
        emphasis: { scale: 1.6, itemStyle: { borderColor: cv('--ink'), borderWidth: 2 } } }],
    }, toStation);
    if (ch) ch.on('click', p => { if (p.componentType === 'geo' && provAgg[p.name]) go('stasiun', { st: provAgg[p.name].g[0].code }); });
    };
    const zoom2d = z => {
      const c = CH.get('map'); if (!c) return;
      const g = c.getOption().geo[0];
      if (z === 'reset') c.setOption({ geo: { zoom: home.zoom, center: home.center } });
      else c.setOption({ geo: { zoom: Math.max(.9, Math.min(8, g.zoom * (z === 'in' ? 1.4 : 1 / 1.4))) } });
    };
    const pick3d = u => { const c = u.code || (provAgg[u.prov] && provAgg[u.prov].g[0].code); if (c) go('stasiun', { st: c }); };
    const setMode = mode => {
      const three = mode === '3d';
      mEl.style.display = three ? 'none' : ''; m3.hidden = !three;
      if (!three) { disposeMap3D('a'); return draw2d(); }
      if (MAP3D) return;
      m3.style.height = Math.max(300, Math.min(620, m3.clientWidth / 1.5)) + 'px';
      m3.classList.add('loading');
      loadThree().then(() => {
        if (!m3.isConnected || m3.hidden || MAP3D) return;
        m3.classList.remove('loading');
        MAP3D = makeMap3D(m3, { agg: provAgg, rows: d.rows, tipSt: tipOf, tipProv: provTip, onPick: pick3d });
        if (!MAP3D) fallback();
      }).catch(fallback);
    };
    const fallback = () => { m3.classList.remove('loading'); const b = document.querySelector('[data-seg="mapmode"] [data-v="2d"]'); if (b) b.click(); else setMode('2d'); };
    bindSeg(document, 'mapmode', v => { mapMode(v); setMode(v); });
    bindSeg(document, 'mapyr', v => { const p = PRESETS[v === 'all' ? 0 : +v]; setS({ from: p[1], to: p[2] }); });
    document.getElementById('zoomb').onclick = e => {
      const z = e.target.closest('[data-z]'); if (!z) return;
      if (!m3.hidden && MAP3D) MAP3D[{ in: 'zin', out: 'zout', reset: 'reset' }[z.dataset.z]](); else zoom2d(z.dataset.z);
    };
    setMode(mapMode());
  },
};

/* ================= T1 KONDISI ================= */
PAGES.t1 = {
  title: 'Kondisi udara', nav: 'Kondisi', group: 'Alur analisis', steps: true,
  html() {
    const codes = active().map(s => s.code); if (!codes.length) return ph({ k: 'Langkah 1', h: 'Seberapa buruk udara kita?', lede: '' }) + emptyMsg;
    const P = POLS[S.pol], rows = codes.map(c => ({ code: c, s: BY[c], ...magg(c, S.pol) })).filter(r => r.n).sort((a, b) => b.mean - a.mean);
    const above = P.thn ? rows.filter(r => r.mean > P.thn).length : null;
    const isl = PULAU.map(p => ({ p, v: mean(rows.filter(r => r.s.pulau === p).map(r => r.mean)) })).filter(x => x.v != null).sort((a, b) => b.v - a.v);
    const dmb = codes.map(c => ({ code: c, a: magg(c, S.pol, 0, 8).mean, c: magg(c, S.pol, 12, 20).mean, b: magg(c, S.pol, 24, 32).mean })).filter(x => x.a && x.b).map(x => ({ ...x, ch: 100 * (x.b / x.a - 1) }));
    const worse = dmb.filter(x => x.ch > 5), better = dmb.filter(x => x.ch < -5), mono = worse.filter(x => x.c != null && x.c >= x.a && x.b >= x.c), odd = worse.filter(x => !mono.includes(x));
    const who = S.pol === 'pm25' ? rows.filter(r => r.mean > 5).length : null;
    const dg = S.pol === 'co' ? 0 : 1, below = P.thn ? rows.filter(r => r.mean <= P.thn) : [], unh = S.pol === 'pm25' ? rows.filter(r => r.mean > 55.4) : [];
    const allLatar = below.length && below.every(r => r.s.kel === 'Latar bersih');
    // tren: puncak tiap pulau; sumbu dipotong bila satu pulau jauh melampaui yang lain
    const tr = PULAU.map(p => { const s = monthlySeries(codes.filter(c => BY[c].pulau === p), S.pol); let mi = -1; s.forEach((v, i) => { if (v != null && (mi < 0 || v > s[mi])) mi = i; }); return { p, s, mi, mx: mi < 0 ? null : s[mi] }; }).filter(x => x.mx != null).sort((a, b) => b.mx - a.mx);
    const top = tr[0], sec = tr[1], cap = top && sec && top.mx > 2 * sec.mx ? (S.pol === 'pm25' ? Math.max(150, Math.ceil(sec.mx * 1.4 / 10) * 10) : Math.ceil(sec.mx * 1.5 / 10) * 10) : null;
    const tp = top ? top.s.filter((v, i) => v != null && MONTHS[S.from + i].slice(0, 4) < MONTHS[S.from + top.mi].slice(0, 4)) : [], topPrev = tp.length ? Math.max(...tp) : null;
    // antarpulau: sebaran di dalam pulau
    const islSt = isl.map(x => { const v = rows.filter(r => r.s.pulau === x.p).map(r => r.mean); return { ...x, n: v.length, lo: Math.min(...v), hi: Math.max(...v) }; });
    const wide = islSt.filter(x => x.n > 1).sort((a, b) => (b.hi - b.lo) - (a.hi - a.lo))[0], small = islSt.filter(x => x.n <= 2);
    // komposisi ISPU
    const sr = stRows(codes).filter(r => r.n), unhShare = r => 100 * (r.cats[2] + r.cats[3] + r.cats[4]) / r.n;
    const wst = sr.slice().sort((a, b) => unhShare(b) - unhShare(a))[0], haz = sr.filter(r => r.cats[4] > 0).map(r => r.code), noBaik = sr.filter(r => r.cats[0] === 0);
    const whyP = Object.entries(POLS).map(([k, Q]) => { let ex = 0, n = 0, ab = 0, m = 0; codes.forEach(c => { const a = magg(c, k); if (a.n) { ex += a.ex; n += a.n; m++; if (Q.thn && a.mean > Q.thn) ab++; } }); return { k, l: Q.l, pct: n ? 100 * ex / n : null, ab, m, thn: Q.thn }; }).filter(x => x.pct != null).sort((a, b) => b.pct - a.pct);
    const wp = k => whyP.find(x => x.k === k) || {}, gasMax = Math.max(0, ...whyP.filter(x => !['pm25', 'pm10'].includes(x.k)).map(x => x.pct));
    this._d = { codes, rows, dmb, cap, top, whyP };
    const lede = `${P.thn ? `<b>${above} dari ${rows.length}</b> stasiun berada di atas baku tahunan (${fi(P.thn)} µg/m³), dengan yang terburuk` : 'Yang terburuk'} di <b>${rows[0] ? stName(rows[0].code) : '–'}</b> (rata-rata ${f(rows[0]?.mean, S.pol === 'co' ? 0 : 1)} µg/m³).`;
    const cols = [{ k: 'code', l: 'Kode' }, { k: 'kota', l: 'Lokasi' }, { k: 'pulau', l: 'Pulau' }, { k: 'kel', l: 'Tipe' }, { k: 'mean', l: `Rata-rata ${P.l}`, num: 1, fmt: v => f(v) }, { k: 'pct', l: `% hari > baku`, num: 1, fmt: v => f(v) }, { k: 'n', l: 'Hari sah', num: 1, fmt: fi }];
    const short = S.to - S.from + 1 < 12;
    return ph({ k: 'Langkah 1 · Kondisi', h: 'Seberapa buruk udara kita?', lede, goal: 1,
      scope: `Dasar: ${rows.length} stasiun berdata · rata-rata dari ${term('hari sah')} · baku PP 22/2021 · nilai terukur, bukan prediksi.` }) +
      `<div class="grid">
      <h2 class="t-sec">Kenapa PM2.5?</h2>
      ${whyP.length > 1 ? card({ id: 'why', span: 's12', h: 'h260', title: 'Kenapa fokus pada partikel, dan kenapa PM2.5?',
        sub: `Kiri: persen hari-stasiun yang melewati ${term('baku 24 jam', 'baku harian')} untuk enam polutan (CO dan O₃ memakai baku 8 jam). Kanan: PM10 terhadap PM2.5 per hari.`,
        lead: `Masalahnya partikel: gas hampir tidak pernah melewati baku (paling banyak ${f(gasMax, 1)}% hari). PM10 dan PM2.5 naik turun bersamaan hampir persis, jadi memantau PM2.5 sudah cukup mewakili keduanya.`, note: nt(`Gas (NO₂, SO₂, CO, O₃) hampir tidak pernah melewati baku (maks ${f(gasMax, 1)}% hari), jadi masalahnya partikel. PM10 lebih sering lewat baku (${f(wp('pm10').pct, 1)}% vs ${f(wp('pm25').pct, 1)}%), tetapi bergerak hampir sama dengan PM2.5 (r = 0,997). PM2.5 dipilih karena masuk sampai paru dalam dan darah, lebih banyak stasiun melewati baku tahunannya (${wp('pm25').ab} vs ${wp('pm10').ab}), dan menjadi acuan ${term('ISPU')}.`,
          'Grafik mengukur seberapa sering baku dilewati, bukan dampak kesehatan. Titik scatter adalah sampel; persentase ikut filter.'),
        table: () => ({ cols: [{ k: 'l', l: 'Polutan' }, { k: 'pct', l: '% hari di atas baku harian', num: 1, fmt: v => f(v, 1) }, { k: 'ab', l: 'Stasiun di atas baku tahunan', num: 1, fmt: (v, r) => r.thn ? `${v} / ${r.m}` : '–' }], rows: whyP }),
        info: { rumus: '% hari = hari-stasiun sah dengan rata-rata harian (CO, O₃: maksimum rata-rata bergerak 8 jam) di atas baku PP 22/2021 ÷ seluruh hari-stasiun sah. Korelasi PM2.5–PM10: Pearson harian per stasiun, median antarstasiun 0,997 (terendah 0,959); median rasio PM2.5/PM10 0,67.', data: 'Data per jam → harian, 25 stasiun', cat: 'Korelasi dan rasio dihitung sekali dari daily.parquet (folder analisis/), tidak ikut filter.' } }) : ''}
      <h2 class="t-sec">Seberapa buruk, dan di mana?</h2>
      ${card({ id: 'rank', span: 's7', h: 'h520', title: `Stasiun mana ${P.l}-nya tertinggi?`, sub: S.pol === 'pm25' ? 'Satu baris per stasiun, diurutkan dari rata-rata tertinggi. Warna = kategori ' + term('ISPU') + '. Garis titik hitam = pedoman WHO, baku tahunan, dan rata-rata semua stasiun.' : `Warna = rata-rata dibanding baku. Garis putus-putus = rata-rata semua stasiun${P.thn ? ' dan baku tahunan ' + fi(P.thn) + ' µg/m³' : ` (${P.stdL}, tidak ada baku tahunan)`}.`,
        legend: S.pol === 'pm25' ? legendIspu() : legendRank(P),
        lead: P.thn ? `Dari ${rows.length} stasiun, hanya <b>${below.length}</b> yang memenuhi baku tahunan${below.length && allLatar ? ', semuanya stasiun latar bersih' : ''}. ${unh.length ? `Ada ${unh.length} stasiun yang rata-ratanya sudah masuk kategori Tidak sehat. ` : ''}${who != null ? (who === rows.length ? 'Tidak ada satu pun yang berada di bawah pedoman WHO.' : `Hanya ${rows.length - who} stasiun yang berada di bawah pedoman WHO.`) : ''}` : null, note: nt(P.thn ? `Hanya <b>${below.length}</b> stasiun memenuhi baku tahunan${below.length ? ` (${below.map(r => r.code).join(', ')}${allLatar ? `, semuanya ${term('latar bersih')}` : ''})` : ''}.${unh.length ? ` <b>${unh.length}</b> stasiun rata-ratanya bahkan sudah Tidak sehat: ${unh.map(r => r.code).join(', ')}.` : ''}${who != null ? ` ${who === rows.length ? `Tidak ada satu pun` : `Hanya ${rows.length - who}`} yang di bawah pedoman ${term('WHO 5')}.` : ''}`
          : `${P.l} tidak punya baku tahunan; pembandingnya ${P.stdL}. Tertinggi: <b>${rows[0] ? stName(rows[0].code) : '–'}</b>.`,
          short ? 'Baku tahunan berlaku untuk setahun penuh; untuk periode lebih pendek hanya indikasi.' : ''),
        table: () => ({ cols, rows: rows.map(r => ({ _st: r.code, code: r.code, kota: r.s.kota, pulau: r.s.pulau, kel: r.s.kel, mean: r.mean, pct: r.pct, n: r.n })) }),
        info: { rumus: `Rata-rata ${P.l} harian (hari sah) per stasiun; "% hari > baku" memakai ${P.stdL}${S.pol === 'co' || S.pol === 'o3' ? ' (maksimum rata-rata bergerak 8 jam per hari)' : ''}.`, data: 'Bulanan per stasiun dari 27 file AQMS', cat: 'Stasiun ppm (BJB-01, MDN-01, PSW-01) sudah dikonversi ke µg/m³.' } })}
      ${card({ id: 'isl', span: 's5', h: 'h520', title: 'Pulau mana yang udaranya paling buruk?', sub: 'Satu baris per pulau, diurutkan dari rata-rata tertinggi. Titik = stasiun (warna = tipe lokasi), cincin = rata-rata pulau.', legend: legendKel() + `<span><i style="background:transparent;border:3px solid var(--ispu-2);border-radius:50%"></i>Cincin = rata-rata pulau (warna = kategori ISPU)</span>`,
        lead: islSt.length > 1 ? `<b>${islSt[0].p}</b> paling kotor, ${f(islSt[0].v / islSt[islSt.length - 1].v, 1)} kali lipat ${islSt[islSt.length - 1].p}. ${wide ? `Di dalam satu pulau pun sebarannya bisa lebar, misalnya ${wide.p} dari ${f(wide.lo, dg)} sampai ${f(wide.hi, dg)} µg/m³.` : ''}` : null, note: islSt.length > 1 ? nt(`<b>${islSt[0].p}</b> (${f(islSt[0].v, dg)}) ${f(islSt[0].v / islSt[islSt.length - 1].v, 1)}× <b>${islSt[islSt.length - 1].p}</b> (${f(islSt[islSt.length - 1].v, dg)}).${wide ? ` Di dalam pulau sebarannya lebar, misalnya ${wide.p} ${f(wide.lo, dg)}–${f(wide.hi, dg)} µg/m³.` : ''}`,
          small.length ? `${small.map(x => `${x.p} hanya ${x.n} stasiun`).join(', ')}, jadi rata-ratanya mudah berubah.` : '') : '',
        table: () => ({ cols: [{ k: 'p', l: 'Pulau' }, { k: 'n', l: 'Stasiun', num: 1 }, { k: 'v', l: `Rata-rata ${P.l}`, num: 1, fmt: v => f(v) }], rows: isl.map(x => ({ p: x.p, n: rows.filter(r => r.s.pulau === x.p).length, v: x.v })) }),
        info: { rumus: 'Rata-rata pulau = rata-rata dari rata-rata stasiun (setiap stasiun berbobot sama).', data: 'Sama dengan peringkat' } })}
      <h2 class="t-sec">Seberapa sering?</h2>
      ${card({ id: 'ispu', span: 's12', title: 'Berapa hari udara tidak sehat di tiap stasiun?', sub: 'Satu batang per stasiun, dibagi menurut kategori ' + term('ISPU') + ' PM2.5 harian. Diurutkan dari porsi tidak sehat terbesar.', legend: legendIspu(),
        lead: wst ? `Paling berat ada di <b>${stName(wst.code)}</b>, ${f(unhShare(wst), 0)}% harinya Tidak sehat atau lebih buruk. Sebanyak ${noBaik.length} dari ${sr.length} stasiun tidak pernah mencatat hari Baik, dan ${haz.length} stasiun pernah mencatat hari Berbahaya.` : null, note: wst ? nt(`Paling berat: <b>${stName(wst.code)}</b>, ${f(unhShare(wst), 0)}% harinya Tidak sehat atau lebih buruk. <b>${noBaik.length}</b> dari ${sr.length} stasiun tak pernah sehari pun Baik; ${haz.length} pernah mencatat hari Berbahaya.`,
          'Kategori dari PM2.5 saja, bukan indeks resmi semua polutan.') : '',
        table: () => ({ cols: [{ k: 'code', l: 'Kode' }].concat(ISPU.map((c, i) => ({ k: 'c' + i, l: c.l, num: 1, fmt: fi }))), rows: stRows(codes).map(r => { const o = { _st: r.code, code: r.code }; r.cats.forEach((v, i) => o['c' + i] = v); return o; }) }),
        info: { rumus: 'Hari dikelompokkan memakai batas ISPU PM2.5: 15,5 / 55,4 / 150,4 / 250,4 µg/m³.', data: 'pm25 harian', cat: 'Permen LHK 14/2020.' } })}
      <h2 class="t-sec">Apakah membaik?</h2>
      ${card({ id: 'trend', span: 's7', h: 'h380', title: `Bagaimana ${P.l} berubah tiap bulan?`, sub: 'Satu garis per pulau: rata-rata PM2.5 bulanan stasiun di dalamnya. Pita abu = kemarau (Juli–Oktober).',
        lead: top ? `Puncak tertinggi ada di <b>${top.p}</b>, ${f(top.mx, dg)} µg/m³ pada ${fm(S.from + top.mi)}${topPrev ? `, ${f(top.mx / topPrev, 1)} kali puncaknya di tahun-tahun sebelumnya` : ''}. ${sec ? `Pulau lain naik turun mengikuti musim, dengan puncak tertinggi ${f(sec.mx, dg)} µg/m³ di ${sec.p}.` : ''}` : null, note: top ? nt(`Puncak tertinggi: <b>${top.p}</b> ${f(top.mx, dg)} µg/m³ (${fm(S.from + top.mi)})${topPrev ? `, ${f(top.mx / topPrev, 1)}× puncaknya pada tahun-tahun sebelumnya` : ''}. ${sec ? `Pulau lain naik-turun mengikuti musim, paling tinggi ${f(sec.mx, dg)} (${sec.p}).` : ''}`,
          cap ? `Sumbu dipotong di ${fi(cap)} µg/m³ agar pulau lain terbaca.` : '') : '',
        legend: PULAU.map((p, i) => `<span><i class="line" style="background:${['var(--k-gambut)', 'var(--k-industri)', 'var(--k-kota)', 'var(--k-jalan)', 'var(--k-bersih)'][i]}"></i>${p}</span>`).join(''),
        info: { rumus: 'Per bulan: rata-rata dari rata-rata bulanan stasiun di pulau itu.', data: 'Bulanan per stasiun' } })}
      ${card({ id: 'dmb', span: 's5', title: 'Membaik atau memburuk sejak 2024?', sub: `Titik = rata-rata ${P.l} Januari–September: 2024 (abu), 2025 (kecil), 2026 (berwarna). Dibatasi sampai September karena data 2026 berhenti 14 Oktober.`,
        legend: `<span><i class="dot" style="background:var(--muted)"></i>2024</span><span><i class="dot" style="background:var(--ink-2);width:6px;height:6px"></i>2025</span><span><i class="dot" style="background:var(--div-bad)"></i>2026 memburuk (lebih dari +5%)</span>${better.length ? '<span><i class="dot" style="background:var(--div-good)"></i>2026 membaik (lebih dari −5%)</span>' : ''}`,
        lead: `Sebanyak <b>${worse.length}</b> stasiun memburuk lebih dari 5% dibanding periode yang sama di 2024, ${better.length ? `sedangkan <b>${better.length}</b> membaik` : 'dan <b>tidak ada</b> yang membaik'}. ${mono.length} di antaranya naik dua tahun berturut-turut, jadi ini tren dan bukan sekadar lonjakan asap 2026.`, note: nt(`<b>${worse.length}</b> stasiun memburuk lebih dari 5%, ${better.length ? `<b>${better.length}</b>` : '<b>tidak ada</b>'} yang membaik. <b>${mono.length}</b> di antaranya naik <b>dua tahun berturut-turut</b>, jadi ini tren, bukan hanya lonjakan asap 2026.${odd.length ? ` ${odd.map(x => x.code).join(', ')} melonjak di 2025${odd.some(x => x.code === 'BJB-01') ? ' karena sensor macet (data parsial)' : ''}.` : ''}`, `${dmb.length - worse.length - better.length} stasiun lain berubah kurang dari 5% dan hanya tercantum di tabel.`),
        table: () => ({ cols: [{ k: 'code', l: 'Kode' }, { k: 'a', l: 'Jan–Sep 2024', num: 1, fmt: v => f(v) }, { k: 'c', l: 'Jan–Sep 2025', num: 1, fmt: v => f(v) }, { k: 'b', l: 'Jan–Sep 2026', num: 1, fmt: v => f(v) }, { k: 'ch', l: 'Perubahan', num: 1, fmt: v => fp(v) }], rows: dmb.slice().sort((a, b) => b.ch - a.ch).map(x => ({ _st: x.code, ...x })) }),
        info: { rumus: 'Perubahan = (Jan–Sep 2026 ÷ Jan–Sep 2024) − 1. Naik berturut-turut: 2024 ≤ 2025 ≤ 2026. Tidak mengikuti filter periode.', data: 'Bulanan per stasiun', cat: 'Data sintetis berpola tahunan berulang; kenaikan besar terutama karena episode kabut asap 2026.' } })}
      ${jawab(1, `${P.thn ? `${above >= .8 * rows.length ? 'Hampir semua stasiun' : `${above} dari ${rows.length} stasiun`} mencatat rata-rata ${P.l} di atas baku tahunan` : `${P.l} tidak punya baku tahunan`}${who === rows.length ? ', tidak satu pun memenuhi pedoman WHO,' : ''} dan dalam dua tahun ${better.length ? 'lebih banyak yang memburuk daripada membaik' : 'belum ada yang membaik'}.`,
        'Udara kotor di sini bukan masalah satu-dua kota, melainkan hampir seluruh jaringan. Yang perlu didahulukan adalah stasiun yang rata-ratanya sudah Tidak sehat dan yang terus naik dua tahun terakhir.',
        'rata-rata setahun bisa menutupi hari-hari terburuk, misalnya saat kemarau. Kapan hari-hari itu datang dibahas di langkah berikutnya.')}
      </div>`;
  },
  mount(C) {
    const d = this._d; if (!d) return; const P = POLS[S.pol], dg = S.pol === 'co' ? 0 : 1;
    const rr = d.rows.slice().reverse();
    const sumN = d.rows.reduce((t, r) => t + r.n, 0), avgAll = sumN ? d.rows.reduce((t, r) => t + r.mean * r.n, 0) / sumN : null;
    const refLines = [avgAll != null && { v: avgAll, t: 'rata-rata ' + f(avgAll, dg), d: [2, 4], tip: `<b>Rata-rata ${P.l}: ${f(avgAll, dg)} µg/m³</b><br>Rata-rata semua stasiun, dihitung dari seluruh hari sah (minimal 18 jam data valid) pada periode dan filter yang dipilih.` }, P.thn && { v: P.thn, t: 'baku tahunan ' + fi(P.thn), d: [8, 4], tip: `<b>Baku tahunan ${P.l}: ${fi(P.thn)} µg/m³</b><br>Batas rata-rata setahun menurut PP 22/2021 Lampiran VII. Dipakai sebagai pembanding indikatif.` }, S.pol === 'pm25' && { v: 5, t: 'WHO 5', d: [2, 3], who: 1, tip: '<b>Pedoman WHO PM2.5: 5 µg/m³</b><br>Pedoman kesehatan tahunan WHO Global Air Quality Guidelines 2021, lebih ketat dari baku nasional.' }].filter(Boolean);
    const rkNar = (document.getElementById('rank') || {}).clientWidth < 520;
    mk('rank', { grid: { left: 8, right: 54, top: rkNar ? 50 : 28, bottom: 22, containLabel: true }, tooltip: { extraCssText: 'max-width:270px;white-space:normal;line-height:1.5', formatter: p => { if (p.componentType === 'markLine') return p.name; const r = rr[p.dataIndex]; return `<b>${r.code}</b> ${esc(r.s.kota)}<br>Rata-rata ${P.l}: <b>${f(r.mean, dg)}</b> µg/m³<br>Hari > baku: ${f(r.pct)}% (${fi(r.ex)} dari ${fi(r.n)})`; } },
      xAxis: ax({ type: 'value', name: 'µg/m³', nameLocation: 'end', nameGap: 4 }), yAxis: ax({ type: 'category', data: rr.map(r => r.code), axisLabel: { color: cv('--ink-2'), fontSize: 11 } }),
      series: [{ type: 'bar', barWidth: '62%', data: rr.map(r => ({ value: r.mean, itemStyle: { color: S.pol === 'pm25' ? ispuCol(r.mean) : rankCol(r.mean, P), borderRadius: [0, 4, 4, 0] } })),
        label: { show: true, position: 'right', formatter: p => f(p.value, dg), fontSize: 10.5, color: cv('--ink-2'), backgroundColor: cv('--surface'), padding: [0, 3], borderRadius: 3 },
        markLine: { silent: false, symbol: 'none', animation: false, data: refLines.map((l, i) => ({ xAxis: l.v, name: l.tip, label: { formatter: l.t, position: 'end', rotate: 0, align: l.who ? 'right' : l.v === P.thn && refLines.some(x => x.who) ? 'left' : 'center', offset: l.who ? [2, 0] : l.v === P.thn && refLines.some(x => x.who) ? [-2, 0] : rkNar && i === 0 && refLines.length > 1 ? [0, -22] : [0, 0], color: cv('--ink'), fontSize: 11.5, fontWeight: 700, fontFamily: FONT, backgroundColor: cv('--surface'), padding: [2, 5], borderRadius: 4, borderColor: cv('--ink'), borderWidth: 1 }, lineStyle: { color: cv('--ink'), type: l.d, width: 2, cap: 'round' } })) } }] }, p => go('stasiun', { st: rr[p.dataIndex].code }));
    // pulau
    const xs = PULAU.filter(p => d.rows.some(r => r.s.pulau === p)).map(p => { const st = d.rows.filter(r => r.s.pulau === p); return { p, st, avg: mean(st.map(r => r.mean)) }; }).sort((a, b) => b.avg - a.avg);
    const pts = []; xs.forEach((g, gi) => g.st.forEach((r, i) => pts.push({ value: [r.mean, gi + (g.st.length > 1 ? [-.26, -.13, 0, .13, .26][i % 5] : 0)], code: r.code, itemStyle: { color: kelCol(r.s.kel) } })));
    const avgs = xs.map((g, gi) => ({ value: [g.avg, gi], isl: g.p, n: g.st.length, itemStyle: { color: 'rgba(0,0,0,0)', borderWidth: 4, borderColor: S.pol === 'pm25' ? ispuCol(g.avg) : rankCol(g.avg, P) } }));
    mk('isl', { grid: { left: 8, right: 52, top: 8, bottom: 22, containLabel: true },
      tooltip: { formatter: p => p.data.code ? `<b>${p.data.code}</b> ${esc(BY[p.data.code].kota)}<br>${BY[p.data.code].kel} · ${esc(BY[p.data.code].prov)}<br>Rata-rata ${P.l}: <b>${f(p.data.value[0], dg)}</b> µg/m³` : `<b>${p.data.isl}</b> (${p.data.n} stasiun)<br>Rata-rata ${P.l}: <b>${f(p.data.value[0], dg)}</b> µg/m³` },
      xAxis: ax({ type: 'value', min: 0, name: 'µg/m³', nameLocation: 'end', nameGap: 4, axisLine: { onZero: false, lineStyle: { color: cv('--line-2') } } }),
      yAxis: [ax({ type: 'category', data: xs.map(g => g.p), inverse: true, boundaryGap: true, splitLine: { show: false }, axisLine: { show: false }, axisTick: { show: false },
        axisLabel: { interval: 0, formatter: (v, i) => `{n|${v}}
{c|${xs[i].st.length} stasiun}`, rich: { n: { color: cv('--ink'), fontSize: 12, fontWeight: 700, lineHeight: 16 }, c: { color: cv('--muted'), fontSize: 10.5, lineHeight: 14 } } } }),
        ax({ type: 'value', inverse: true, min: -.5, max: xs.length - .5, show: false, splitLine: { show: false } })],
      series: [{ type: 'scatter', yAxisIndex: 1, silent: true, z: 1, symbolSize: 0, tooltip: { show: false }, data: xs.map((g, i) => [0, i]),
          markLine: { silent: true, symbol: 'none', animation: false, label: { show: false }, lineStyle: { color: cv('--line'), type: 'solid', width: 1 }, data: xs.slice(1).map((_, i) => ({ yAxis: i + .5 })) } },
        { type: 'scatter', yAxisIndex: 1, data: pts, symbolSize: 11, z: 2, itemStyle: { borderColor: cv('--surface'), borderWidth: 1.5 }, emphasis: { scale: 1.3 } },
        { type: 'scatter', yAxisIndex: 1, data: avgs, symbolSize: 24, z: 4, emphasis: { scale: 1.1 },
          label: { show: true, position: 'right', distance: 10, formatter: q => f(q.data.value[0], dg), fontSize: 12, fontWeight: 700, color: cv('--ink'), fontFamily: FONT, backgroundColor: cv('--surface'), padding: [1, 4], borderRadius: 3 } }] }, toStation);
    // tren
    const mx = []; for (let m = S.from; m <= S.to; m++) mx.push(fmShort(m));
    const colsP = ['--k-gambut', '--k-industri', '--k-kota', '--k-jalan', '--k-bersih'];
    const dry = []; for (let m = S.from; m <= S.to; m++) { const mo = +MONTHS[m].slice(5); if (mo === 7) dry.push([{ xAxis: fmShort(m) }, { xAxis: fmShort(Math.min(S.to, m + 3)) }]); }
    mk('trend', { grid: { left: 8, right: 74, top: 24, bottom: 8, containLabel: true }, tooltip: { trigger: 'axis', valueFormatter: v => f(v, dg) + ' µg/m³' },
      xAxis: ax({ type: 'category', data: mx, boundaryGap: false }), yAxis: ax({ type: 'value', name: P.l + ' µg/m³', nameGap: 8, max: d.cap || null }),
      series: PULAU.map((p, i) => ({ name: p, type: 'line', symbol: 'none', clip: true, lineStyle: { width: 2, color: cv(colsP[i]) }, itemStyle: { color: cv(colsP[i]) },
        data: monthlySeries(d.codes.filter(c => BY[c].pulau === p), S.pol), endLabel: { show: true, formatter: p, color: cv('--ink-2'), fontSize: 11 }, labelLayout: { moveOverlap: 'shiftY' },
        markPoint: d.cap && d.top.p === p ? { silent: true, symbol: 'triangle', symbolSize: 9, symbolRotate: 0, itemStyle: { color: cv(colsP[i]) }, data: [{ coord: [mx[d.top.mi], d.cap], label: { show: true, position: 'left', distance: 6, formatter: `puncak ${f(d.top.mx, S.pol === 'co' ? 0 : 1)}`, color: cv('--ink'), fontSize: 11, fontWeight: 700, fontFamily: FONT, backgroundColor: cv('--surface'), padding: [1, 4], borderRadius: 3 } }] } : undefined,
        markArea: i === 0 ? { silent: true, itemStyle: { color: cv('--surface-3'), opacity: .6 }, data: dry } : undefined })).filter(s => s.data.some(v => v != null)) });
    // dumbbell
    const db = d.dmb.filter(x => Math.abs(x.ch) > 5).sort((a, b) => a.ch - b.ch);
    const dmbEl = document.getElementById('dmb'); if (dmbEl) dmbEl.style.height = Math.max(200, db.length * 26 + 56) + 'px';
    mk('dmb', { grid: { left: 8, right: 132, top: 8, bottom: 22, containLabel: true },
      tooltip: { formatter: p => { const x = db[p.data[3]]; return `<b>${x.code}</b> ${esc(BY[x.code].kota)}<br>Jan–Sep 2024: ${f(x.a, dg)} → 2025: ${f(x.c, dg)} → 2026: <b>${f(x.b, dg)}</b><br>Perubahan 2024–2026 <b>${fp(x.ch)}</b>`; } },
      xAxis: ax({ type: 'value', name: 'µg/m³', nameGap: 4, min: 0 }), yAxis: ax({ type: 'category', data: db.map(x => x.code), axisLabel: { color: cv('--ink-2'), fontSize: 11, interval: 0 } }),
      series: [{ type: 'custom', data: db.map((x, i) => [x.a, x.b, i, i]), encode: { x: [0, 1], y: 2 },
        renderItem: (p, api) => { const a = api.coord([api.value(0), api.value(2)]), b = api.coord([api.value(1), api.value(2)]), x = db[api.value(3)], m = x.c != null ? api.coord([x.c, api.value(2)]) : null;
          const col = x.ch > 5 ? cv('--div-bad') : x.ch < -5 ? cv('--div-good') : cv('--div-mid');
          const seg = m ? [[a, m], [m, b]] : [[a, b]];
          return { type: 'group', children: [...seg.map(([u, v]) => ({ type: 'line', shape: { x1: u[0], y1: u[1], x2: v[0], y2: v[1] }, style: { stroke: col, lineWidth: 2, opacity: .7 } })),
            { type: 'circle', shape: { cx: a[0], cy: a[1], r: 4 }, style: { fill: cv('--muted') } },
            ...(m ? [{ type: 'circle', shape: { cx: m[0], cy: m[1], r: 3 }, style: { fill: cv('--ink-2'), stroke: cv('--surface'), lineWidth: 1 } }] : []),
            { type: 'circle', shape: { cx: b[0], cy: b[1], r: 5.5 }, style: { fill: col, stroke: cv('--surface'), lineWidth: 1.5 } },
            { type: 'text', style: { text: `${fp(x.ch, 0)} (${f(x.a, 0)} → ${f(x.c, 0)} → ${f(x.b, 0)})`, x: Math.max(a[0], b[0], m ? m[0] : 0) + 10, y: a[1], verticalAlign: 'middle', fill: cv('--ink'), fontSize: 11, fontFamily: FONT } }] }; } }] }, p => go('stasiun', { st: db[p.data[3]].code }));
    // kenapa PM2.5: % hari di atas baku harian per polutan
    if (d.whyP && d.whyP.length > 1) { const wr = d.whyP.slice().reverse();
      const el = document.getElementById('why'), W = el ? el.clientWidth : 1000, wide = W >= 720, sc = (window.DATA || {}).why_sc;
      if (el) el.style.height = sc ? (wide ? '310px' : '600px') : '';
      const bl = (e, axis, v, tip) => refLine(v, e, { axis, tip });
      const g0 = sc ? (wide ? { left: 8, width: Math.round(W * .5) - 20, top: 6, bottom: 20 } : { left: 8, right: 8, top: 6, height: 220 }) : { left: 8, right: 48, top: 6, bottom: 20 };
      const g1 = wide ? { left: Math.round(W * .5) + 58, right: 14, top: 54, bottom: 44 } : { left: 58, right: 14, top: 312, bottom: 44 };
      const tx = (text, left, top) => ({ text, left, top, textStyle: { fontSize: 12.5, fontWeight: 700, color: cv('--ink'), fontFamily: FONT } });
      const opt = { grid: [Object.assign({ containLabel: true }, g0)].concat(sc ? [g1] : []),
        tooltip: { formatter: p => { if (p.seriesType === 'scatter') return `PM2.5 <b>${f(p.value[0], 0)}</b> · PM10 <b>${f(p.value[1], 0)}</b> µg/m³`; const x = wr[p.dataIndex]; return `<b>${x.l}</b><br>${f(x.pct, 1)}% hari di atas baku harian${x.thn ? `<br>${x.ab} dari ${x.m} stasiun di atas baku tahunan` : ''}`; } },
        xAxis: [ax({ type: 'value', min: 0, axisLabel: { formatter: v => f(v, 0) + '%', color: cv('--muted'), fontSize: 11 } })],
        yAxis: [ax({ type: 'category', data: wr.map(x => x.l), axisLabel: { color: cv('--ink-2'), fontSize: 12, fontWeight: 600 } })],
        series: [{ type: 'bar', barWidth: '58%', data: wr.map(x => ({ value: x.pct, itemStyle: { color: x.k === 'pm25' ? cv('--brand') : x.k === 'pm10' ? cv('--k-bersih') : cv('--line-2'), borderRadius: [0, 4, 4, 0] } })),
          label: { show: true, position: 'right', formatter: p => f(p.value, 1) + '%', fontSize: 11, color: cv('--ink-2') } }] };
      if (sc) {
        opt.title = [tx('PM10 mengikuti PM2.5 hampir persis (harian, sampel)', wide ? Math.round(W * .5) + 8 : 8, wide ? 0 : 258)];
        opt.xAxis.push(ax({ gridIndex: 1, type: 'log', min: 1, name: 'PM2.5 harian (µg/m³, skala log)', nameLocation: 'middle', nameGap: 26, nameTextStyle: { color: cv('--muted'), fontSize: 11, fontFamily: FONT }, axisLabel: { color: cv('--muted'), fontSize: 11 } }));
        opt.yAxis.push(ax({ gridIndex: 1, type: 'log', min: 1, max: 2000, name: 'PM10', nameLocation: 'end', nameTextStyle: { color: cv('--muted'), fontSize: 11, fontFamily: FONT, align: 'left' }, axisLabel: { color: cv('--muted'), fontSize: 11 } }));
        opt.series.push({ type: 'scatter', xAxisIndex: 1, yAxisIndex: 1, symbolSize: 4, data: sc.pts, itemStyle: { color: cv('--brand'), opacity: .35 },
          markLine: mlRef([bl('baku PM2.5 55', 'xAxis', 55, 'Baku mutu harian PM2.5 = 55 µg/m³ (PP 22/2021). Titik di kanan garis ini adalah hari dengan PM2.5 di atas baku.'), bl('baku PM10 75', 'yAxis', 75, 'Baku mutu harian PM10 = 75 µg/m³ (PP 22/2021). Titik di atas garis ini adalah hari dengan PM10 di atas baku.')]) });
        opt.series.push({ type: 'line', xAxisIndex: 1, yAxisIndex: 1, silent: true, showSymbol: false, data: [[1, 1 / sc.ratio], [1000, 1000 / sc.ratio]], lineStyle: { color: cv('--k-bersih'), width: 1.6 }, z: 1, tooltip: { show: false } });
      }
      { const key = [S.from, S.to, [].concat(S.pulau || []).join(), [].concat(S.kel || []).join()].join('|'); if (window.__whyKey === key) opt.animation = false; window.__whyKey = key; }  // ganti polutan: kartu ini tidak ikut beranimasi ulang
      mk('why', opt); }
    // ISPU stacked
    const sr = stRows(d.codes).filter(r => r.n).map(r => ({ ...r, sh: r.cats.map(v => 100 * v / r.n) })).sort((a, b) => (b.sh[2] + b.sh[3] + b.sh[4]) - (a.sh[2] + a.sh[3] + a.sh[4]) || (b.sh[1] - a.sh[1]) || a.code.localeCompare(b.code));
    mk('ispu', { grid: { left: 8, right: 10, top: 10, bottom: 8, containLabel: true }, tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: ps => `<b>${ps[0].name}</b> ${esc(BY[ps[0].name].kota)}<br>` + ps.map(p => `${p.marker}${p.seriesName}: <b>${f(p.value)}%</b>`).join('<br>') },
      xAxis: ax({ type: 'category', data: sr.map(r => r.code), axisLabel: { color: cv('--ink-2'), fontSize: 10.5, rotate: 45, interval: 0 } }),
      yAxis: ax({ type: 'value', max: 100, axisLabel: { formatter: '{value}%', color: cv('--muted'), fontSize: 11 } }),
      series: ISPU.map((c, i) => ({ name: c.l, type: 'bar', stack: 's', barWidth: '64%', data: sr.map(r => r.sh[i]), itemStyle: { color: cv(c.v), borderColor: cv('--surface'), borderWidth: 1 } })) },
      p => go('stasiun', { st: sr[p.dataIndex].code }));
  },
};

/* ================= T2 WAKTU KRITIS ================= */
PAGES.t2 = {
  title: 'Waktu & wilayah kritis', nav: 'Waktu kritis', group: 'Alur analisis', steps: true,
  html() {
    const codes = active().map(s => s.code); if (!codes.length) return ph({ k: 'Langkah 2', h: 'Kapan harus siaga?', lede: '' }) + emptyMsg;
    const hp = hourProfile(codes), pk = hp.indexOf(Math.max(...hp)), lo = hp.indexOf(Math.min(...hp));
    const kelIn = KEL.filter(k => codes.some(c => BY[c].kel === k));
    const moyK = Object.fromEntries(kelIn.map(k => [k, moyProfile(codes.filter(c => BY[c].kel === k))]));
    const g = moyK['Gambut'], gMax = g ? Math.max(...g.filter(v => v != null)) : null, gMin = g ? Math.min(...g.filter(v => v != null)) : null;
    const [d0, d1] = range(); const wk = [0, 0], wn = [0, 0];
    for (const c of codes) { const a = D.pm25[c]; for (let i = d0; i <= d1; i++) if (a[i] != null) { const w = (dayDate(i).getUTCDay() + 6) % 7 >= 5 ? 1 : 0; wk[w] += a[i]; wn[w]++; } }
    const wkd = wn[0] && wn[1] ? 100 * ((wk[1] / wn[1]) / (wk[0] / wn[0]) - 1) : null;
    const eps = episodesIn(codes);
    const chronic = stRows(codes).filter(r => r.n && r.pct >= 90).map(r => r.code);
    // jam × bulan: rata-rata per sel, per bulan, per jam
    const acc = {}; for (let m = S.from; m <= S.to; m++) { const mo = +MONTHS[m].slice(5) - 1; for (const c of codes) D.hm[c][m].forEach((v, h) => { if (v == null) return; (acc[mo + '_' + h] = acc[mo + '_' + h] || []).push(v); }); }
    const cells = Object.entries(acc).map(([k, v]) => { const [mo, h] = k.split('_').map(Number); return [h, mo, mean(v)]; });
    const cMax = cells.reduce((b, c) => c[2] > b[2] ? c : b, cells[0] || [0, 0, 0]), cMin = cells.reduce((b, c) => c[2] < b[2] ? c : b, cells[0] || [0, 0, 0]);
    const rowM = BULAN.map((_, mo) => mean(cells.filter(c => c[1] === mo).map(c => c[2]))).filter(v => v != null), colH = hp.filter(v => v != null);
    const hh = h => String(h).padStart(2, '0') + ':00';
    // musim per tipe: rasio puncak ÷ bulan terbersih
    const ses = kelIn.map(k => { const v = moyK[k].filter(x => x != null); const mx = Math.max(...v); return { k, mx, mo: moyK[k].indexOf(mx), r: mx / Math.min(...v) }; }).sort((a, b) => b.r - a.r);
    // pola jam per tipe: puncak pagi (05–11) dan sore (15–21)
    const hk = kelIn.map(k => { const h = hourProfile(codes.filter(c => BY[c].kel === k)), m = mean(h); const am = [5, 6, 7, 8, 9, 10, 11].reduce((b, i) => h[i] > h[b] ? i : b, 5), pm = [15, 16, 17, 18, 19, 20, 21].reduce((b, i) => h[i] > h[b] ? i : b, 15); return { k, am, pm, amI: 100 * h[am] / m, top: h.indexOf(Math.max(...h)) }; });
    const allAm = hk.length && hk.every(x => x.top >= 5 && x.top <= 11), uniq = a => [...new Set(a)].sort((x, y) => x - y).map(hh).join(' atau ');
    // kronis vs musiman: hari > 55 di Juli–Oktober vs bulan lain
    const kr = codes.map(c => { let ex = 0, dry = 0; const a = D.pm25[c]; for (let i = d0; i <= d1; i++) { const v = a[i]; if (v != null && v > BAKU) { ex++; const mo = dayDate(i).getUTCMonth(); if (mo >= 6 && mo <= 9) dry++; } } return { code: c, ex, dry, oth: ex - dry, sh: ex ? 100 * dry / ex : null }; }).filter(x => x.ex > 0).sort((a, b) => b.ex - a.ex);
    const kron = kr.filter(x => x.sh < 50), mus = kr.filter(x => x.sh >= 90), camp = kr.filter(x => x.sh >= 50 && x.sh < 90);
    // kalender stasiun terpilih
    if (!BY[S.st] || BY[S.st].use === 'rusak') S.st = 'KTG-01';
    const ca = D.pm25[S.st], cy0 = dayIdx(`${S.yr}-01-01`), cy1 = S.yr === 2026 ? ND - 1 : dayIdx(`${S.yr}-12-31`); let cBad = 0, cHaz = 0, cN = 0, cFirst = null;
    for (let i = cy0; i <= cy1; i++) { const v = ca[i]; if (v == null) continue; cN++; if (v > 55.4) cBad++; if (v > 250.4) cHaz++; if (v > 150.4 && cFirst == null) cFirst = i; }
    // episode per tahun
    const eY = [2024, 2025, 2026].map(y => [y, eps.filter(e => e.start.slice(0, 4) === String(y)).length]).filter(x => x[1]);
    const eMo = [...new Set(eps.map(e => +e.start.slice(5, 7)))], eSt = [...new Set(eps.map(e => e.code))], eL = eps.slice().sort((a, b) => b.days - a.days)[0];
    const eK = KEL.map(k => [k, eps.filter(e => BY[e.code].kel === k).length]).filter(x => x[1]).sort((a, b) => b[1] - a[1]);
    const ePrev = eps.map(e => D.pm25[e.code][dayIdx(e.start) - 1]).filter(v => v != null), eWarn = ePrev.filter(v => v > BAKU).length;
    this._d = { codes, kelIn, moyK, eps, cells, kr };
    const yrs = [2024, 2025, 2026];
    return ph({ k: 'Langkah 2 · Waktu & wilayah kritis', h: 'Kapan dan di mana siaga?',
      lede: `Udara paling kotor sekitar pukul <b>${hh(pk)}</b>${g ? ` dan memuncak di <b>${BULAN_L[g.indexOf(gMax)]}</b> pada stasiun gambut` : ''}, dan <b>${mus.length}</b> stasiun memburuk saat kemarau${kron.length ? ` (hanya <b>${kron.map(x => stName(x.code)).join(', ')}</b> yang buruk sepanjang tahun)` : ''}.`, goal: 2,
      scope: `Dasar: data per jam dan harian dari ${codes.length} stasiun · ${term('Episode kabut asap', 'episode')} = ≥3 hari berturut-turut di atas 150,4 µg/m³ · nilai terukur, bukan prediksi.` }) +
      `<div class="grid">
      <h2 class="t-sec">Bulan apa?</h2>
      ${card({ id: 'heat', span: 's7', h: 'h380', title: 'Jam berapa dan bulan apa PM2.5 memuncak?', sub: 'Tiap kotak = rata-rata PM2.5 pada satu jam dan satu bulan, gabungan stasiun pada filter. Makin gelap makin kotor.',
        lead: cells.length ? `PM2.5 paling tinggi pada <b>${BULAN_L[cMax[1]]} pukul ${hh(cMax[0])}</b> (${f(cMax[2])} µg/m³). Bulan lebih menentukan daripada jam: selisih bulan terkotor dan terbersih ${f(Math.max(...rowM) / Math.min(...rowM), 1)} kali, sedangkan selisih jam hanya ${f(Math.max(...colH) / Math.min(...colH), 1)} kali.` : null, note: cells.length ? nt(`Paling kotor: <b>${BULAN_L[cMax[1]]} pukul ${hh(cMax[0])}</b> (${f(cMax[2])} µg/m³). Bulan lebih menentukan daripada jam: selisih bulan terkotor dan terbersih ${f(Math.max(...rowM) / Math.min(...rowM), 1)}×, selisih jam hanya ${f(Math.max(...colH) / Math.min(...colH), 1)}×.`) : '',
        info: { rumus: 'Rata-rata jam ke-h pada bulan kalender m, dirata-ratakan antarstasiun.', data: 'Data per jam setelah pembersihan (VALID, tanpa sensor macet)' } })}
      ${card({ id: 'season', span: 's5', h: 'h380', title: 'Bulan apa PM2.5 tertinggi di tiap tipe lokasi?', sub: 'Satu garis per tipe lokasi: rata-rata PM2.5 tiap bulan kalender.', legend: legendKel(this._d.kelIn),
        note: ses.length ? nt(`Stasiun <b>${ses[0].k.toLowerCase()}</b> melonjak ${f(ses[0].r, 1)} kali di ${BULAN_L[ses[0].mo]} (${f(ses[0].mx)} µg/m³).${ses.length > 1 ? ` Stasiun <b>${ses[ses.length - 1].k.toLowerCase()}</b> hampir datar sepanjang tahun (${f(ses[ses.length - 1].r, 1)} kali).` : ''}`) : '',
        table: () => ({ cols: [{ k: 'k', l: 'Tipe' }].concat(BULAN.map((b, i) => ({ k: 'm' + i, l: b, num: 1, fmt: v => f(v, 0) }))), rows: kelIn.map(k => { const o = { k }; moyK[k].forEach((v, i) => o['m' + i] = v); return o; }) }),
        info: { rumus: 'Rata-rata hari sah per bulan kalender untuk stasiun bertipe sama.', data: 'pm25 harian' } })}
      <h2 class="t-sec">Jam dan hari apa?</h2>
      ${card({ id: 'hour', span: 's8', title: 'Jam berapa PM2.5 tertinggi dalam sehari?', sub: 'Satu garis per tipe lokasi, dengan rata-rata hariannya dijadikan 100 (garis titik hitam). Di atas garis berarti lebih kotor dari biasanya.', legend: legendKel(this._d.kelIn),
        lead: hk.length ? `${allAm ? 'Semua tipe lokasi' : 'Sebagian besar tipe lokasi'} paling kotor di pagi hari sekitar pukul ${uniq(hk.map(x => x.am))}, lalu naik lagi di sore hari sekitar pukul ${uniq(hk.map(x => x.pm))}.` : null, note: hk.length ? nt(`${allAm ? 'Semua tipe lokasi' : 'Sebagian besar tipe'} paling kotor pagi hari (pukul ${uniq(hk.map(x => x.am))}), lalu naik lagi sore (pukul ${uniq(hk.map(x => x.pm))}).`,
          'Kaitan dengan jam berangkat dan pulang kerja adalah tafsiran; tidak ada data lalu lintas per jam.') : '',
        info: { rumus: 'Profil jam tiap tipe dibagi rata-rata 24 jamnya × 100, agar bentuk pola bisa dibandingkan meski levelnya berbeda.', data: 'Data per jam' } })}
      ${card({ id: 'dow', span: 's4', title: 'Apakah akhir pekan lebih bersih?', sub: 'Batang = rata-rata PM2.5 (µg/m³) tiap hari dalam seminggu. Oranye = akhir pekan.',
        note: wkd != null ? nt(`Akhir pekan <b>${fp(wkd)}</b> dibanding hari kerja, ${Math.abs(wkd) < 3 ? 'praktis sama, hari libur tidak membuat udara lebih bersih.' : wkd < 0 ? 'akhir pekan lebih bersih.' : 'akhir pekan justru lebih kotor.'}`,
          'Tidak ada data jumlah kendaraan per hari.') : '',
        info: { rumus: 'Rata-rata hari sah per hari dalam seminggu, gabungan stasiun.', data: 'pm25 harian' } })}
      <h2 class="t-sec">Di mana?</h2>
      ${card({ id: 'kron', span: 's12', h: 'h380', title: 'Udara buruk kronis atau musiman?',
        sub: `Batang = jumlah hari PM2.5 harian di atas 55 µg/m³ (${term('baku 24 jam')}), dipisah antara kemarau (Juli–Oktober) dan bulan lain. Hanya stasiun yang pernah melewati 55.`,
        legend: '<span><i style="background:var(--k-gambut)"></i>Juli–Oktober (kemarau)</span><span><i style="background:var(--k-bersih)"></i>Bulan lain</span>',
        lead: kr.length ? `${kron.length ? `<b>${kron.map(x => x.code).join(', ')}</b> tergolong kronis: ${kron.map(x => `${fi(x.ex)} hari di atas baku, hanya ${f(x.sh, 0)}% di antaranya pada Juli–Oktober`).join('; ')}. ` : ''}Sebanyak <b>${mus.length}</b> stasiun lain musiman, hampir seluruh hari tidak sehatnya jatuh di Juli–Oktober. Pola kronis tidak selesai dengan menunggu hujan, sedangkan pola musiman bisa disiapkan menjelang kemarau.` : null, note: kr.length ? nt(`${kron.length ? `<b>${kron.map(x => x.code).join(', ')}</b> ${term('kronis')}: ${kron.map(x => `${fi(x.ex)} hari, hanya ${f(x.sh, 0)}% di Juli–Oktober`).join('; ')}. ` : ''}<b>${mus.length}</b> stasiun ${term('musiman')}: ≥90% hari tidak sehatnya di Juli–Oktober${camp.length ? `; ${camp.map(x => `${x.code} di antaranya (${f(x.sh, 0)}%)`).join(', ')}` : ''}. Pola kronis tidak selesai dengan menunggu hujan; pola musiman bisa disiagakan menjelang kemarau.`,
          'Kalau tersebar rata sepanjang tahun, porsi Juli–Oktober sekitar 33%.') : 'Tidak ada stasiun yang melewati 55 µg/m³ pada filter ini.',
        table: () => ({ cols: [{ k: 'code', l: 'Kode' }, { k: 'ex', l: 'Hari > 55', num: 1, fmt: fi }, { k: 'dry', l: 'Jul–Okt', num: 1, fmt: fi }, { k: 'oth', l: 'Bulan lain', num: 1, fmt: fi }, { k: 'sh', l: '% di Jul–Okt', num: 1, fmt: v => f(v, 0) }], rows: kr.map(x => ({ _st: x.code, ...x })) }),
        info: { rumus: 'Per stasiun: hitung hari sah dengan PM2.5 harian > 55 µg/m³, lalu pisahkan menurut bulan kejadiannya (Juli–Oktober vs bulan lain). Kronis: < 50% di Juli–Oktober. Musiman: ≥ 90%.', data: 'pm25 harian', cat: 'Ambang kronis dan musiman ditetapkan tim untuk membedakan dua pola; 55 µg/m³ = baku 24 jam PP 22/2021.' } })}
      <h2 class="t-sec">Kabut asap</h2>
      ${card({ id: 'eps', span: 's12', h: 'h260', title: 'Di mana episode kabut asap terjadi?', sub: `Batang = jumlah hari ${term('Episode kabut asap', 'episode')} per stasiun (≥3 hari berturut-turut di atas 150,4 µg/m³), dipisah per tahun. Di bawah kode tertulis tipe lokasi.`, legend: [2024, 2025, 2026].map((y, i) => `<span><i style="background:color-mix(in srgb, var(--ispu-4) ${[35, 65, 100][i]}%, var(--surface))"></i>${y}</span>`).join(''),
        lead: eps.length ? `Terjadi <b>${eps.length}</b> episode di ${eSt.length} stasiun, dan yang terpanjang berlangsung <b>${eL.days} hari</b> di ${eL.code} (${fds(eL.start)} sampai ${fds(eL.end)}). Sebanyak ${eK[0][1]} dari ${eps.length} episode terjadi di stasiun ${eK[0][0].toLowerCase()}.` : null, note: eps.length ? nt(`<b>${eps.length}</b> episode di ${eSt.length} stasiun, semua dimulai ${eMo.every(m => m >= 7 && m <= 10) ? `${BULAN_L[Math.min(...eMo) - 1]}–${BULAN_L[Math.max(...eMo) - 1]}` : `pada bulan ${eMo.sort((a, b) => a - b).map(m => BULAN_L[m - 1]).join(', ')}`}; per tahun ${eY.map(([y, n]) => `${y}: ${n}`).join(', ')}. Terpanjang <b>${eL.days} hari</b> di ${eL.code} (${fds(eL.start)} – ${fds(eL.end)}). <b>${eK[0][1]} dari ${eps.length}</b> episode terjadi di stasiun ${eK[0][0].toLowerCase()}${eK.length > 1 ? ` (${eK.slice(1).map(x => `${x[0].toLowerCase()} ${x[1]}`).join(', ')})` : ''}.${ePrev.length ? ` Dari ${ePrev.length} episode yang hari sebelumnya tercatat, <b>${eWarn === ePrev.length ? 'semuanya' : eWarn}</b> didahului hari Tidak sehat (di atas 55 µg/m³), jadi kenaikan harian bisa dipakai sebagai tanda awal.` : ''}`,
          `Ambang 150,4 µg/m³ dan minimal 3 hari ditetapkan tim. ${eps.length - ePrev.length ? `${eps.length - ePrev.length} episode lain tidak bisa dicek karena hari sebelumnya kosong (${[...new Set(eps.filter(e => D.pm25[e.code][dayIdx(e.start) - 1] == null).map(e => e.code))].join(', ')}).` : ''}`) : 'Tidak ada episode pada filter ini.',
        table: () => ({ cols: [{ k: 'code', l: 'Kode' }, { k: 'start', l: 'Mulai' }, { k: 'end', l: 'Selesai' }, { k: 'days', l: 'Hari', num: 1 }, { k: 'mean', l: 'Rata-rata', num: 1, fmt: v => f(v) }, { k: 'peak', l: 'Puncak', num: 1, fmt: v => f(v) }], rows: this._d.eps.map(e => ({ _st: e.code, ...e })) }),
        info: { rumus: 'Episode = deretan ≥3 hari sah berturut-turut dengan PM2.5 harian > 150,4 µg/m³ (batas ISPU "Sangat tidak sehat").', data: 'pm25 harian' } })}
      ${card({ id: 'cal', span: 's12', h: 'h220', title: `Hari apa udara tidak sehat di ${esc(S.st)}?`, sub: 'Tiap kotak satu hari, diwarnai menurut kategori ISPU. Abu-abu = tidak ada data sah.',
        lead: cN ? `Pada ${S.yr}, <b>${fi(cBad)}</b> dari ${fi(cN)} hari sah berkategori Tidak sehat atau lebih buruk${cHaz ? `, termasuk <b>${fi(cHaz)}</b> hari Berbahaya` : ''}. ${cFirst != null ? `Hari pertama yang melewati 150,4 µg/m³ jatuh pada <b>${fd(cFirst)}</b>.` : 'Tidak ada hari yang melewati 150,4 µg/m³.'}` : null, note: cN ? nt(`Tahun ${S.yr}: <b>${fi(cBad)}</b> dari ${fi(cN)} hari sah berkategori Tidak sehat atau lebih buruk${cHaz ? `, termasuk <b>${fi(cHaz)}</b> hari Berbahaya` : ''}.${cFirst != null ? ` Hari pertama di atas 150,4 µg/m³: <b>${fd(cFirst)}</b>.` : ' Tidak ada hari di atas 150,4 µg/m³.'}`) : '',
        ctrl: `<span class="ctrl"><span>Stasiun</span>${stSelect('calSt', S.st)}</span>${seg('yr', yrs.map(y => [y, y]), S.yr)}`, legend: legendIspu(),
        info: { rumus: 'Rata-rata 24 jam PM2.5 per hari (hari sah ≥18 jam).', data: 'pm25 harian + HLT-01', filter: false } })}
      ${jawab(2, `Udara paling buruk biasanya <b>pagi hari sekitar pukul ${hh(pk)}</b>, dan dalam setahun memuncak pada <b>${ses[0] ? BULAN_L[ses[0].mo] : 'musim kemarau'}</b>. ${mus.length} stasiun memburuk hanya saat kemarau${kron.length ? `, sedangkan <b>${kron.map(x => stName(x.code)).join(', ')}</b> buruk hampir sepanjang tahun` : ''}.`,
        'Siaga bisa dijadwalkan. Untuk stasiun musiman, persiapan dimulai menjelang Juli; untuk stasiun kronis, sumbernya perlu dikendalikan sepanjang tahun. Aktivitas luar ruang di pagi hari paling berisiko.',
        'pola ini dihitung dari Januari 2024 sampai 14 Oktober 2026. Awal musim kabut asap bisa bergeser tiap tahun; tanggal mulai per stasiun ada di <a href="#/kalender">Kalender siaga</a>.')}
      </div>`;
  },
  mount(C) {
    const d = this._d; if (!d) return;
    // heatmap jam x bulan kalender
    const cells = d.cells.map(([h, mo, v]) => [h, mo, Math.round(v * 10) / 10]), vmin = Math.min(...d.cells.map(c => c[2])), vmax = Math.max(...d.cells.map(c => c[2]));
    mk('heat', { grid: { left: 8, right: 12, top: 8, bottom: 48, containLabel: true }, tooltip: { formatter: p => `${BULAN_L[p.data[1]]}, pukul ${String(p.data[0]).padStart(2, '0')}:00<br>PM2.5 rata-rata <b>${f(p.data[2])}</b> µg/m³` },
      xAxis: ax({ type: 'category', data: Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')), splitLine: { show: false }, name: 'jam', nameGap: 4 }),
      yAxis: ax({ type: 'category', data: BULAN, inverse: true, splitLine: { show: false } }),
      visualMap: { min: vmin, max: vmax, calculable: false, orient: 'horizontal', left: 'center', bottom: 0, itemHeight: 140, itemWidth: 10, text: [f(vmax, 0), f(vmin, 0) + ' µg/m³'], textStyle: { color: cv('--muted'), fontSize: 11 },
        inRange: { color: ['--seq-0', '--seq-1', '--seq-2', '--seq-3', '--seq-4', '--seq-5'].map(cv) } },
      series: [{ type: 'heatmap', data: cells, itemStyle: { borderColor: cv('--surface'), borderWidth: 1, borderRadius: 2 }, emphasis: { itemStyle: { borderColor: cv('--ink'), borderWidth: 1.5 } } }] });
    // musim
    mk('season', { grid: { left: 8, right: 84, top: 22, bottom: 8, containLabel: true }, tooltip: { trigger: 'axis', valueFormatter: v => f(v) + ' µg/m³' },
      xAxis: ax({ type: 'category', data: BULAN, boundaryGap: false }), yAxis: ax({ type: 'value', name: 'PM2.5 µg/m³', nameGap: 8 }),
      series: d.kelIn.map(k => ({ name: k, type: 'line', data: d.moyK[k], symbol: 'none', lineStyle: { width: 2.2, color: kelCol(k) }, itemStyle: { color: kelCol(k) }, endLabel: { show: true, formatter: k, fontSize: 11, color: cv('--ink-2') }, labelLayout: { moveOverlap: 'shiftY' } }))
        });
    // jam per kelompok
    mk('hour', { grid: { left: 8, right: 84, top: 22, bottom: 8, containLabel: true }, tooltip: { trigger: 'axis', valueFormatter: v => f(v, 0) },
      xAxis: ax({ type: 'category', data: Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')), boundaryGap: false, name: 'jam', nameGap: 4, axisPointer: { label: { formatter: p => p.value + ':00' } } }),
      yAxis: ax({ type: 'value', name: 'indeks', nameGap: 8, min: v => Math.floor(v.min / 10) * 10 }),
      series: d.kelIn.map(k => { const h = hourProfile(d.codes.filter(c => BY[c].kel === k)), m = mean(h); return { name: k, type: 'line', data: h.map(v => 100 * v / m), symbol: 'none', lineStyle: { width: 2, color: kelCol(k) }, itemStyle: { color: kelCol(k) }, endLabel: { show: true, formatter: k, fontSize: 11, color: cv('--ink-2') }, labelLayout: { moveOverlap: 'shiftY' } }; })
        .concat([{ type: 'line', data: [], markLine: mlRef([refLine(100, 'rata-rata = 100', { tip: 'Rata-rata harian tipe lokasi itu diberi nilai 100. Titik di atas garis berarti jam itu lebih kotor dari rata-rata harinya; di bawah garis berarti lebih bersih.' })]) }]) });
    // dow
    const [d0, d1] = range(), s7 = new Array(7).fill(0), n7 = new Array(7).fill(0);
    for (const c of d.codes) { const a = D.pm25[c]; for (let i = d0; i <= d1; i++) if (a[i] != null) { const w = (dayDate(i).getUTCDay() + 6) % 7; s7[w] += a[i]; n7[w]++; } }
    const dv = s7.map((v, i) => n7[i] ? v / n7[i] : null), wkm = mean(dv.slice(0, 5));
    mk('dow', { grid: { left: 8, right: 12, top: 24, bottom: 8, containLabel: true }, tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: p => `${p[0].name}: <b>${f(p[0].value)}</b> µg/m³ (${fp(100 * (p[0].value / wkm - 1))} vs rata-rata Sen–Jum)` },
      xAxis: ax({ type: 'category', data: HARI }), yAxis: ax({ type: 'value', min: 0, max: v => Math.ceil(v.max * 1.18 / 10) * 10, axisLabel: { formatter: '{value}', color: cv('--muted'), fontSize: 11 } }),
      series: [{ type: 'bar', barWidth: '56%', data: dv.map((v, i) => ({ value: v, itemStyle: { color: i >= 5 ? cv('--k-gambut') : cv('--k-bersih'), borderRadius: [4, 4, 0, 0] } })),
        label: { show: true, position: 'top', formatter: p => f(p.value), fontSize: 11, color: cv('--ink-2') } }] });
    // kronis vs musiman
    const kr = d.kr.slice().reverse(), krEl = document.getElementById('kron');
    if (krEl) krEl.style.height = Math.max(220, kr.length * 22 + 50) + 'px';
    mk('kron', { grid: { left: 8, right: 70, top: 8, bottom: 22, containLabel: true },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: ps => { const x = kr[ps[0].dataIndex]; return `<b>${x.code}</b> ${esc(BY[x.code].kota)} · ${BY[x.code].kel}<br>${fi(x.ex)} hari di atas 55 µg/m³<br>Juli–Oktober: <b>${fi(x.dry)}</b> (${f(x.sh, 0)}%) · bulan lain: ${fi(x.oth)}`; } },
      xAxis: ax({ type: 'value', name: 'hari', nameGap: 4 }), yAxis: ax({ type: 'category', data: kr.map(x => x.code), axisLabel: { color: cv('--ink-2'), fontSize: 11, interval: 0 } }),
      series: [['dry', '--k-gambut', 'Juli–Oktober'], ['oth', '--k-bersih', 'Bulan lain']].map(([k, v, l], i) => ({ name: l, type: 'bar', stack: 'k', barWidth: '64%', data: kr.map(x => x[k]),
        itemStyle: { color: cv(v), borderColor: cv('--surface'), borderWidth: 1 },
        label: i === 1 ? { show: true, position: 'right', formatter: p => kr[p.dataIndex].sh < 90 ? `${f(kr[p.dataIndex].sh, 0)}% di kemarau` : '', fontSize: 10.5, color: cv('--ink-2') } : undefined })) },
      p => go('stasiun', { st: kr[p.dataIndex].code }));
    // kalender
    const cs = C.querySelector('#calSt'); if (cs) cs.onchange = e => setS({ st: e.target.value });
    bindSeg(C, 'yr', v => setS({ yr: +v }));
    const a = D.pm25[S.st], y0 = dayIdx(`${S.yr}-01-01`), y1 = S.yr === 2026 ? ND - 1 : dayIdx(`${S.yr}-12-31`);
    const cal = []; for (let i = y0; i <= y1; i++) cal.push([dayDate(i).toISOString().slice(0, 10), a[i]]);
    const el = document.getElementById('cal'), cw = el ? Math.max(8, Math.min(18, (el.clientWidth - 60) / 54)) : 14;
    if (el) el.style.height = (cw * 7 + 54) + 'px';
    mk('cal', { tooltip: { formatter: p => `${fds(p.data[0])}<br>PM2.5 <b>${p.data[1] == null ? 'tidak ada data sah' : f(p.data[1]) + ' µg/m³'}</b>${p.data[1] != null ? ' · ' + ispuOf(p.data[1]).l : ''}` },
      visualMap: { show: false, type: 'piecewise', pieces: ISPU.map((c, i) => ({ gt: i ? ISPU[i - 1].max : -1, lte: c.max === Infinity ? 1e9 : c.max, color: cv(c.v) })), outOfRange: { color: cv('--surface-3') } },
      calendar: { range: String(S.yr), top: 26, left: 34, right: 8, cellSize: [cw, cw], splitLine: { show: false }, itemStyle: { borderColor: cv('--surface'), borderWidth: 2, color: cv('--surface-3') },
        dayLabel: { firstDay: 1, nameMap: ['M', 'S', 'S', 'R', 'K', 'J', 'S'], color: cv('--muted'), fontSize: 10 }, monthLabel: { nameMap: BULAN, color: cv('--muted'), fontSize: 11 }, yearLabel: { show: false } },
      series: [{ type: 'heatmap', coordinateSystem: 'calendar', data: cal.map(x => [x[0], x[1] == null ? null : x[1]]) }] },
      p => { const i = dayIdx(p.data[0]), s = BY[S.st], h = D.health[s.rs];
        const med = k => median(h[k].slice(Math.max(0, i - 182), Math.min(ND, i + 182)));
        showPop(document.getElementById('cal'), `<h4>${fd(i)} · ${esc(stName(S.st))}</h4><dl><dt>PM2.5</dt><dd><b>${p.data[1] == null ? 'tidak ada data sah' : f(p.data[1]) + ' µg/m³'}</b>${p.data[1] != null ? ' (' + ispuOf(p.data[1]).l + ')' : ''}</dd>
          ${['u5', 'o60', 'death'].map(k => `<dt>${OUTC[k].l}</dt><dd><b>${fi(h[k][i])}</b> kasus · median ±6 bln ${fi(med(k))}</dd>`).join('')}</dl><p style="margin:8px 0 0;color:var(--muted)">${esc(s.rs_nama)} (${s.rs}). <a href="${hashOf('stasiun', { st: S.st })}">Buka profil stasiun →</a></p>`); });
    // episode: hari per stasiun per tahun
    const eps = d.eps; if (!eps.length) { document.getElementById('eps').innerHTML = '<div class="empty">Tidak ada episode kabut asap pada filter ini.</div>'; return; }
    const YRS = [2024, 2025, 2026], est = [...new Set(eps.map(e => e.code))].map(c => { const o = { code: c }; YRS.forEach(y => o[y] = sum(eps.filter(e => e.code === c && e.start.startsWith(String(y))).map(e => e.days))); o.tot = sum(YRS.map(y => o[y])); return o; }).sort((a, b) => a.tot - b.tot);
    const epEl = document.getElementById('eps'); if (epEl) epEl.style.height = Math.max(220, est.length * 44 + 40) + 'px';
    mk('eps', { grid: { left: 8, right: 56, top: 6, bottom: 22, containLabel: true },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: ps => { const o = est[ps[0].dataIndex]; return `<b>${o.code}</b> ${esc(BY[o.code].kota)} · ${BY[o.code].kel}<br>` + YRS.map(y => `${y}: <b>${o[y]}</b> hari`).join('<br>') + `<br>Total ${o.tot} hari`; } },
      xAxis: ax({ type: 'value', min: 0, name: 'hari', nameLocation: 'end', nameGap: 4 }),
      yAxis: ax({ type: 'category', data: est.map(o => o.code), axisLabel: { interval: 0, formatter: (v, i) => `{n|${v}}\n{c|${BY[v].kel}}`, rich: { n: { color: cv('--ink'), fontSize: 12, fontWeight: 700, lineHeight: 15 }, c: { color: cv('--muted'), fontSize: 10.5, lineHeight: 13 } } } }),
      series: YRS.map((y, i) => ({ name: String(y), type: 'bar', stack: 'e', barWidth: '58%', data: est.map(o => o[y] || null), itemStyle: { color: hexA(cv('--ispu-4'), [.35, .65, 1][i]), borderColor: cv('--surface'), borderWidth: 1 },
        label: undefined })).concat([{ type: 'bar', stack: 'e', silent: true, data: est.map(() => 0.001), itemStyle: { color: 'transparent' }, tooltip: { show: false }, label: { show: true, position: 'right', formatter: p => est[p.dataIndex].tot + ' hari', color: cv('--ink-2'), fontSize: 11, fontWeight: 650 } }]) },
      p => go('stasiun', { st: est[p.dataIndex].code }));
  },
};

/* ================= T3 FAKTOR ================= */
const ROSE_SEC = ['Utara', 'Timur laut', 'Timur', 'Tenggara', 'Selatan', 'Barat daya', 'Barat', 'Barat laut'];
// Rasio arah terkotor/terbersih, hanya arah dengan >= 1% jam data; mentah vs terkoreksi bulan & jam.
function roseStats(fw) {
  if (!fw || !fw.wind_adj) return null;
  const tot = fw.wind_n.reduce((a, b) => a + (b || 0), 0); if (!tot) return null;
  const share = fw.wind_n.map(n => (n || 0) / tot), ok = share.map((s, i) => s >= .01 && fw.wind_mean[i] != null && fw.wind_adj[i] != null);
  const idx = ok.map((o, i) => o ? i : -1).filter(i => i >= 0); if (idx.length < 2) return null;
  const ratio = a => { const v = idx.map(i => a[i]); return Math.max(...v) / Math.min(...v); };
  const adjMaxI = idx.reduce((b, i) => fw.wind_adj[i] > fw.wind_adj[b] ? i : b, idx[0]);
  return { share, ok, raw: ratio(fw.wind_mean), adj: ratio(fw.wind_adj), adjMax: ROSE_SEC[adjMaxI].toLowerCase() };
}
function t3Shares(codes) {
  const R = stRows(codes).filter(r => r.n), F = D.factors, m = R.map(r => r.mean);
    const between = R.length >= 4 ? [
      ['Tipe lokasi', eta2(m, R.map(r => r.s.kel))], ['Jarak ke jalan raya', spearman(m, R.map(r => r.s.road)) ** 2], ['Intensitas lalu lintas', spearman(m, R.map(r => r.s.traffic)) ** 2]] : [];
    const within = [['Musim (bulan)', median(codes.map(c => F[c].month))], ['Jam dalam sehari', median(codes.map(c => F[c].hour))], ['Hari dalam seminggu', median(codes.map(c => F[c].dow))],
      ['Suhu', median(codes.map(c => F[c].temp ** 2))], ['Kelembapan', median(codes.map(c => F[c].rh ** 2))], ['Kecepatan angin', median(codes.map(c => F[c].ws ** 2))]];
  return { R, between, within };
}
PAGES.t3 = {
  title: 'Faktor penentu', nav: 'Faktor', group: 'Alur analisis', steps: true,
  html() {
    const codes = active().map(s => s.code); if (!codes.length) return ph({ k: 'Langkah 3', h: 'Apa yang menentukan?', lede: '' }) + emptyMsg;
    const T3 = t3Shares(codes), R = T3.R, between = T3.between, within = T3.within, F = D.factors;
    const m = R.map(r => r.mean);
    const rhRand = codes.filter(c => F[c].rh_std > 10.7 && F[c].rh_std < 11.1 && F[c].rh_nuniq < 120);
    const rRoad = R.length >= 4 ? spearman(m, R.map(r => r.s.road)) : null, rTr = R.length >= 4 ? spearman(m, R.map(r => r.s.traffic)) : null;
    const BINS = { road: [[0, 20, '≤ 20 m'], [20, 40, '21–40 m'], [40, 60, '41–60 m'], [60, 1e9, '> 60 m']], traffic: [[0, 500, '≤ 500'], [500, 1500, '501–1.500'], [1500, 1e9, '> 1.500']] };
    const binOf = k => BINS[k].map(([lo, hi, l]) => { const g = R.filter(r => r.s[k] > lo && r.s[k] <= hi); return { l, g, n: g.length, avg: g.length ? mean(g.map(r => r.mean)) : null }; }).filter(b => b.n);
    const bR = binOf('road'), bT = binOf('traffic');
    const wxSig = codes.filter(c => Math.abs(F[c].temp) >= .1 || Math.abs(F[c].rh) >= .1 || Math.abs(F[c].ws) >= .1);
    this._d = { codes, R, between, within, rhRand, bins: { road: bR, traffic: bT } };
    const bTop = between.slice().sort((a, b) => b[1] - a[1])[0], wTop = within.slice().sort((a, b) => b[1] - a[1])[0];
    const wxMax = Math.max(...within.slice(3).map(x => x[1] || 0)), nz = codes.length - wxSig.length;
    // tipe lokasi: titik per stasiun, rata-rata per tipe, η² tanpa latar bersih
    const kg = KEL.map(k => { const g = R.filter(r => r.s.kel === k); return g.length ? { k, g, n: g.length, avg: mean(g.map(r => r.mean)), lo: Math.min(...g.map(r => r.mean)), hi: Math.max(...g.map(r => r.mean)) } : null; }).filter(Boolean).sort((a, b) => b.avg - a.avg);
    const kLow = kg[kg.length - 1], kRest = kg.slice(0, -1), Rx = R.filter(r => kLow && r.s.kel !== kLow.k);
    const etaRest = Rx.length >= 4 && kRest.length > 1 ? eta2(Rx.map(r => r.mean), Rx.map(r => r.s.kel)) : null;
    const kOverlap = kRest.length > 1 && Math.max(...kRest.map(x => x.lo)) < Math.min(...kRest.map(x => x.hi)), kSmall = kg.filter(x => x.n <= 2);
    this._kg = kg;
    const rose = codes.map(c => ({ code: c, q: roseStats(F[c]) })).filter(x => x.q).map(x => ({ code: x.code, adj: x.q.adj, raw: x.q.raw, sec: x.q.adjMax })).sort((a, b) => b.adj - a.adj), roseRaw = rose.slice().sort((a, b) => b.raw - a.raw);
    this._d.rose = rose;
    const strength = r => Math.abs(r) >= .5 ? 'cukup kuat' : Math.abs(r) >= .3 ? 'sedang' : 'lemah';
    // uji tambahan (analisis/, 9 Nov): ρ suhu setelah efek jam-dalam-hari dibuang dari data per jam; pengecualian harian ternyata artefak jam yang hilang
    const WX_JAM = { 'MDN-01': 0.06, 'PLB-01': -0.01 }, wxArt = wxSig.length && wxSig.every(c => c in WX_JAM);
    const wxEx = wxSig.map(c => { const k = ['temp', 'rh', 'ws'].reduce((b, x) => Math.abs(F[c][x] || 0) > Math.abs(F[c][b] || 0) ? x : b, 'temp'); return `${c} (ρ ${{ temp: 'suhu', rh: 'kelembapan', ws: 'angin' }[k]} ${f(F[c][k], 2)})`; });
    return ph({ k: 'Langkah 3 · Faktor', h: 'Apa yang menentukan polusi?',
      lede: `Penentunya <b>lokasi</b> dan <b>musim</b>, bukan cuaca harian: musim menjelaskan <b>${f(100 * within[0][1], 0)}%</b> naik-turun harian${between.length ? ` dan ${term('tipe lokasi')} <b>${f(100 * between[0][1], 0)}%</b> perbedaan antarstasiun` : ''}, sedangkan suhu, kelembapan, dan angin masing-masing di bawah 1%.`, goal: 3,
      scope: `Dasar: ${R.length} stasiun · ukuran kekuatan hubungan, bukan bukti sebab-akibat.` }) +
      `<div class="grid">
      <h2 class="t-sec">Faktor terkuat?</h2>
      ${card({ id: 'power', span: 's12', h: 'h320', title: 'Faktor mana yang paling menjelaskan PM2.5?', sub: `Batang = persen ${term('variasi')} PM2.5 yang dijelaskan tiap faktor, dalam dua panel terpisah.`,
        lead: `Yang paling menjelaskan naik turun harian adalah <b>${wTop[0].split(" (")[0].toLowerCase()}</b> (${f(100 * wTop[1], 0)}%)${bTop ? `, sedangkan beda antarstasiun paling dijelaskan oleh <b>${bTop[0].toLowerCase()}</b> (${f(100 * bTop[1], 0)}%)` : ''}. Suhu, kelembapan, dan angin masing-masing paling banyak ${f(100 * wxMax, 1)}%.`, note: nt(`Terkuat: <b>${wTop[0].split(" (")[0].toLowerCase()}</b> (${f(100 * wTop[1], 0)}%) untuk naik-turun harian${bTop ? `, <b>${bTop[0].toLowerCase()}</b> (${f(100 * bTop[1], 0)}%) untuk beda antarstasiun` : ''}. Suhu, kelembapan, dan angin masing-masing paling banyak ${f(100 * wxMax, 1)}%.`,
          'Kedua panel memakai ukuran berbeda, jadi persennya tidak dijumlahkan. Tipe lokasi, jarak ke jalan, dan lalu lintas saling berkaitan (stasiun tepi jalan memang dekat jalan dan ramai), jadi porsinya tumpang tindih.'),
        table: () => ({ cols: [{ k: 'f', l: 'Faktor' }, { k: 't', l: 'Level' }, { k: 'v', l: '% variasi', num: 1, fmt: v => f(100 * v) }], rows: between.map(([a, v]) => ({ f: a, t: 'antarstasiun', v })).concat(within.map(([a, v]) => ({ f: a, t: 'dalam stasiun', v }))) }),
        info: { rumus: 'Tipe lokasi, musim, jam, hari: η² (ANOVA satu arah). Jarak, lalu lintas: ρ² Spearman antar rata-rata stasiun. Suhu, kelembapan, angin: ρ² Spearman antara anomali harian (PM2.5 dikurangi rata-rata bulan stasiun itu) dan cuaca, median antarstasiun.', data: 'pm25 harian/jam + sites.csv', cat: 'Kedua level tidak setara secara statistik; dibandingkan untuk urutan kekuatan, bukan dijumlahkan.' } })}
      <h2 class="t-sec">Lokasi</h2>
      ${kg.length > 1 ? card({ id: 'kel', span: 's6', h: 'h380', title: 'Tipe lokasi: mana yang paling kotor?',
        sub: 'Satu baris per tipe lokasi, diurutkan dari rata-rata tertinggi. Titik = stasiun, cincin = rata-rata tipe (warna = kategori ISPU).',
        legend: legendKel(kg.map(x => x.k)) + `<span><i style="background:transparent;border:3px solid var(--ispu-2);border-radius:50%"></i>Cincin = rata-rata tipe</span>`,
        lead: `<b>${kLow.k}</b> jauh paling bersih (${f(kLow.avg)} µg/m³), sedangkan tipe lain berada di ${f(Math.min(...kRest.map(x => x.avg)))}–${f(Math.max(...kRest.map(x => x.avg)))} µg/m³ dan rentangnya ${kOverlap ? 'saling tumpang tindih' : 'berbeda'}.${etaRest != null ? ` Tanpa ${kLow.k.toLowerCase()}, tipe lokasi hanya menjelaskan ${f(100 * etaRest, 0)}% perbedaan antarstasiun.` : ''}`, note: nt(`<b>${kLow.k}</b> jauh paling bersih (${f(kLow.avg)} µg/m³); tipe lain ${f(Math.min(...kRest.map(x => x.avg)))}–${f(Math.max(...kRest.map(x => x.avg)))} dan rentangnya ${kOverlap ? 'saling tumpang tindih' : 'berbeda'}.${etaRest != null ? ` Tanpa ${kLow.k.toLowerCase()}, tipe lokasi hanya menjelaskan <b>${f(100 * etaRest, 0)}%</b> perbedaan antarstasiun (dari ${f(100 * between[0][1], 0)}%).` : ''}`,
          kSmall.length ? `${kSmall.map(x => `${x.k} hanya ${x.n} stasiun (${x.g.map(r => `${r.code} ${f(r.mean)}`).join(', ')})`).join('; ')}, jadi rata-ratanya tidak stabil.` : ''),
        table: () => ({ cols: [{ k: 'k', l: 'Tipe' }, { k: 'n', l: 'Stasiun', num: 1 }, { k: 'avg', l: 'Rata-rata PM2.5', num: 1, fmt: v => f(v) }, { k: 'lo', l: 'Terendah', num: 1, fmt: v => f(v) }, { k: 'hi', l: 'Tertinggi', num: 1, fmt: v => f(v) }], rows: kg.map(({ g, ...x }) => x) }),
        info: { rumus: 'Rata-rata tipe = rata-rata dari rata-rata stasiun bertipe sama (setiap stasiun berbobot sama). η² tanpa latar bersih = ANOVA satu arah pada stasiun tersisa.', data: 'pm25 harian + sites.csv' } }) : ''}
      ${card({ id: 'sc', span: 's6', h: 'h380', title: 'Apakah jalan raya memengaruhi PM2.5?', sub: 'Batang = rata-rata PM2.5 stasiun (µg/m³) menurut jarak ke jalan raya atau jumlah kendaraan per jam. Di bawah tiap kelompok tertulis jumlah stasiun.', ctrl: seg('scx', [['road', 'Jarak ke jalan'], ['traffic', 'Lalu lintas']], this._scx || 'road'), legend: legendIspu(),
        lead: rRoad != null && bR.length > 1 && bT.length > 1 ? `Stasiun yang jauh dari jalan (${bR[bR.length - 1].l}) rata-rata hanya <b>${f(bR[bR.length - 1].avg)}</b> µg/m³, jauh lebih bersih daripada yang lebih dekat. Lalu lintas yang ramai juga berarti udara lebih kotor: ${bT.map(b => `${b.l} kendaraan per jam rata-rata ${f(b.avg)}`).join(', ')}.` : null, note: rRoad != null && bR.length > 1 && bT.length > 1 ? nt(`Stasiun yang jauh dari jalan (${bR[bR.length - 1].l}) rata-rata <b>${f(bR[bR.length - 1].avg)}</b> µg/m³, jauh lebih bersih dari yang lebih dekat (${f(Math.min(...bR.slice(0, -1).map(b => b.avg)))}–${f(Math.max(...bR.slice(0, -1).map(b => b.avg)))}). Makin ramai lalu lintas, makin kotor: ${bT.map(b => `${b.l} kendaraan/jam <b>${f(b.avg)}</b>`).join(', ')}.`,
          `Hanya ${R.length} titik; jarak dan lalu lintas adalah atribut tetap stasiun, bukan ukuran harian.`) : '',
        table: () => ({ cols: [{ k: 'code', l: 'Kode' }, { k: 'kel', l: 'Tipe' }, { k: 'road', l: 'Jarak jalan (m)', num: 1, fmt: fi }, { k: 'traffic', l: 'Kendaraan/jam', num: 1, fmt: fi }, { k: 'mean', l: 'PM2.5', num: 1, fmt: v => f(v) }], rows: R.map(r => ({ _st: r.code, code: r.code, kel: r.s.kel, road: r.s.road, traffic: r.s.traffic, mean: r.mean })) }),
        info: { rumus: 'Spearman ρ antara rata-rata PM2.5 stasiun dan atribut lokasi di sites.csv.', data: 'sites.csv (distance_to_road_m, traffic_intensity_per_h)' } })}
      <h2 class="t-sec">Cuaca</h2>
      ${card({ id: 'wx', span: 's7', title: 'Apakah cuaca harian memengaruhi PM2.5?', sub: 'Satu titik per stasiun; makin jauh dari tengah, makin kuat cuaca bergerak bersama polusi (' + term('pengaruh musim dibuang', 'pengaruh musim sudah dibuang') + '). Pita abu = tidak ada hubungan berarti.',
        lead: `Di <b>${nz} dari ${codes.length}</b> stasiun, cuaca hampir tidak berhubungan dengan polusi harian.${wxArt ? ` Pengecualian ${wxSig.join(' dan ')} ternyata efek jam data yang hilang, bukan cuaca.` : wxEx.length ? ` Pengecualian ada di ${wxEx.join(', ')}.` : ''}`, note: nt(`Di <b>${nz} dari ${codes.length}</b> stasiun, cuaca hampir tidak berhubungan dengan polusi harian.${wxArt ? ` Pengecualian ${wxSig.join(' dan ')} ternyata efek jam data yang hilang: setelah dikoreksi, ρ suhu ${wxSig.map(c => `${f(WX_JAM[c], 2)} (${c})`).join(' dan ')}.` : wxEx.length ? ` Pengecualian: ${wxEx.join(', ')}.` : ''}`,
          rhRand.length ? `Kelembapan di ${rhRand.length} stasiun tampak seperti angka acak, jadi tidak bisa dinilai (<a href="#/metodologi">Metodologi</a>).` : ''),
        table: () => ({ cols: [{ k: 'code', l: 'Kode' }, { k: 'temp', l: 'ρ suhu', num: 1, fmt: v => f(v, 2) }, { k: 'rh', l: 'ρ kelembapan', num: 1, fmt: v => f(v, 2) }, { k: 'ws', l: 'ρ angin', num: 1, fmt: v => f(v, 2) }], rows: codes.map(c => ({ _st: c, code: c, temp: F[c].temp, rh: F[c].rh, ws: F[c].ws })) }),
        info: { rumus: 'Anomali = PM2.5 harian − rata-rata bulan-tahun stasiun itu (menghilangkan efek musim), lalu korelasi Spearman (ρ, dari −1 sampai +1) dengan suhu, kelembapan, kecepatan angin harian.', data: 'Data per jam → harian', filter: false, cat: 'Dihitung untuk seluruh periode; titik ikut filter pulau/tipe. Uji tambahan untuk MDN-01 dan PLB-01: anomali dihitung per jam (dikurangi rata-rata bulan dan jam yang sama) lalu dirata-ratakan per hari; ρ suhu turun dari 0,48 ke 0,06 (MDN-01) dan dari −0,15 ke −0,01 (PLB-01).' } })}
      ${rose.length ? card({ id: 'wdir', span: 's5', h: 'h380', title: 'Apakah arah angin memengaruhi PM2.5?', sub: 'Mawar angin: jarak dari pusat = rata-rata PM2.5 menurut arah datangnya angin, gabungan semua stasiun (100 = rata-rata biasa, pengaruh musim sudah dibuang). Bentuk bulat berarti arah angin tidak berpengaruh.',
        lead: `Setelah pengaruh musim dibuang, arah angin hanya mengubah PM2.5 paling banyak <b>${f(100 * (rose[0].adj - 1), 1)}%</b>. Perbedaan yang tampak sebelum dikoreksi muncul karena arah angin ikut berganti mengikuti musim.`, note: nt(`Setelah pengaruh musim dibuang, selisih terbesar hanya <b>${f(100 * (rose[0].adj - 1), 1)}%</b> (${rose[0].code}). Sebelum dikoreksi, ${roseRaw[0].code} tampak ${f(100 * (roseRaw[0].raw - 1), 0)}% lebih kotor dari satu arah, tetapi itu karena arah angin ikut berganti dengan musim.`,
          'Arah dibagi delapan mata angin; arah yang mencakup kurang dari 1% jam tidak dihitung.'),
        table: () => ({ cols: [{ k: 'code', l: 'Kode' }, { k: 'raw', l: 'Selisih sebelum koreksi (%)', num: 1, fmt: v => f(v, 1) }, { k: 'adj', l: 'Selisih sesudah koreksi (%)', num: 1, fmt: v => f(v, 1) }, { k: 'sec', l: 'Arah terkotor' }], rows: rose.map(x => ({ _st: x.code, code: x.code, raw: 100 * (x.raw - 1), adj: 100 * (x.adj - 1), sec: x.sec })) }),
        info: { rumus: 'Per stasiun: rata-rata PM2.5 per arah angin (8 sektor), lalu rasio sektor tertinggi ÷ terendah − 1. Koreksi musim: PM2.5 dikurangi rata-rata bulan stasiun itu sebelum dirata-ratakan per arah.', data: 'Data per jam (arah dan kecepatan angin)', filter: false } }) : ''}
      ${jawab(3, `Yang paling menentukan adalah <b>lokasi dan musim</b>, bukan cuaca harian. ${wTop[0].split(" (")[0]} paling menjelaskan naik-turun polusi di tiap stasiun${bTop ? `, sedangkan ${bTop[0].toLowerCase()} paling menjelaskan beda antarstasiun` : ''}. Suhu, kelembapan, dan angin masing-masing di bawah ${f(Math.max(1, Math.ceil(100 * wxMax)), 0)}%.`,
        'Upaya yang menyasar sumber di lokasi, seperti lalu lintas di kota dan kebakaran gambut saat kemarau, lebih menjanjikan daripada menunggu cuaca membaik. Prakiraan cuaca saja belum cukup untuk menebak hari berudara buruk.',
        'ini hubungan statistik. Data tidak memuat sumber emisi seperti titik panas, aktivitas industri, atau jumlah kendaraan, jadi penyebab di balik lokasi dan musim masih dugaan.')}
      </div>`;
  },
  mount(C) {
    const d = this._d; if (!d) return;
    { const el = document.getElementById('power'), W = el ? el.clientWidth : 1000, wide = W >= 720;
      const P2 = [['Kenapa stasiun berbeda?', d.between.slice().sort((a, b) => a[1] - b[1]), '--k-gambut'], ['Kenapa hari berbeda?', d.within.slice().sort((a, b) => a[1] - b[1]), '--k-bersih']].filter(x => x[1].length);
      if (el) el.style.height = wide ? '' : (P2.length * 230) + 'px';
      const gr = P2.map((_, i) => wide ? { left: i ? '53%' : 8, width: '40%', top: 30, bottom: 22, containLabel: true } : { left: 8, right: 50, top: 30 + i * 230, height: 170, containLabel: true });
      mk('power', { title: P2.map((x, i) => ({ text: x[0], left: wide ? (i ? '53%' : 8) : 8, top: wide ? 0 : i * 230, textStyle: { fontSize: 13, fontWeight: 700, color: cv('--ink'), fontFamily: FONT } })),
        grid: gr, tooltip: { formatter: p => { const x = P2[p.seriesIndex][1][p.dataIndex]; return `${x[0]}: <b>${f(100 * x[1])}%</b> variasi`; } },
        xAxis: P2.map((_, i) => ax({ gridIndex: i, type: 'value', max: 100, axisLabel: { formatter: '{value}%', color: cv('--muted'), fontSize: 11 } })),
        yAxis: P2.map((x, i) => ax({ gridIndex: i, type: 'category', data: x[1].map(y => y[0]), axisLabel: { color: cv('--ink-2'), fontSize: 12 } })),
        series: P2.map((x, i) => { const top = x[1].length - 1; return { type: 'bar', xAxisIndex: i, yAxisIndex: i, barWidth: '58%', data: x[1].map((y, k) => ({ value: 100 * y[1], itemStyle: { color: k === top ? cv(x[2]) : hexA(cv(x[2]), .35), borderRadius: [0, 4, 4, 0] } })),
          label: { show: true, position: 'right', formatter: p => f(p.value, p.value < 1 ? 1 : 0) + '%', fontSize: 11, color: cv('--ink-2') } }; }) }); }
    const drawSc = k => {
      this._scx = k; const bs = d.bins[k];
      mk('sc', { grid: { left: 8, right: 16, top: 22, bottom: 8, containLabel: true },
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: ps => { const b = bs[ps[0].dataIndex]; return `<b>${b.l}${k === 'traffic' ? ' kendaraan/jam' : ''}</b> · ${b.n} stasiun<br>Rata-rata <b>${f(b.avg)}</b> µg/m³<br><span style="color:var(--muted)">${b.g.map(r => `${r.code} ${f(r.mean, 0)}`).join(', ')}</span>`; } },
        xAxis: ax({ type: 'category', data: bs.map(b => b.l), axisLabel: { interval: 0, formatter: (v, i) => `{n|${v}}\n{c|${bs[i].n} stasiun}`, rich: { n: { color: cv('--ink'), fontSize: 12, fontWeight: 700, lineHeight: 16 }, c: { color: cv('--muted'), fontSize: 10.5, lineHeight: 14 } } }, name: k === 'road' ? 'jarak ke jalan raya' : 'kendaraan per jam', nameLocation: 'middle', nameGap: 40 }),
        yAxis: ax({ type: 'value', min: 0, name: 'µg/m³', nameGap: 8 }),
        series: [{ type: 'bar', barWidth: '52%', data: bs.map(b => ({ value: b.avg, itemStyle: { color: ispuCol(b.avg), borderRadius: [5, 5, 0, 0] } })), label: { show: true, position: 'top', formatter: p => f(p.value), color: cv('--ink'), fontWeight: 700, fontSize: 12 } }] });
    };
    drawSc(this._scx || 'road'); bindSeg(C, 'scx', drawSc);
    const kg = this._kg || [];
    if (kg.length > 1) {
      const kp = []; kg.forEach((g, gi) => g.g.forEach((r, i) => kp.push({ value: [r.mean, gi + (g.n > 1 ? [-.26, -.13, 0, .13, .26][i % 5] : 0)], code: r.code, itemStyle: { color: kelCol(r.s.kel) } })));
      mk('kel', { grid: { left: 8, right: 52, top: 8, bottom: 22, containLabel: true },
        tooltip: { formatter: p => p.data.code ? `<b>${p.data.code}</b> ${esc(BY[p.data.code].kota)}<br>${BY[p.data.code].kel} · ${esc(BY[p.data.code].prov)}<br>Rata-rata PM2.5: <b>${f(p.data.value[0])}</b> µg/m³` : `<b>${p.data.kel}</b> (${p.data.n} stasiun)<br>Rata-rata PM2.5: <b>${f(p.data.value[0])}</b> µg/m³` },
        xAxis: ax({ type: 'value', min: 0, name: 'µg/m³', nameLocation: 'end', nameGap: 4, axisLine: { onZero: false, lineStyle: { color: cv('--line-2') } } }),
        yAxis: [ax({ type: 'category', data: kg.map(g => g.k), inverse: true, boundaryGap: true, splitLine: { show: false }, axisLine: { show: false }, axisTick: { show: false },
          axisLabel: { interval: 0, formatter: (v, i) => `{n|${v}}
{c|${kg[i].n} stasiun}`, rich: { n: { color: cv('--ink'), fontSize: 12, fontWeight: 700, lineHeight: 16 }, c: { color: cv('--muted'), fontSize: 10.5, lineHeight: 14 } } } }),
          ax({ type: 'value', inverse: true, min: -.5, max: kg.length - .5, show: false, splitLine: { show: false } })],
        series: [{ type: 'scatter', yAxisIndex: 1, silent: true, z: 1, symbolSize: 0, tooltip: { show: false }, data: kg.map((g, i) => [0, i]),
            markLine: { silent: true, symbol: 'none', animation: false, label: { show: false }, lineStyle: { color: cv('--line'), type: 'solid', width: 1 }, data: kg.slice(1).map((_, i) => ({ yAxis: i + .5 })) } },
          { type: 'scatter', yAxisIndex: 1, data: kp, symbolSize: 11, z: 2, itemStyle: { borderColor: cv('--surface'), borderWidth: 1.5 }, emphasis: { scale: 1.3 } },
          { type: 'scatter', yAxisIndex: 1, data: kg.map((g, i) => ({ value: [g.avg, i], kel: g.k, n: g.n, itemStyle: { color: 'rgba(0,0,0,0)', borderWidth: 4, borderColor: ispuCol(g.avg) } })), symbolSize: 24, z: 4, emphasis: { scale: 1.1 },
            label: { show: true, position: 'right', distance: 10, formatter: q => f(q.data.value[0]), fontSize: 12, fontWeight: 700, color: cv('--ink'), fontFamily: FONT, backgroundColor: cv('--surface'), padding: [1, 4], borderRadius: 3 } }] }, toStation);
    }
    const F = D.factors, vars = [['temp', 'Suhu'], ['rh', 'Kelembapan'], ['ws', 'Kecepatan angin']];
    const pts = []; vars.forEach(([k], j) => d.codes.forEach((c, i) => pts.push({ value: [F[c][k], j + ((i * 29) % 7 - 3) * .06], code: c, k, itemStyle: { color: Math.abs(F[c][k]) >= .1 ? cv('--k-gambut') : cv('--muted') } })));
    mk('wx', { grid: { left: 8, right: 16, top: 10, bottom: 24, containLabel: true }, tooltip: { formatter: p => `<b>${p.data.code}</b> ${esc(BY[p.data.code].kota)}<br>ρ ${vars.find(v => v[0] === p.data.k)[1].toLowerCase()}: <b>${f(p.data.value[0], 2)}</b>` },
      xAxis: ax({ type: 'value', min: -.6, max: .6, name: 'kekuatan hubungan (ρ)', nameLocation: 'middle', nameGap: 22, axisLine: { onZero: false, show: false } }),
      yAxis: ax({ type: 'value', min: -.5, max: 2.5, interval: .5, splitLine: { show: false }, axisLabel: { formatter: v => Number.isInteger(v) ? (vars[v] || [])[1] || '' : '', color: cv('--ink-2'), fontSize: 12, hideOverlap: false } }),
      series: [{ type: 'scatter', data: pts, symbolSize: 10, itemStyle: { borderColor: cv('--surface'), borderWidth: 1 },
        label: { show: true, position: 'top', formatter: p => Math.abs(p.data.value[0]) >= .1 ? p.data.code : '', fontSize: 10, color: cv('--ink-2') },
        markArea: { silent: true, itemStyle: { color: cv('--surface-3'), opacity: .7 }, data: [[{ xAxis: -.1 }, { xAxis: .1 }]] } }] }, toStation);
    if (document.getElementById('wdir')) {
      const idx = ROSE_SEC.map(() => []);
      d.codes.forEach(c => { const fw = F[c], q = roseStats(fw); if (!q) return; const v = q.ok.map((o, i) => o ? fw.wind_adj[i] : null), mu = mean(v.filter(x => x != null)); v.forEach((x, i) => { if (x != null) idx[i].push(100 * x / mu); }); });
      const iv = idx.map(a => a.length ? mean(a) : null), nS = idx.map(a => a.length);
      mk('wdir', { tooltip: { formatter: p => `Angin dari <b>${ROSE_SEC[p.dataIndex].toLowerCase()}</b><br>PM2.5 = <b>${f(p.value, 1)}</b> (100 = rata-rata biasa)<br>${nS[p.dataIndex]} stasiun` },
        polar: { radius: ['8%', '72%'], center: ['50%', '52%'] },
        angleAxis: { type: 'category', data: ROSE_SEC.map(x => x.replace('Timur laut', 'TL').replace('Tenggara', 'Tg').replace('Barat daya', 'BD').replace('Barat laut', 'BL')), startAngle: 112.5, axisLine: { lineStyle: { color: cv('--line-2') } }, axisTick: { show: false }, axisLabel: { color: cv('--ink-2'), fontSize: 11.5, fontWeight: 600 }, splitLine: { show: true, lineStyle: { color: cv('--line') } } },
        radiusAxis: { min: 0, max: 110, interval: 50, axisLabel: { show: false }, axisLine: { show: false }, splitLine: { lineStyle: { color: cv('--line'), type: 'dashed' } } },
        series: [{ type: 'bar', coordinateSystem: 'polar', data: iv, barWidth: '78%', itemStyle: { color: cv('--k-bersih'), opacity: .85, borderColor: cv('--surface'), borderWidth: 1 } }] });
    }
  },
};

/* ================= T4 KESEHATAN ================= */
PAGES.t4 = {
  title: 'Dampak kesehatan', nav: 'Kesehatan', group: 'Alur analisis', steps: true,
  html() {
    const M = D.model.outcomes, k26 = kaltengDeaths(2026), k24 = kaltengDeaths(2024);
    if (!OUTC[S.out]) S.out = 'u5';
    if (!BY[S.st] || BY[S.st].use === 'rusak') S.st = 'KTG-01';
    const codes = active().map(s => s.code);
    const wnd = y => [dayIdx(`${y}-09-01`), dayIdx(`${y}-10-13`)], avg = arr => mean(arr.filter(v => v != null));
    const chg = codes.filter(c => BY[c].use !== 'rusak').map(c => { const o = {}; for (const y of [2024, 2026]) { const [i0, i1] = wnd(y); o['p' + y] = avg(D.pm25[c].slice(i0, i1 + 1)); o['d' + y] = avg(D.health[BY[c].rs].death.slice(i0, i1 + 1)); } return { code: c, ...o }; })
      .filter(r => r.p2024 != null && r.p2026 != null).sort((a, b) => b.p2026 - a.p2026);
    const nUp = chg.filter(r => r.p2026 > r.p2024 * 1.2).length, nDeath = chg.filter(r => r.p2026 > r.p2024 * 1.2 && r.d2026 > r.d2024 * 1.2).length;
    this._d = { codes, chg };
    const u5 = M.u5.lags[0], o60 = M.o60.lags[0], k25 = kaltengDeaths(2025), NRS = 25, aU = M.u5.mean * u5.pct / 100, aO = M.o60.mean * o60.pct / 100;
    const ks = Object.keys(OUTC).filter(k => M[k]), byPct = ks.slice().sort((a, b) => M[b].lags[0].pct - M[a].lags[0].pct);
    const rk = ['u5', 'o60', 'asma', 'ppok', 'resp'].filter(k => M[k]), rLo = Math.min(...rk.map(k => M[k].lags[0].pct)), rHi = Math.max(...rk.map(k => M[k].lags[0].pct));
    const L = M[S.out].lags, later = L.slice(1), lMax = Math.max(...later.map(l => Math.abs(l.pct))), lZero = later.filter(l => l.lo <= 0 && l.hi >= 0).length;
    const LG = ['u5', 'o60', 'death'].filter(k => M[k]).map(k => ({ k, same: M[k].lags[0].pct, later: 100 * ((1 + M[k].cum.pct / 100) / (1 + M[k].lags[0].pct / 100) - 1) }));
    const lagSig = LG.reduce((t, x) => t + M[x.k].lags.slice(1).filter(l => l.lo > 0 || l.hi < 0).length, 0), lagMax = Math.max(...LG.flatMap(x => M[x.k].lags.slice(1).map(l => Math.abs(l.pct))));
    this._lag = LG;
    const ovl = u5.lo <= o60.hi && o60.lo <= u5.hi;
    // studi kasus: Juli–14 Oktober tahun terpilih vs rata-rata dua tahun lain
    const cw0 = y => dayIdx(`${y}-07-01`), cLen = dayIdx('2026-10-14') - cw0(2026) + 1, cH = D.health[BY[S.st].rs][S.out], cOth = [2024, 2025, 2026].filter(y => y !== S.yr);
    const cPm = Array.from({ length: cLen }, (_, i) => D.pm25[S.st][cw0(S.yr) + i]), cPk = cPm.reduce((b, v, i) => v != null && (b < 0 || v > cPm[b]) ? i : b, -1);
    const cCur = mean(Array.from({ length: cLen }, (_, i) => cH[cw0(S.yr) + i])), cRef = mean(Array.from({ length: cLen }, (_, i) => mean(cOth.map(y => cH[cw0(y) + i]))));
    this._lo = this._lo || 'ispa'; const ld = this._load(this._lo), LO = this._LO.find(x => x[0] === this._lo), ldHiPm = this._lo === 'ispa' ? ld.filter(r => r.pm >= 45 && r.v < 3) : [];
    return ph({ k: 'Langkah 4 · Kesehatan', h: 'Apa dampaknya ke kesehatan?',
      lede: `Tiap +10 µg/m³ PM2.5, sekitar <b>${f(NRS * (aU + aO), 0)} pasien ISPA tambahan per hari</b> (balita dan lansia) di ${NRS} RS rujukan, <b>pada hari yang sama</b>.`, goal: 4,
      scope: `Dasar: ${fi(D.model.n)} ${term('hari-RS')} dari 25 pasangan stasiun–RS · ${term('model')} Poisson efek 0–7 hari · hubungan statistik, bukan sebab-akibat · tidak ikut filter.` }) +
      `      <div class="grid">
      <h2 class="t-sec">Seberapa besar, dan kapan?</h2>
      ${card({ id: 'forest', span: 's6', h: 'h380', lead: `Setiap PM2.5 naik 10 µg/m³, kasus kesehatan naik ${fp(M[byPct[byPct.length - 1]].lags[0].pct)} sampai ${fp(M[byPct[0]].lags[0].pct)}. Kenaikan terbesar ada pada <b>${lcf(OUTC[byPct[0]].l)}</b> dan terkecil pada ${lcf(OUTC[byPct[byPct.length - 1]].l)}. Angka ini sudah memperhitungkan musim.`, note: nt(`Tiap PM2.5 naik 10 µg/m³, ketujuh luaran naik: tertinggi <b>${OUTC[byPct[0]].l}</b> (${fp(M[byPct[0]].lags[0].pct)}), terendah <b>${OUTC[byPct[byPct.length - 1]].l}</b> (${fp(M[byPct[byPct.length - 1]].lags[0].pct)}). Angka sudah memperhitungkan musim; tanpa itu efek balita tampak lebih kecil (${fp(M.u5.naive.pct)}).`,
          'Angka kontrol ketat adalah efek harian minimum; beban total di RS ada di <a href="#/rs">RS kewalahan</a>. Uji kekokohan: menambah kelembapan tidak mengubah efek (balita 4,8% → 4,8%); dispersi 0,55, jadi Poisson memadai. Model per RS dengan efek acak memberi angka lebih besar (balita 7,9%, IK 95% 6,1–9,8%), tetapi antar-RS sangat beragam (I² 99%), sehingga kami melaporkan angka yang lebih hati-hati.'), title: 'Seberapa besar efeknya pada tiap penyakit?', sub: `Satu batang per penyakit: persen kenaikan kasus untuk tiap kenaikan PM2.5 10 µg/m³. Garis tipis = ${term('IK 95%', 'selang kepercayaan 95%')}.`,
        table: () => ({ cols: [{ k: 'o', l: 'Luaran' }, { k: 'naive', l: 'Naif', num: 1, fmt: v => fp(v, 2) }, { k: 'mid', l: 'Kontrol tahun+bulan', num: 1, fmt: v => fp(v, 2) }, { k: 'dlm', l: 'Kontrol ketat lag 0', num: 1, fmt: v => fp(v, 2) }, { k: 'cum', l: 'Kumulatif 0–7', num: 1, fmt: v => fp(v, 2) }],
          rows: Object.entries(M).map(([k, m]) => ({ o: OUTC[k].s, naive: m.naive.pct, mid: m.mid.pct, dlm: m.lags[0].pct, cum: m.cum.pct })) }),
        info: { rumus: 'Naif: Poisson kasus ~ PM2.5 + efek tetap RS. Kontrol tahun & bulan: + tahun, bulan, hari, suhu. Kontrol ketat: lag 0–7 bersamaan + efek tetap RS × bulan-tahun + hari + suhu.', data: `${fi(D.model.n)} hari-RS dari 25 pasangan stasiun–RS (JMB-02 & MER-01 dikeluarkan)`, filter: false, cat: 'Asosiasi pada data sintetis, bukan bukti sebab-akibat.' } })}
      ${card({ id: 'lag', span: 's6', h: 'h380', title: 'Kapan efeknya muncul? Hari itu juga', sub: `Batang biru = kenaikan kasus di hari polusi tinggi, batang abu = total tujuh hari sesudahnya (${term('efek jeda', 'efek jeda')}), per kenaikan PM2.5 10 µg/m³. Tiga luaran utama.`, legend: '<span><i style="background:var(--brand)"></i>Hari yang sama</span><span><i style="background:' + hexA(cv('--muted'), .55) + '"></i>Total 7 hari sesudahnya</span>',
        lead: `Lonjakan kasus terjadi <b>di hari polusi tinggi itu sendiri</b>. Total tujuh hari sesudahnya hampir nol (${LG.map(x => fp(x.later)).join(', ')}), jadi dampaknya tidak menyusul dan peringatan perlu keluar sebelum atau pada hari polusi tinggi.`, note: nt(`Hari yang sama: ${LG.map(x => `${/^ISPA/.test(OUTC[x.k].l) ? OUTC[x.k].l : OUTC[x.k].l.toLowerCase()} <b>${fp(x.same)}</b>`).join(', ')}. Total tujuh hari sesudahnya hampir nol (${LG.map(x => fp(x.later)).join(', ')}), jadi dampaknya tidak menyusul. Peringatan berguna bila keluar sebelum atau pada hari polusi tinggi.`,
          `${lagSig ? `${lagSig} dari ${LG.length * 7} hari sesudahnya berbeda dari nol secara statistik, tetapi nilainya kecil (paling besar ${f(lagMax, 2)}%).` : 'Tidak satu pun hari sesudahnya berbeda dari nol secara statistik.'} Rincian tiap hari ada di tabel.`),
        table: () => ({ cols: [{ k: 'o', l: 'Luaran' }].concat([0, 1, 2, 3, 4, 5, 6, 7].map(i => ({ k: 'l' + i, l: i ? `+${i} hari` : 'Hari yang sama', num: 1, fmt: v => fp(v, 2) }))).concat([{ k: 'cum', l: 'Total 0–7', num: 1, fmt: v => fp(v, 2) }]),
          rows: Object.keys(OUTC).filter(k => M[k]).map(k => { const o = { o: OUTC[k].s, cum: M[k].cum.pct }; M[k].lags.forEach((l, i) => o['l' + i] = l.pct); return o; }) }),
        info: { rumus: 'Koefisien lag 0..7 dari model distributed-lag yang sama.', data: `${fi(D.model.n)} hari-RS`, filter: false } })}
      <h2 class="t-sec">Siapa dan di mana paling terdampak?</h2>
      ${card({ id: 'vuln', span: 's6', h: 'h520', title: 'Balita vs lansia: siapa lebih rentan?', sub: 'Kiri: persen kenaikan kasus per +10 µg/m³. Kanan: rata-rata kasus per hari per RS. Skalanya berbeda, jadi dibuat dua panel.',
        legend: '<span><i style="background:var(--k-gambut)"></i>Balita (<5 th)</span><span><i style="background:var(--k-industri)"></i>Lansia (>60 th)</span>',
        lead: `Per kenaikan 10 µg/m³, efek pada balita (${fp(u5.pct)}) dan lansia (${fp(o60.pct)}) ${ovl ? 'hampir sama' : 'berbeda nyata'}. Karena kasus lansia lebih banyak, tambahan pasien terbanyak tetap datang dari <b>lansia</b>: +${f(aO, 2)} pasien per hari di satu RS, dibanding +${f(aU, 2)} untuk balita.`, note: nt(`Per +10 µg/m³, balita (${fp(u5.pct)}) dan lansia (${fp(o60.pct)}) ${ovl ? 'hampir sama' : 'berbeda nyata'}. Tetapi kasus lansia lebih banyak (${f(M.o60.mean)} vs ${f(M.u5.mean)} per hari per RS), jadi tambahan pasien terbanyak datang dari lansia: <b>+${f(aO, 2)}</b> vs <b>+${f(aU, 2)}</b> pasien per hari di satu RS, atau sekitar <b>${f(NRS * (aU + aO), 0)}</b> pasien per hari di ${NRS} RS.`),
        info: { rumus: 'Relatif: model kontrol ketat lag 0. Absolut: rata-rata kasus harian semua RS dalam model.', data: `${fi(D.model.n)} hari-RS`, filter: false } })}
      ${card({ id: 'load', span: 's6', h: 'h520', title: 'RS mana yang paling kewalahan?', sub: `Satu batang = satu RS, diberi kode stasiun pasangannya. Nilai = rata-rata ${lcf(LO[1])} per hari per 100 TT. Warna = kategori ISPU PM2.5 stasiun pasangan, urutan = beban RS.`,
        ctrl: seg('ld_o', this._LO.map(x => [x[0], x[2]]), this._lo), legend: ISPU.filter(c => ld.some(r => ispuOf(r.pm).k === c.k)).map(c => `<span><i style="background:var(${c.v})"></i>${c.l}</span>`).join(''),
        lead: ld.length ? `${ld.slice(0, 3).map(r => `<b>${r.code}</b>`).join(', ')} paling kewalahan, dengan ${f(ld[Math.min(2, ld.length - 1)].v, 1)} sampai ${f(ld[0].v, 1)} kasus per 100 tempat tidur per hari.${ldHiPm.length ? ` ${ldHiPm.map(r => r.code).join(', ')} berpolusi tinggi tetapi bebannya rendah.` : ''}` : null, note: ld.length ? nt(`Tertinggi: <b>${ld.slice(0, 3).map(r => `${r.code} (${f(r.v, 1)})`).join(', ')}</b> kasus per 100 ${term('TT')} per hari.${ldHiPm.length ? ` ${ldHiPm.map(r => r.code).join(', ')} berpolusi tinggi tetapi bebannya rendah (< 3).` : ''}`,
          'Ikut bergantung pada ukuran RS; tidak ada data populasi.') : '',
        table: () => ({ cols: [{ k: 'rs', l: 'RS' }, { k: 'code', l: 'Stasiun' }, { k: 'tt', l: 'TT', num: 1, fmt: fi }, { k: 'v', l: `${LO[2]}/100 TT/hari`, num: 1, fmt: v => f(v, 2) }, { k: 'pm', l: 'PM2.5', num: 1, fmt: v => f(v) }], rows: ld }),
        info: { rumus: `(${this._lo === 'ispa' ? 'ISPA balita + ISPA lansia' : LO[1]}) per hari ÷ kapasitas_tempat_tidur × 100, rata-rata periode.`, data: 'HLT-01 + hospitals.csv', cat: 'Deskriptif; tidak mengontrol musim atau ukuran populasi (tidak ada data populasi).' } })}
      <h2 class="t-sec">Bukti di lapangan</h2>
      ${card({ id: 'allst', span: 's12', h: 'h520', title: 'Apakah asap 2026 lebih parah dari 2024?',
          sub: `Satu titik per stasiun, 1 September–13 Oktober. Kiri: PM2.5. Kanan: kematian per hari di RS rujukan. Titik abu = 2024, titik berwarna = 2026, diurutkan dari PM2.5 2026 tertinggi.`,
          legend: `<span><i style="background:var(--line-2);border-radius:50%"></i>2024</span><span><i style="background:var(--k-gambut);border-radius:50%"></i>2026 PM2.5</span><span><i style="background:var(--ispu-4);border-radius:50%"></i>2026 kematian</span>`,
          lead: chg.length ? `Sebanyak <b>${nUp}</b> dari ${chg.length} stasiun naik PM2.5-nya lebih dari 20% dibanding 2024, dan di <b>${nDeath}</b> di antaranya kematian di RS rujukan ikut naik lebih dari 20%. Lonjakan terbesar ada di Kalimantan Tengah.` : null, note: chg.length ? `<b>${nUp}</b> dari ${chg.length} stasiun naik PM2.5-nya lebih dari 20% dibanding 2024, dan di <b>${nDeath}</b> di antaranya kematian RS rujukan ikut naik lebih dari 20%. Lonjakan terbesar di Kalimantan Tengah; ${chg.length - nUp} stasiun lain berubah kurang dari 20%.` : '',
          info: { rumus: 'Rata-rata harian PM2.5 (hari sah) dan kematian per hari, 1 Sep–13 Okt, 2024 vs 2026. 2 stasiun rusak tidak diikutkan.', data: 'pm25 harian + HLT-01 per RS pasangan', filter: true } })}
      ${card({ id: 'case', span: 's12', h: 'h440', title: `Apakah kasus RS di ${esc(S.st)} ikut naik? (Jul–14 Okt)`, sub: `Juli–14 Oktober ${S.yr}, musim asap dan data 2026 berhenti 14 Oktober. Atas: PM2.5 harian. Bawah: ${lcf(OUTC[S.out].s)} per hari di RS rujukan, dengan garis abu-abu rata-rata dua tahun lain.`,
        ctrl: `<span class="ctrl"><span>Stasiun</span>${stSelect('caseSt', S.st)}</span>${seg('yr', [2024, 2025, 2026].map(y => [y, y]), S.yr)}<select class="sel" id="outSel2" aria-label="Pilih luaran">${Object.entries(OUTC).map(([k, o]) => `<option value="${k}" ${k === S.out ? 'selected' : ''}>${o.l}</option>`).join('')}</select>`,
        legend: `<span><i class="line" style="background:var(--k-gambut)"></i>PM2.5 ${S.yr}</span><span><i class="line" style="background:var(--ispu-4)"></i>${OUTC[S.out].l} ${S.yr}</span><span><i class="line" style="background:var(--muted)"></i>Rata-rata 2 tahun lain</span>`,
        lead: cPk >= 0 ? `PM2.5 rata-rata pada periode ini ${f(mean(cPm.filter(v => v != null)))} µg/m³, dengan puncak <b>${f(cPm[cPk])}</b> µg/m³ pada ${fd(cw0(S.yr) + cPk)}. ${OUTC[S.out].l} <b>${fp(100 * (cCur / cRef - 1))}</b> dibanding ${cOth.join(' dan ')} pada tanggal yang sama.` : null, note: cPk >= 0 ? nt(`PM2.5 rata-rata ${f(mean(cPm.filter(v => v != null)))} µg/m³, puncak <b>${f(cPm[cPk])}</b> (${fd(cw0(S.yr) + cPk)}). ${OUTC[S.out].l} <b>${fp(100 * (cCur / cRef - 1))}</b> dibanding ${cOth.join(' dan ')} pada tanggal yang sama.`,
          'Data apa adanya, tanpa model.') : '',
        info: { rumus: 'Data harian apa adanya (tanpa model). RS dipasangkan dengan stasiun bernomor sama (Booklet hlm. 4–7).', data: 'pm25 harian + HLT-01', filter: false } })}
      ${jawab(4, `Setiap PM2.5 naik 10 µg/m³, kasus pernapasan ikut naik <b>+${f(rLo, 1)}–${f(rHi, 1)}%</b>, kardiovaskular <b>${fp(M.cvd.lags[0].pct)}</b>, dan kematian <b>${fp(M.death.lags[0].pct)}</b> pada hari yang sama. Efeknya tidak menumpuk di hari-hari berikutnya. Balita dan lansia sama rentan, tetapi pasien lansia lebih banyak.`,
        `Menurunkan puncak polusi berarti mengurangi pasien di hari itu juga. Saat kabut asap 2026, kematian di dua RS rujukan Kalimantan Tengah mencapai ${f(Math.min(k26 / k25, k26 / k24), 1)}–${f(Math.max(k26 / k25, k26 / k24), 1)}× periode yang sama tahun sebelumnya, jadi kesiapan RS perlu mengikuti kalender musim.`,
        'ini hubungan statistik pada data panitia, bukan bukti sebab-akibat. Tanpa data jumlah penduduk, angkanya belum bisa diubah menjadi risiko per orang.')}
      </div>`;
  },
  _LO: [['ispa', 'ISPA (balita + lansia)', 'ISPA'], ['resp', 'Pernapasan umum', 'Pernapasan'], ['asma', 'Darurat asma', 'Asma'], ['ppok', 'PPOK', 'PPOK'], ['cvd', 'Kardiovaskular', 'Jantung'], ['death', 'Kematian', 'Kematian']],
  _load(o = 'ispa') {
    const [d0, d1] = range();
    return active().map(s => { const h = D.health[s.rs], v = []; for (let i = d0; i <= d1; i++) { if (o === 'ispa') { if (h.u5[i] != null) v.push(h.u5[i] + h.o60[i]); } else if (h[o][i] != null) v.push(h[o][i]); }
      return { _st: s.code, rs: s.rs, code: s.code, tt: s.rs_tt, v: s.rs_tt ? 100 * mean(v) / s.rs_tt : null, pm: sstat(s.code).mean, nama: s.rs_nama }; }).filter(r => r.v != null).sort((a, b) => b.v - a.v);
  },
  mount(C) {
    const M = D.model.outcomes, keys = Object.keys(OUTC);
    const fr = keys.map((k, i) => { const e = M[k].lags[0]; return [e.lo, e.hi, e.pct, i]; });
    const nv = keys.map((k, i) => [M[k].naive.pct, i]);
    const xmax = Math.max(...keys.map(k => Math.max(M[k].naive.hi, M[k].mid.hi, M[k].lags[0].hi))) * 1.08;
    const forestSeries = (data, getLabel) => ({ type: 'custom', data, encode: { x: [0, 1, 2], y: 3 },
      renderItem: (p, api) => { const a = api.coord([api.value(0), api.value(3)]), b = api.coord([api.value(1), api.value(3)]), c = api.coord([api.value(2), api.value(3)]);
        return { type: 'group', children: [{ type: 'line', shape: { x1: a[0], y1: a[1], x2: b[0], y2: b[1] }, style: { stroke: cv('--ink-2'), lineWidth: 2 } },
          { type: 'circle', shape: { cx: c[0], cy: c[1], r: 6 }, style: { fill: cv('--brand'), stroke: cv('--surface'), lineWidth: 2 } },
          { type: 'text', style: { text: getLabel(api.value(2)), x: api.coord([Math.max(api.value(1), (nv[api.value(3)] || [0])[0]), 0])[0] + 14, y: c[1], verticalAlign: 'middle', fill: cv('--ink'), fontSize: 11.5, fontWeight: 600, fontFamily: FONT } }] }; } });
    const ko = keys.filter(k => M[k]).sort((a, b) => M[a].lags[0].pct - M[b].lags[0].pct), fc = k => k === 'u5' ? cv('--k-gambut') : k === 'o60' ? cv('--k-industri') : k === 'death' ? cv('--ispu-4') : hexA(cv('--brand'), .45);
    mk('forest', { grid: { left: 8, right: 56, top: 6, bottom: 24, containLabel: true },
      tooltip: { formatter: p => { const k = ko[p.dataIndex], e = M[k].lags[0]; return `${OUTC[k].s}<br>Kasus naik <b>${fp(e.pct, 2)}</b> tiap PM2.5 naik 10 µg/m³<br>IK 95%: ${f(e.lo, 2)} s.d. ${f(e.hi, 2)}%<br><span style="color:var(--muted)">Tanpa kontrol musim: ${fp(M[k].naive.pct, 2)}</span>`; } },
      xAxis: ax({ type: 'value', min: 0, max: Math.ceil(Math.max(...ko.map(k => M[k].lags[0].hi)) + .5), name: '% kenaikan kasus', nameLocation: 'middle', nameGap: 24, axisLabel: { formatter: '{value}%', color: cv('--muted'), fontSize: 11 } }),
      yAxis: ax({ type: 'category', data: ko.map(k => OUTC[k].l), axisLabel: { color: cv('--ink-2'), fontSize: 12 } }),
      series: [{ type: 'bar', barWidth: '56%', data: ko.map(k => ({ value: M[k].lags[0].pct, itemStyle: { color: fc(k), borderRadius: [0, 4, 4, 0] } })) },
        { type: 'custom', silent: true, data: ko.map((k, i) => [M[k].lags[0].lo, M[k].lags[0].hi, i]), encode: { x: [0, 1], y: 2 }, z: 3,
          renderItem: (p, api) => { const a = api.coord([api.value(0), api.value(2)]), b = api.coord([api.value(1), api.value(2)]);
            return { type: 'group', children: [{ type: 'line', shape: { x1: a[0], y1: a[1], x2: b[0], y2: b[1] }, style: { stroke: cv('--ink'), lineWidth: 1.4, opacity: .7 } },
              { type: 'text', style: { text: fp(M[ko[api.value(2)]].lags[0].pct), x: b[0] + 8, y: b[1], verticalAlign: 'middle', fill: cv('--ink'), fontSize: 11.5, fontWeight: 700, fontFamily: FONT } }] }; } }] });
    const os = C.querySelector('#outSel'); if (os) os.onchange = e => setS({ out: e.target.value });
    const os2 = C.querySelector('#outSel2'); if (os2) os2.onchange = e => setS({ out: e.target.value });
    const LG = this._lag || [];
    mk('lag', { grid: { left: 8, right: 16, top: 26, bottom: 8, containLabel: true },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: ps => `<b>${OUTC[LG[ps[0].dataIndex].k].s}</b><br>` + ps.map(p => `${p.marker}${p.seriesName}: <b>${fp(p.value, 2)}</b>`).join('<br>') },
      xAxis: ax({ type: 'category', data: LG.map(x => OUTC[x.k].l), axisLabel: { color: cv('--ink'), fontSize: 12, fontWeight: 600 } }),
      yAxis: ax({ type: 'value', axisLabel: { formatter: '{value}%', color: cv('--muted'), fontSize: 11 } }),
      series: [{ name: 'Hari yang sama', type: 'bar', barWidth: '30%', barGap: '18%', data: LG.map(x => x.same), itemStyle: { color: cv('--brand'), borderRadius: [5, 5, 0, 0] }, label: { show: true, position: 'top', formatter: p => fp(p.value), color: cv('--ink'), fontWeight: 700, fontSize: 12 } },
        { name: 'Total 7 hari sesudahnya', type: 'bar', barWidth: '30%', data: LG.map(x => x.later), itemStyle: { color: hexA(cv('--muted'), .55), borderRadius: [5, 5, 0, 0] }, label: { show: true, position: 'top', formatter: p => fp(p.value), color: cv('--ink-2'), fontSize: 11.5 } }] });
    // studi kasus
    const cs = C.querySelector('#caseSt'); if (cs) cs.onchange = e => setS({ st: e.target.value });
    bindSeg(C, 'yr', v => setS({ yr: +v }));
    const s = BY[S.st], w0 = y => dayIdx(`${y}-07-01`), len = dayIdx('2026-10-14') - w0(2026) + 1;
    const lab = Array.from({ length: len }, (_, i) => { const dd = dayDate(w0(2026) + i); return dd.getUTCDate() + ' ' + BULAN[dd.getUTCMonth()]; });
    const pm = Array.from({ length: len }, (_, i) => D.pm25[S.st][w0(S.yr) + i]);
    const H = D.health[s.rs][S.out], cur = Array.from({ length: len }, (_, i) => H[w0(S.yr) + i]);
    const oth = [2024, 2025, 2026].filter(y => y !== S.yr), ref = Array.from({ length: len }, (_, i) => mean(oth.map(y => H[w0(y) + i])));
    const cc = [cv('--k-gambut'), cv('--ispu-4'), cv('--muted')];
    mk('case', { axisPointer: { link: [{ xAxisIndex: 'all' }] }, tooltip: { trigger: 'axis', axisPointer: { type: 'line' } },
      ...twoPanel('case', `Polusi PM2.5 harian di ${stName(S.st)} (µg/m³)`, 'Garis titik hitam = baku 24 jam 55 µg/m³ (PP 22/2021).',
        `${OUTC[S.out].s} per hari di ${BY[S.st].rs_nama}`, `Merah = ${S.yr} · abu-abu = rata-rata ${[2024, 2025, 2026].filter(y => y !== S.yr).join(' & ')} pada tanggal yang sama. Jarak merah dari abu-abu = tambahan kasus.`),
      xAxis: [ax({ type: 'category', data: lab, gridIndex: 0, boundaryGap: false, axisLabel: { show: false } }), ax({ type: 'category', data: lab, gridIndex: 1, boundaryGap: false, axisLabel: { color: cv('--muted'), fontSize: 11, interval: 14 } })],
      yAxis: [ax({ type: 'value', gridIndex: 0, splitNumber: 3 }), ax({ type: 'value', gridIndex: 1, splitNumber: 3 })],
      series: [{ name: 'PM2.5', type: 'line', data: pm, symbol: 'none', connectNulls: false, itemStyle: { color: cc[0] }, lineStyle: { width: 2, color: cc[0] }, areaStyle: { color: cv('--k-gambut'), opacity: .1 }, markLine: mlBaku() },
        { name: OUTC[S.out].l + ' ' + S.yr, type: 'line', xAxisIndex: 1, yAxisIndex: 1, data: cur, symbol: 'none', itemStyle: { color: cc[1] }, lineStyle: { width: 2, color: cc[1] } },
        { name: 'Rata-rata ' + oth.join(' & '), type: 'line', xAxisIndex: 1, yAxisIndex: 1, data: ref, symbol: 'none', itemStyle: { color: cc[2] }, lineStyle: { width: 1.6, color: cc[2] } }] });
    // rentan
    const g = [['Balita', 'u5', '--k-gambut'], ['Lansia', 'o60', '--k-industri']];
    mk('vuln', { grid: [{ left: 8, width: '42%', top: 30, bottom: 8, containLabel: true }, { right: 8, width: '42%', top: 30, bottom: 8, containLabel: true }],
      title: [{ text: '% per +10 µg/m³', left: '2%', top: 0, textStyle: { fontSize: 12, color: cv('--ink-2'), fontWeight: 600, fontFamily: FONT } }, { text: 'kasus per hari per RS', left: '54%', top: 0, textStyle: { fontSize: 12, color: cv('--ink-2'), fontWeight: 600, fontFamily: FONT } }],
      tooltip: { trigger: 'item' },
      xAxis: [ax({ type: 'category', data: g.map(x => x[0]), gridIndex: 0 }), ax({ type: 'category', data: g.map(x => x[0]), gridIndex: 1 })],
      yAxis: [ax({ type: 'value', gridIndex: 0, min: 0 }), ax({ type: 'value', gridIndex: 1, min: 0 })],
      series: [{ type: 'bar', barWidth: '46%', xAxisIndex: 0, yAxisIndex: 0, data: g.map(x => ({ value: M[x[1]].lags[0].pct, itemStyle: { color: cv(x[2]), borderRadius: [4, 4, 0, 0] } })), label: { show: true, position: 'top', formatter: p => fp(p.value), color: cv('--ink'), fontWeight: 700, fontSize: 12 }, tooltip: { formatter: p => `${p.name}: <b>${fp(p.value, 2)}</b> per +10 µg/m³` } },
        { type: 'bar', barWidth: '46%', xAxisIndex: 1, yAxisIndex: 1, data: g.map(x => ({ value: M[x[1]].mean, itemStyle: { color: cv(x[2]), borderRadius: [4, 4, 0, 0] } })), label: { show: true, position: 'top', formatter: p => f(p.value), color: cv('--ink'), fontWeight: 700, fontSize: 12 }, tooltip: { formatter: p => `${p.name}: <b>${f(p.value, 2)}</b> kasus/hari/RS` } }] });
    const drawLoad = () => {
    const ld = this._load(this._lo).slice().reverse(), LOn = this._LO.find(x => x[0] === this._lo)[1];
    mk('load', { grid: { left: 8, right: 44, top: 8, bottom: 30, containLabel: true }, tooltip: { formatter: p => { const r = ld[p.dataIndex]; return `<b>${r.rs}</b> ${esc(r.nama)} (${fi(r.tt)} TT)<br>Stasiun ${r.code}: PM2.5 ${f(r.pm)} µg/m³<br>${LOn}: <b>${f(r.v, 2)}</b> per 100 TT per hari`; } },
      xAxis: ax({ type: 'value', name: 'kasus per 100 TT per hari', nameLocation: 'middle', nameGap: 24 }), yAxis: ax({ type: 'category', data: ld.map(r => r.code), axisLabel: { color: cv('--ink-2'), fontSize: 10.5, interval: 0 } }),
      series: [{ type: 'bar', barWidth: '60%', data: ld.map(r => ({ value: r.v, itemStyle: { color: ispuCol(r.pm), borderRadius: [0, 4, 4, 0] } })), label: { show: true, position: 'right', formatter: p => f(p.value, 1), fontSize: 10.5, color: cv('--ink-2') } }] },
      p => go('stasiun', { st: ld[p.dataIndex].code }));
    };
    drawLoad();
    const bindLd = root => bindSeg(root, 'ld_o', v => { this._lo = v; const tmp = document.createElement('div'); tmp.innerHTML = this.html(); const nc = tmp.querySelector('#card-load'), oc = C.querySelector('#card-load');
      if (!nc || !oc) { render(false); return; }
      const el = oc.querySelector('.chart'), old = el && echarts.getInstanceByDom(el); if (old) { old.dispose(); CH.delete('load'); }
      oc.replaceWith(nc); drawLoad(); bindLd(nc); });
    bindLd(C);
    { const d = this._d;
    if (d.chg && d.chg.length) {
      const ch = d.chg, cat = ch.map(r => r.code), aw = document.getElementById('allst').clientWidth, nar = aw < 560;
      const ttl = (text, left) => ({ text, left, top: 0, textStyle: { fontSize: 13, fontWeight: 700, color: cv('--ink'), fontFamily: FONT } });
      const dumb = (key, color, xi) => {
        const k24 = 'p' === key ? 'p2024' : 'd2024', k26 = 'p' === key ? 'p2026' : 'd2026';
        const dot = (name, k, col, size) => ({ name, type: 'scatter', xAxisIndex: xi, yAxisIndex: xi, symbolSize: size, z: 3, itemStyle: { color: col, borderColor: cv('--surface'), borderWidth: 1.5 },
          data: ch.map((r, i) => ({ value: [r[k], r.code], label: { show: name.includes('2026') && i < 2, position: 'right', distance: 8, fontSize: 11, fontWeight: 700, color: cv('--ink-2'), fontFamily: FONT, formatter: q => f(q.value[0], key === 'p' ? 0 : 1) } })) });
        return [{ name: '_b', type: 'bar', stack: 'r' + xi, xAxisIndex: xi, yAxisIndex: xi, barWidth: 3, silent: true, itemStyle: { color: 'transparent' }, data: ch.map(r => Math.min(r[k24], r[k26])), tooltip: { show: false } },
          { name: '_d', type: 'bar', stack: 'r' + xi, xAxisIndex: xi, yAxisIndex: xi, barWidth: 3, silent: true, itemStyle: { color, opacity: .35, borderRadius: 2 }, data: ch.map(r => Math.abs(r[k26] - r[k24])), tooltip: { show: false } },
          dot(key === 'p' ? 'PM2.5 2024' : 'Kematian 2024', k24, cv('--line-2'), 9), dot(key === 'p' ? 'PM2.5 2026' : 'Kematian 2026', k26, color, 11)];
      };
      const rowAx = (xi, show) => ax({ type: 'category', data: cat, gridIndex: xi, inverse: true, boundaryGap: true, splitLine: { show: true, lineStyle: { color: cv('--line'), opacity: .55 } }, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { show, color: cv('--ink-2'), fontSize: 10.5, interval: 0 } });
      mk('allst', { tooltip: { trigger: 'axis', axisPointer: { type: 'line', lineStyle: { color: cv('--line-2') } }, formatter: ps => { const t = BY[ps[0].axisValue], v = ps.filter(p => p.seriesName[0] !== '_'); return `<b>${t.code}</b> · ${esc(t.kota)}<br><span style="opacity:.7">${esc(t.kec)}, ${esc(t.prov)} · ${esc(t.kel)}</span><br>` + v.map(p => `${p.marker}${p.seriesName}: <b>${f(p.value[0])}</b>`).join('<br>'); } },
        title: [ttl('PM2.5 (µg/m³)', nar ? 52 : 62), ttl(nar ? 'Kematian/hari (RS)' : 'Kematian per hari (RS rujukan)', nar ? '56%' : '57%')],
        grid: [{ left: nar ? 52 : 62, right: nar ? '52%' : '47%', top: 28, bottom: 24 }, { left: nar ? '56%' : '57%', right: 40, top: 28, bottom: 24 }],
        xAxis: [ax({ type: 'value', gridIndex: 0, splitLine: { show: false }, max: v => Math.ceil(v.max * 1.12) }), ax({ type: 'value', gridIndex: 1, splitLine: { show: false }, max: v => Math.ceil(v.max * 1.12) })],
        yAxis: [rowAx(0, true), rowAx(1, false)],
        series: [...dumb('p', cv('--k-gambut'), 0), ...dumb('d', cv('--ispu-4'), 1)] },
        p => go('stasiun', { st: cat[p.dataIndex] }));
    }
    }
  },
};

/* ================= T5 JARINGAN ================= */
// Stasiun rusak: beban polusi hanya dari jam VALID miliknya sendiri (analisis/06_rusak.py -> out/rusak.json), tanpa data luar.
// MER-01: 4.891 jam valid tersebar di 12 kuartal dan 24 jam-ke, rata-rata 16,0 ug/m3, tidak satu jam pun > 55 -> 0.
// JMB-02: hanya 122 jam valid dan tidak sejalan dengan JMB-01 (r 0,08) -> tak terukur (null, sumbangan 0, bobot tidak dibagi ulang).
const RUSAK = { 'MER-01': { beban: 0, jam: 4891, mean: 16.0 }, 'JMB-02': { beban: null } };
function prioRows(w) {
  const all = activeAll(), maxNN = Math.max(...ST.map(s => D.network.nn[s.code].km));
  const health = s => { const h = D.health[s.rs].resp; return s.rs_tt ? 100 * mean(h) / s.rs_tt : null; };
  const hmax = Math.max(...ST.map(health));
  return all.map(s => {
    const t = sstat(s.code, [0, ND - 1]);
    const c = { beban: s.use === 'rusak' ? (RUSAK[s.code] ? RUSAK[s.code].beban : null) : (t.pct || 0) / 100, sehat: health(s) / hmax, celah: 1 - s.q.days_ok / ND, jauh: D.network.nn[s.code].km / maxNN };
    const W = w.beban + w.sehat + w.celah + w.jauh || 1;
    const parts = Object.fromEntries(Object.keys(c).map(k => [k, 100 * w[k] * (c[k] || 0) / W]));
    return { code: s.code, s, c, parts, score: sum(Object.values(parts)) };
  }).sort((a, b) => b.score - a.score);
}
function rawCorr(codes) {
  const [d0, d1] = range(), out = [];
  codes.forEach((a, i) => codes.forEach((b, j) => { const x = [], y = []; for (let k = d0; k <= d1; k++) { const u = D.pm25[a][k], v = D.pm25[b][k]; if (u != null && v != null) { x.push(u); y.push(v); } } out.push([i, j, i === j ? 1 : pearson(x, y)]); }));
  return out;
}
function anomCorr(codes) {
  const [d0, d1] = range(), A = {};
  for (const c of codes) { const a = D.pm25[c], mm = {}; for (let i = d0; i <= d1; i++) if (a[i] != null) { const m = monOfDay(i); (mm[m] = mm[m] || []).push(a[i]); }
    const mu = {}; for (const m in mm) mu[m] = mean(mm[m]); A[c] = []; for (let i = d0; i <= d1; i++) A[c].push(a[i] == null ? null : a[i] - mu[monOfDay(i)]); }
  const out = [];
  codes.forEach((a, i) => codes.forEach((b, j) => { if (j < i) return; let r = 1; if (i !== j) { const x = [], y = []; A[a].forEach((v, k) => { if (v != null && A[b][k] != null) { x.push(v); y.push(A[b][k]); } }); r = pearson(x, y); }
    out.push([i, j, r]); if (i !== j) out.push([j, i, r]); }));
  return out;
}
const W0 = { beban: 3, sehat: 2, celah: 2, jauh: 2 };
PAGES.t5 = {
  title: 'Jaringan pemantau', nav: 'Jaringan pemantau', group: 'Analisis lanjutan',
  html() {
    const all = activeAll(); if (!all.length) return ph({ k: 'Analisis lanjutan · menjawab T5', h: 'Di mana alat baru dibutuhkan?', lede: '' }) + emptyMsg;
    const nA = ST.filter(s => s.use === 'andal').length, nP = ST.filter(s => s.use === 'parsial').length, nR = ST.filter(s => s.use === 'rusak').length;
    const far = Object.entries(D.network.nn).sort((a, b) => b[1].km - a[1].km)[0];
    const ci = D.network.corr_codes, kk = D.network.corr[ci.indexOf('KTG-01')][ci.indexOf('KTG-02')];
    this._w = this._w || { ...W0 };
    const pr = prioRows(this._w).slice(0, 5).map(r => r.code);
    const farL = all.map(s => ({ s, n: D.network.nn[s.code] })).filter(x => x.n.km >= 150).sort((a, b) => b.n.km - a.n.km);
    const papA = ST.filter(s => s.pulau === 'Papua' && s.use === 'andal').length;
    // Daftar 38 provinsi ditulis langsung (fakta administratif), bukan dibaca dari file peta; file peta hanya untuk gambar.
    const provAll = ['Aceh', 'Sumatera Utara', 'Sumatera Barat', 'Riau', 'Kepulauan Riau', 'Jambi', 'Sumatera Selatan', 'Kepulauan Bangka Belitung', 'Bengkulu', 'Lampung', 'Banten', 'DKI Jakarta', 'Jawa Barat', 'Jawa Tengah', 'D.I. Yogyakarta', 'Jawa Timur', 'Bali', 'Nusa Tenggara Barat', 'Nusa Tenggara Timur', 'Kalimantan Barat', 'Kalimantan Tengah', 'Kalimantan Selatan', 'Kalimantan Timur', 'Kalimantan Utara', 'Sulawesi Utara', 'Gorontalo', 'Sulawesi Tengah', 'Sulawesi Barat', 'Sulawesi Selatan', 'Sulawesi Tenggara', 'Maluku', 'Maluku Utara', 'Papua', 'Papua Barat', 'Papua Barat Daya', 'Papua Tengah', 'Papua Pegunungan', 'Papua Selatan'], anySt = new Set(ST.map(s => s.prov)), okSt = new Set(ST.filter(s => s.use !== 'rusak').map(s => s.prov));
    const noSt = provAll.filter(p => !anySt.has(p)), onlyR = provAll.filter(p => anySt.has(p) && !okSt.has(p)), noData = noSt.concat(onlyR), nProv = provAll.length || 38;
    this._prov = { noData, PRI: ['Papua Selatan', 'Jambi', 'Sumatera Selatan'] };
    return ph({ k: (typeof ljKick === 'function' ? ljKick(4, 'Di mana kita buta') : 'Analisis lanjutan') + ' · menjawab T5', h: 'Di mana alat baru dibutuhkan?',
      lede: `Hanya <b>${nA} dari 27</b> stasiun berdata andal dan <b>${noData.length} dari ${nProv}</b> provinsi belum punya data udara, dengan yang paling mendesak <b>Papua Selatan</b>, <b>pedalaman gambut Jambi</b>, dan <b>Sumatera Selatan</b>.`, goal: 5,
      scope: `Dasar: semua 27 stasiun, termasuk yang rusak · ${term('andal')} = data sah ≥90% hari · jarak lurus dari koordinat sites.csv.` }) +
      `      <div class="grid">
      <h2 class="t-sec">Sebaran sekarang</h2>
      ${card({ id: 'net', span: 's12', title: `Provinsi mana belum terpantau? (${noData.length} dari ${nProv})`, sub: 'Titik = stasiun, warna = keandalan data. Garis = sambungan ke stasiun terdekat (≥150 km diberi label jarak). Provinsi pucat = belum terpantau.',
        legend: `<span><i class="dot" style="background:var(--ok)"></i>${term('andal', 'Andal')}</span><span><i class="dot" style="background:var(--warn)"></i>${term('parsial', 'Parsial')}</span><span><i class="dot" style="background:var(--bad)"></i>${term('rusak', 'Rusak')}</span><span><i style="background:color-mix(in srgb, var(--bad) 22%, var(--surface))"></i>Provinsi prioritas</span><span><i style="background:color-mix(in srgb, var(--muted) 12%, var(--surface))"></i>Belum terpantau</span>`,
        lead: `${noSt.length} provinsi tidak punya stasiun sama sekali${onlyR.length ? `, dan ${onlyR.join(', ')} hanya punya stasiun rusak` : ''}. Sebanyak <b>${farL.length}</b> dari ${all.length} stasiun berjarak 150 km atau lebih dari tetangga terdekatnya, dan seluruh Papua hanya punya <b>${papA}</b> stasiun andal.`, note: nt(`${noSt.length} provinsi tidak punya stasiun sama sekali${onlyR.length ? `, dan ${onlyR.join(', ')} hanya punya stasiun rusak` : ''}. <b>${farL.length}</b> dari ${all.length} stasiun berjarak ≥150 km dari ${term('tetangga terdekat')}.${farL[0] ? ` Terjauh: ${farL[0].s.code} ${esc(farL[0].s.kota)} (${fi(farL[0].n.km)} km).` : ''} Seluruh Papua hanya punya <b>${papA}</b> stasiun andal.`,
          'Jarak lurus antarkoordinat, bukan cakupan wilayah. Tanpa data penduduk dan luas wilayah, provinsi kosong belum bisa diurutkan satu per satu.'),
        src: 'Batas provinsi: GeoJSON 38 provinsi (ardian28, lisensi MIT), hanya untuk gambar.',
        table: () => ({ cols: [{ k: 'code', l: 'Kode' }, { k: 'kota', l: 'Lokasi' }, { k: 'use', l: 'Status data' }, { k: 'days', l: 'Hari sah', num: 1, fmt: fi }, { k: 'nn', l: 'Terdekat' }, { k: 'km', l: 'Jarak km', num: 1, fmt: fi }], rows: all.map(s => ({ _st: s.code, code: s.code, kota: s.kota, use: s.use, days: s.q.days_ok, nn: D.network.nn[s.code].code, km: D.network.nn[s.code].km })) }),
        info: { rumus: 'Jarak haversine antar koordinat sites.csv.', data: 'sites.csv + clean_log' } })}
      <h2 class="t-sec">Seberapa andal?</h2>
      ${card({ id: 'ptab', span: 's12', title: 'Bagaimana kondisi tiap pulau?', sub: 'Satu baris per pulau, seluruh periode. Angka polusi hanya dari stasiun berdata.', body: '<div class="tbl-wrap" style="max-height:none" id="ptabw"></div>' })}
      <h2 class="t-sec">Di mana dulu?</h2>
      ${card({ id: 'prio', span: 's12', h: 'h380', title: `${term('skor prioritas', 'Skor prioritas')}: perbaiki mana dulu?`, sub: 'Batang bertumpuk = sumbangan tiap komponen pada skor, untuk 10 stasiun teratas dari 27. Bobot bisa diatur; titik baru untuk provinsi kosong ada di peta.',
        ctrl: Object.entries({ beban: 'Beban polusi', sehat: 'Beban RS', celah: 'Celah data', jauh: 'Keterpencilan' }).map(([k, l]) => `<label style="display:flex;gap:6px;align-items:center;font-size:12px;color:var(--ink-2)">${l}<input type="range" min="0" max="4" step="1" value="${this._w[k]}" data-w="${k}" style="width:70px;accent-color:var(--brand)"><b data-wv="${k}">${this._w[k]}</b></label>`).join(''),
        legend: [['beban', '--k-gambut', 'Beban polusi (% hari > 55)'], ['sehat', '--ispu-4', 'Beban RS (pernapasan/100 TT)'], ['celah', '--warn', 'Celah data (1 − hari sah)'], ['jauh', '--k-bersih', 'Keterpencilan (jarak tetangga)']].map(([k, v, l]) => `<span><i style="background:var(${v})"></i>${l}</span>`).join(''),
        note: nt('<span id="prioNote"></span>', 'Alat bantu diskusi, bukan model optimasi lokasi. Tidak ada data populasi atau luas wilayah.'),
        table: () => ({ cols: [{ k: 'code', l: 'Kode' }, { k: 'score', l: 'Skor', num: 1, fmt: v => f(v) }, { k: 'beban', l: 'Polusi', num: 1, fmt: v => f(v) }, { k: 'sehat', l: 'RS', num: 1, fmt: v => f(v) }, { k: 'celah', l: 'Celah', num: 1, fmt: v => f(v) }, { k: 'jauh', l: 'Jauh', num: 1, fmt: v => f(v) }], rows: prioRows(this._w).map(r => ({ _st: r.code, code: r.code, score: r.score, ...r.parts })) }),
        info: { rumus: 'Skor = Σ bobot × komponen (0–1) ÷ Σ bobot × 100. Komponen dinormalisasi ke nilai maksimum. Stasiun rusak: MER-01 memakai 4.891 jam valid miliknya sendiri (rata-rata 16,0 µg/m³, tidak ada jam > 55 → 0); JMB-02 tak terukur (hanya 122 jam valid, tidak sejalan dengan JMB-01) → sumbangan polusi 0 dan bobot tidak dibagi ulang. Skrip: analisis/06_rusak.py.', data: 'pm25 harian, HLT-01, hospitals.csv, sites.csv, clean_log', filter: false, cat: 'Alat bantu diskusi, bukan model optimasi lokasi. Tidak ada data populasi/luas wilayah.' } })}
      ${jawab(5, `Jaringan belum cukup: hanya <b>${nA} dari 27</b> stasiun berdata andal, dan <b>${noData.length} dari ${nProv}</b> provinsi belum punya data udara sama sekali. Celah terbesar ada di Papua Selatan (MER-01), pedalaman gambut Jambi (JMB-02), dan Sumatera Selatan (PLB-01).`,
        'Langkah paling masuk akal adalah memperbaiki alat yang sudah ada di wilayah berisiko tinggi, baru menambah titik baru. Menambah alat di dekat KTG-01 dan KTG-02 tidak banyak menambah informasi karena sinyal keduanya kembar.',
        'prioritas ini hanya memakai beban polusi, beban RS, celah data, dan jarak; data penduduk, luas wilayah, dan titik panas tidak tersedia. Bobotnya bisa diatur dan urutannya ikut berubah.')}
      </div>`;
  },
  mount(C) {
    const all = activeAll();
    if (!echarts.getMap('idn') && window.PROV_GEO) echarts.registerMap('idn', PROV_GEO);
    const nEl = document.getElementById('net'), PV = this._prov || { noData: [], PRI: [] };
    if (nEl && window.PROV_GEO) {
      nEl.style.height = Math.max(260, Math.min(520, nEl.clientWidth / 2.25)) + 'px';
      const stc = u => cv(u === 'andal' ? '--ok' : u === 'parsial' ? '--warn' : '--bad'), narrow = nEl.clientWidth < 560;
      const stP = {}; ST.forEach(s => (stP[s.prov] = stP[s.prov] || []).push(s));
      const regions = PROV_GEO.features.map(ft => { const n = ft.properties.name, pri = PV.PRI.includes(n), none = PV.noData.includes(n);
        return { name: n, itemStyle: { areaColor: pri ? hexA(cv('--bad'), .2) : none ? hexA(cv('--muted'), .1) : hexA(cv('--muted'), .3) }, emphasis: { itemStyle: { areaColor: pri ? hexA(cv('--bad'), .32) : hexA(cv('--muted'), .42) } } }; });
      const tipS = s => { const n = D.network.nn[s.code]; return `<b>${s.code}</b> ${esc(s.kota)}, ${esc(s.prov)}<br>Status alat: ${s.status} · data: <b>${s.use}</b> (${fi(s.q.days_ok)} hari sah)<br>Terdekat: ${n.code}, ${fi(n.km)} km${s.reason ? '<br>' + esc(s.reason) : ''}`; };
      const tipP = n => `<b>${esc(n)}</b>${PV.PRI.includes(n) ? ' · <span style="color:var(--bad)">prioritas</span>' : ''}<br>${stP[n] ? stP[n].map(s => `${s.code} <b>${s.use}</b>`).join(', ') : '<span style="color:var(--muted)">Belum ada stasiun AQMS</span>'}`;
      const km = all.map(s => ({ s, n: D.network.nn[s.code] })).filter(r => r.n.km >= 150);
      mk('net', { tooltip: { trigger: 'item' },
        geo: { map: 'idn', roam: false, aspectScale: 1, center: [118, -2.4], top: 4, bottom: 4, left: 4, right: 4,
          itemStyle: { areaColor: hexA(cv('--muted'), .1), borderColor: cv('--surface'), borderWidth: 1 },
          emphasis: { label: { show: true, color: cv('--ink'), fontSize: 11, fontWeight: 700, textBorderColor: cv('--surface'), textBorderWidth: 3 }, itemStyle: { borderColor: cv('--ink'), borderWidth: 1.2 } },
          select: { disabled: true }, label: { show: false }, tooltip: Object.assign(tipBox(), { show: true, formatter: p => p.componentType === 'geo' ? tipP(p.name) : '' }), regions },
        series: [{ type: 'lines', coordinateSystem: 'geo', silent: true, z: 3, data: all.map(s => { const n = BY[D.network.nn[s.code].code]; return { coords: [[s.lon, s.lat], [n.lon, n.lat]] }; }), lineStyle: { color: cv('--ink-2'), width: 1, opacity: .45 } },
          { type: 'scatter', coordinateSystem: 'geo', silent: true, z: 4, symbolSize: 0, data: km.map(r => { const b = BY[r.n.code]; return { value: [(r.s.lon + b.lon) / 2, (r.s.lat + b.lat) / 2], t: fi(r.n.km) + ' km' }; }),
            label: { show: !narrow, formatter: p => p.data.t, fontSize: 10, color: cv('--ink-2'), backgroundColor: cv('--surface'), padding: [1, 4], borderRadius: 3 }, labelLayout: { hideOverlap: true } },
          { type: 'scatter', coordinateSystem: 'geo', z: 5, cursor: 'pointer', tooltip: { formatter: p => p.data && p.data.code ? tipS(BY[p.data.code]) : '' },
            data: all.map(s => ({ code: s.code, value: [s.lon, s.lat], symbolSize: s.use === 'andal' ? (narrow ? 7 : 9) : (narrow ? 10 : 13), itemStyle: { color: stc(s.use) },
              label: s.use === 'andal' ? { show: false } : { show: true, formatter: s.code, position: s.lon > 138 ? 'left' : 'right', distance: 6, color: cv('--ink-2'), fontSize: 11, fontWeight: 650, textBorderColor: cv('--surface'), textBorderWidth: 3 } })),
            itemStyle: { borderColor: cv('--surface'), borderWidth: 1.6 }, emphasis: { scale: 1.5, itemStyle: { borderColor: cv('--ink'), borderWidth: 2 } } }] }, toStation);
    }
    const draw = () => {
      const rows = prioRows(this._w).slice(0, 10).reverse(), K = [['beban', '--k-gambut', 'Beban polusi'], ['sehat', '--ispu-4', 'Beban RS'], ['celah', '--warn', 'Celah data'], ['jauh', '--k-bersih', 'Keterpencilan']];
      mk('prio', { grid: { left: 8, right: 40, top: 8, bottom: 20, containLabel: true }, tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: ps => { const r = rows[ps[0].dataIndex]; return `<b>${r.code}</b> ${esc(r.s.kota)} · skor <b>${f(r.score)}</b><br>` + ps.map(p => `${p.marker}${p.seriesName}: ${p.seriesName === 'Beban polusi' && r.c.beban == null ? 'tak terukur' : f(p.value)}${p.seriesName === 'Beban polusi' && RUSAK[r.code] && r.c.beban != null ? ` (dari ${fi(RUSAK[r.code].jam)} jam valid)` : ''}`).join('<br>'); } },
        xAxis: ax({ type: 'value', max: 100 }), yAxis: ax({ type: 'category', data: rows.map(r => r.code), axisLabel: { color: cv('--ink-2'), fontSize: 11 } }),
        series: K.map(([k, v, l], i) => ({ name: l, type: 'bar', stack: 'p', barWidth: '62%', data: rows.map(r => r.parts[k]), itemStyle: { color: cv(v), borderColor: cv('--surface'), borderWidth: 1 },
          label: i === K.length - 1 ? { show: true, position: 'right', formatter: p => f(rows[p.dataIndex].score, 0), color: cv('--ink'), fontWeight: 700, fontSize: 11 } : undefined })) },
        p => go('stasiun', { st: rows[p.dataIndex].code }));
      const t3 = rows.slice().reverse().slice(0, 3), pn = document.getElementById('prioNote'), nR = t3.filter(r => r.s.use === 'rusak').length;
      if (pn) pn.innerHTML = `Tiga stasiun yang paling perlu diprioritaskan adalah <b>${t3.map(r => `${r.code} (${f(r.score, 0)})`).join(', ')}</b>.${nR ? ' Stasiun rusak mendapat skor tinggi karena wilayahnya belum terpantau.' : ''}`;
    };
    draw();
    C.querySelectorAll('[data-w]').forEach(i => i.oninput = () => { this._w[i.dataset.w] = +i.value; C.querySelector(`[data-wv="${i.dataset.w}"]`).textContent = i.value; draw(); });
    // tabel pulau
    const pt = PULAU.map(p => { const g = all.filter(s => s.pulau === p); if (!g.length) return null; const ok = g.filter(s => s.use !== 'rusak').map(s => s.code), P = pooled(ok, [0, ND - 1]);
      return { p, n: g.length, a: g.filter(s => s.use === 'andal').length, pr: g.filter(s => s.use === 'parsial').length, r: g.filter(s => s.use === 'rusak').length, m: P.mean, pct: P.pct, ep: sum(episodesIn(ok, [0, ND - 1]).map(e => e.days)) }; }).filter(Boolean);
    const empt = all.length === ST.length ? [['Bali & Nusa Tenggara', ['Bali', 'Nusa Tenggara Barat', 'Nusa Tenggara Timur']], ['Maluku', ['Maluku', 'Maluku Utara']]].filter(([, ps]) => ps.every(x => !ST.some(s => s.prov === x))).map(([p]) => p) : [];
    empt.forEach(p => pt.push({ p, n: 0, a: 0, m: null, pct: null, ep: null }));
    document.getElementById('ptabw').innerHTML = tableHTML({ cols: [{ k: 'p', l: 'Pulau' }, { k: 'a', l: 'Andal / total', num: 1, fmt: (v, r) => `${v} / ${r.n}` }, { k: 'm', l: 'PM2.5', num: 1, fmt: v => f(v) }, { k: 'pct', l: '% > 55', num: 1, fmt: v => f(v) }, { k: 'ep', l: 'Hari episode', num: 1, fmt: fi }], rows: pt }) +
      `<p class="sub" style="padding:8px 10px;margin:0">Kalimantan menanggung hari episode terbanyak, tetapi baru ${pt.find(x => x.p === 'Kalimantan')?.a ?? '–'} dari ${pt.find(x => x.p === 'Kalimantan')?.n ?? '–'} stasiunnya andal. Papua hanya punya satu stasiun andal.${empt.length ? ` ${empt.join(' dan ')} belum punya satu pun stasiun.` : ''}</p>`;
  },
};

/* ================= REKOMENDASI ================= */
PAGES.rekomendasi = {
  title: 'Rekomendasi', nav: 'Rekomendasi', group: 'Tindak lanjut',
  html() {
    const M = D.model.outcomes, k26 = kaltengDeaths(2026), k24 = kaltengDeaths(2024);
    const j2 = sstat('JKT-02', [0, ND - 1]), plb = D.episodes.filter(e => e.code === 'PLB-01');
    const gam = ST.filter(s => s.kel === 'Gambut' && s.use !== 'rusak').map(s => s.code), mg = moyProfile(gam, [0, ND - 1]);
    const hp = hourProfile(ST.filter(s => s.use !== 'rusak').map(s => s.code), 0, MONTHS.length - 1);
    const R = [
      { aud: 'daerah', pulau: ['Kalimantan', 'Sumatera'], t: 'Status siaga kabut asap otomatis setiap Agustus–Oktober', who: 'BPBD dan DLH provinsi (Kalteng, Kalbar, Sumsel, Riau, Jambi)', what: 'Pemicu siaga: PM2.5 harian > 55 µg/m³ dua hari berturut; status darurat bila > 150,4. Umumkan per jam, bukan per hari.', where: 'Wilayah stasiun gambut: KTG-01/02, PKN-01, STG-01, PLB-01, PKU-01, JMB-01, BJB-01', when: 'Mulai pekan terakhir Juli; Kalteng sejak pertengahan Juni (awal musim di sana maju)', kpi: 'Jumlah hari > 150,4 µg/m³ dan lama episode turun dari tahun ke tahun',
        ev: `Stasiun gambut rata-rata <b>${f(mg[8], 0)}–${f(mg[9], 0)} µg/m³</b> pada Sep–Okt, ${f(mg[9] / Math.min(...mg), 1)}× bulan terbersih. Episode terpanjang 43 hari (Kalteng 2026).`, go: hashOf('t2', { kel: ['Gambut'] }) },
      { aud: 'kesehatan', pulau: ['Kalimantan', 'Sumatera'], t: 'Siapkan kapasitas RS sebelum musim kabut asap, bukan saat puncak', who: 'Dinas Kesehatan provinsi dan RS rujukan (terutama RS-XXX-04 Palangka Raya, RS-XXX-05 Sampit, RS-XXX-21 Palembang)', what: 'Tambah tempat tidur pernapasan, oksigen, dan tenaga jaga mulai Agustus; aktifkan jalur cepat ISPA balita dan lansia.', where: 'RS pasangan stasiun gambut', when: 'Juli (persiapan) – Oktober', kpi: 'Kematian harian RS selama episode tidak melampaui 1,5× hari biasa',
        ev: `Kematian di RS Kalteng naik <b>${f(k26 / k24, 1)}×</b> (${f(k26)} vs ${f(k24)} per hari) saat episode 2026.`, go: hashOf('t4', { st: 'KTG-01', yr: 2026, out: 'death' }) },
      { aud: 'kesehatan', pulau: PULAU, t: 'Peringatan dini harus real-time karena dampak muncul di hari yang sama', who: 'Dinas Kesehatan dan Puskesmas', what: 'Kirim peringatan ISPU per jam ke sekolah, PAUD, dan posyandu lansia; fokus pukul 06–09 dan 17–19.', where: 'Semua kota dengan stasiun ber-ISPU "Tidak sehat"', when: 'Setiap hari', kpi: 'Kunjungan ISPA balita dan lansia pada hari PM2.5 > 55 turun',
        ev: `Efek ISPA balita ${fp(M.u5.lags[0].pct)} dan lansia ${fp(M.o60.lags[0].pct)} per +10 µg/m³ pada hari yang sama; lag 1–7 hampir nol.`, go: hashOf('t4') },
      { aud: 'daerah', pulau: ['Jawa'], t: 'Kendalikan sumber emisi industri dan pelabuhan Marunda', who: 'DLH DKI Jakarta bersama pengelola kawasan industri dan pelabuhan', what: 'Inventarisasi emisi cerobong dan kendaraan berat, uji emisi berkala, batasi aktivitas berat di jam puncak.', where: 'Cilincing (JKT-02) dan koridor Cengkareng (JKT-03)', when: 'Sepanjang tahun; evaluasi tiap 6 bulan', kpi: 'Persen hari > 55 µg/m³ di JKT-02 turun dari 100%',
        ev: `JKT-02 melewati baku 55 µg/m³ pada <b>${f(j2.pct, 0)}%</b> hari (${fi(j2.ex)} dari ${fi(j2.n)}), stabil tiap tahun.`, go: hashOf('stasiun', { st: 'JKT-02' }) },
      { aud: 'jaringan', pulau: ['Sumatera', 'Papua'], t: 'Perbaiki atau ganti stasiun rusak di wilayah rawan', who: 'KLHK (pengelola jaringan AQMS) dan DLH provinsi', what: 'Ganti JMB-02 ke pedalaman gambut Muaro Jambi, perbaiki MER-01, naikkan keandalan PLB-01, dan tambah titik di gambut Sumatera Selatan.', where: 'Jambi, Sumatera Selatan, Papua Selatan', when: 'Sebelum musim kemarau berikutnya', kpi: 'Hari sah ≥ 90% di semua stasiun',
        ev: `JMB-02 hanya 0,5% data valid, MER-01 2 hari sah, PLB-01 ${f(100 * BY['PLB-01'].q.days_ok / ND, 0)}% hari sah padahal punya <b>${plb.length} episode</b> kabut asap.`, go: hashOf('t5') },
      { aud: 'jaringan', pulau: PULAU, t: 'Pasang QC otomatis: tolak nilai "VALID" yang mencurigakan', who: 'Pengelola data AQMS (KLHK / DLH)', what: 'Tandai otomatis nilai identik ≥ 6 jam, satuan tidak standar (ppm untuk partikel), dan nilai sentinel 999; seragamkan satuan ke µg/m³.', where: 'Seluruh jaringan; prioritas BJB-01, MDN-01, PSW-01, SM2-01', when: 'Segera', kpi: 'Nol jam sensor macet berlabel VALID',
        ev: `BJB-01 tercatat VALID padahal bernilai identik selama <b>${fi(BY['BJB-01'].q.stuck)} jam</b>. Tanpa koreksi tampak sebagai stasiun terburuk dengan episode palsu 204 hari.`, go: hashOf('stasiun', { st: 'BJB-01' }) },
      { aud: 'jaringan', pulau: ['Kalimantan'], t: 'Manfaatkan titik kembar Kalteng untuk memperluas jangkauan', who: 'KLHK dan DLH Kalimantan Tengah', what: 'KTG-01 dan KTG-02 memberi sinyal identik. Pindahkan salah satu, atau tambah titik baru, antara Palangka Raya dan Pangkalan Bun.', where: 'Kalimantan Tengah bagian tengah-barat', when: 'Tahun anggaran berikutnya', kpi: 'Korelasi anomali antarstasiun Kalteng < 0,9',
        ev: `Korelasi harian KTG-01 vs KTG-02 = <b>${f(D.network.corr[D.network.corr_codes.indexOf('KTG-01')][D.network.corr_codes.indexOf('KTG-02')], 3)}</b> meski berjarak ${fi(D.network.dist['KTG-01']['KTG-02'])} km.`, go: hashOf('t5') },
    ];
    if (typeof sgCalc === 'function') { const G = sgCalc(), x = 1 / sgAloneF(SG_SC.mix[0]);
      R.push(
        { aud: 'daerah', pulau: ['Sumatera', 'Kalimantan'], t: 'Bentuk pakta asap enam provinsi: satu pemicu, aksi serentak, iuran sesuai manfaat', who: 'Gubernur, BPBD, dan DLH Sumbar, Riau, Jambi, Kepri, Kalbar, Kalteng; difasilitasi KLHK', what: 'Sepakati satu pemicu bersama (rata-rata PM2.5 enam stasiun sabuk asap > 55 µg/m³ dua hari) yang menyalakan larangan bakar, patroli, dan pemadaman di keenam provinsi pada hari yang sama. Biayai dari dana bersama dengan iuran sesuai manfaat tiap provinsi.', where: 'KTB-01, PKU-01, JMB-01, BTM-01, STG-01, PKN-01', when: 'Diteken sebelum Juli; dinilai tiap November', kpi: 'Kasus pernapasan berlebih di 6 RS sabuk asap turun dari musim ke musim',
          ev: `Keenam kota naik pada hari yang sama tiga tahun berturut-turut. Bertindak serentak menghindarkan <b>${fi(G.sumB)}</b> kasus pernapasan (1 Agu–14 Okt 2026); bertindak sendirian hanya memberi sekitar 1/${f(x, 1)} manfaat bagi RS sendiri (skenario campuran).`, go: '#/strategi?sec=dilema' },
        { aud: 'kesehatan', pulau: ['Sumatera', 'Kalimantan'], t: 'Pasangkan tiap RS sabuk asap dengan RS kembaran di luar sabuk', who: 'Kemenkes dan Dinkes provinsi; RS-XXX-10, 11, 12, 13, 19, 20 dan RS mitra', what: 'RS Sumbar, Riau, Jambi, Kepri berpasangan dengan RS Medan, Aceh, Bengkulu; RS Kalbar dan Kalteng dengan RS Banjarbaru, Samarinda, Sulawesi. Saat pemicu menyala, RS kembaran mengirim tenaga, oksigen, nebulizer, dan masker sejak lonjakan awal.', where: 'Enam RS sabuk asap dan tujuh RS mitra terdekat', when: 'Perjanjian sebelum Agustus; aktif saat pemicu menyala', kpi: 'Puncak beban RS sabuk asap tidak melebihi 3× hari normal',
          ev: `Pada puncak 2026 enam RS sabuk asap menampung <b>${f(G.pool.club.peak, 1)}×</b> kasus normal, dan saling bantu di antara mereka menurunkan puncak ${f(100 * G.pool.club.gain, 0)}%. Dengan RS terdekat di luar sabuk, puncak turun ke ${f(G.pool.dekat.peak, 1)}×.`, go: '#/strategi?sec=kembaran' },
        { aud: 'jaringan', pulau: ['Sumatera', 'Kalimantan'], t: 'Perbaiki sensor yang hilang saat musim asap sebelum menambah stasiun di sabuk asap', who: 'KLHK dan DLH Kaltim, Sumut, Kalsel, Sumsel', what: 'Utamakan SM2-01, MDN-01, BJB-01, dan PLB-01. Pemicu bersama cukup memakai satu dari enam stasiun sabuk asap yang saling mirip, jadi menambah stasiun di antaranya bernilai kecil.', where: 'Samarinda, Medan, Banjarbaru, Palembang', when: 'Sebelum Juli', kpi: 'Data tersedia ≥ 90% pada Agustus–Oktober',
          ev: `Data Agu–Okt hanya tersedia ${['SM2-01', 'MDN-01', 'BJB-01', 'PLB-01'].map(c => `${c} ${f(100 * G.st[c].avail, 0)}%`).join(', ')}.`, go: '#/strategi?sec=sensor' });
    }
    if (typeof prCalc === 'function') { const P = prCalc(), a = prScen('tepat', 'rata'), b = prScen('m30', 'rata'), o = P.jamRow('all', '2026-10'), g = P.jamRow('all', '2026-08'), j = P.jamRow('all', '2026-06');
      const none = SG_CL.filter(c => P.jamRow(c, '2026-10').ok === 0).length, hh = h => String(h).padStart(2, '0') + ':00';
      R.push(
        { aud: 'daerah', pulau: ['Sumatera', 'Kalimantan'], t: 'Perpanjang status siaga 2026 mengikuti hujan, bukan kalender', who: 'BPBD, DLH, dan Dinkes enam provinsi sabuk asap; RS kembaran', what: `Jangan cabut siaga, patroli, dan bantuan RS kembaran pada awal November seperti 2024–2025. Cabut hanya setelah rata-rata PM2.5 enam stasiun sabuk asap di bawah 55 µg/m³ tujuh hari berturut-turut. Siapkan stok obat, oksigen, dan tempat tidur untuk ${fi(a.add.resp)}–${fi(b.add.resp)} kasus pernapasan tambahan.`, where: 'KTB-01, PKU-01, JMB-01, BTM-01, STG-01, PKN-01 dan enam RS pasangannya', when: `Sekarang sampai sekitar ${sgD(a.end)}–${sgD(b.end)} 2026`, kpi: 'Status dicabut berdasarkan data, bukan tanggal; tidak ada lonjakan kedua setelah pencabutan',
          ev: `Musim 2026 terparah dalam tiga tahun dan masih naik saat data berhenti (${f(P.beltPm[P.i14], 0)} µg/m³ pada 14 Okt). BMKG memperkirakan musim hujan mundur 20–30 hari akibat El Niño.`, go: '#/proyeksi?sec=proyeksi' },
        { aud: 'kesehatan', pulau: ['Sumatera', 'Kalimantan'], t: 'Saat musim asap, ganti "jam aman" dengan "ruang aman"', who: 'Dinas Pendidikan, Dinkes, sekolah, PAUD, dan Puskesmas', what: `Di luar musim asap, pindahkan olahraga dan upacara dari pagi ke pukul ${hh(j.hLo - 1)}–${hh(j.hLo + 2)}, saat PM2.5 terendah. Selama musim asap, saat tidak ada jam di bawah 55 µg/m³, sediakan kelas dan ruang tunggu tertutup dengan penyaring udara untuk balita dan lansia.`, where: 'Enam kota sabuk asap', when: 'Sepanjang tahun; ruang aman Agustus–November', kpi: 'Kunjungan ISPA balita pada hari ISPU tidak sehat turun',
          ev: `Di luar musim, pagi hari paling kotor (puncak pukul ${hh(j.hHi)}). Selama musim asap menggeser jam hanya mengurangi paparan sekitar ${f(100 * g.cut, 0)}% (Agu 2026), dan pada Okt 2026 ${none} dari 6 kota tidak punya satu jam pun antara 06:00–18:00 di bawah 55 µg/m³ (rata-rata enam kota ${f(o.lo, 0)}–${f(o.hi, 0)}).`, go: '#/proyeksi?sec=jamaman' });
    }
    if (typeof ljAmbang === 'function') { const A = ljAmbang(), K = ljKalender(), RR = ljRS(), e0 = K.rows.filter(r => r.shift != null).sort((a, b) => a.shift - b.shift)[0];
      R.push(
        { aud: 'kesehatan', pulau: PULAU, t: 'Mulai peringatan kelompok rentan di 35 µg/m³, bukan 55', who: 'Dinas Kesehatan, Dinas Pendidikan, sekolah, PAUD, dan RS rujukan', what: 'Imbau balita, lansia, dan penderita asma/PPOK untuk membatasi aktivitas luar ruang, dan minta sekolah memberi tahu orang tua saat PM2.5 harian > 35 µg/m³.', where: 'Semua kota berstasiun', when: 'Hari yang sama (kasus naik tanpa jeda)', kpi: 'Kunjungan ISPA balita pada hari 35–55 µg/m³ turun',
          ev: `Pada hari 35–55 µg/m³ (masih lolos baku harian) kasus pernapasan RS sudah <b>${fp(100 * (A.r.resp[2] - 1))}</b> di atas hari biasa, tercatat ${fi(A.nDay[2])} hari-stasiun.`, go: '#/ambang' },
        { aud: 'kesehatan', pulau: ['Kalimantan', 'Sumatera'], t: 'Tambah tempat tidur darurat pernapasan di RS sabuk asap sebelum musim', who: 'Dinkes Kalteng, Kalbar, Sumsel dan RS rujukan', what: 'Siapkan tempat tidur darurat, oksigen, dan tenaga pernapasan; utamakan RS yang pada 2026 menerima pasien melebihi kapasitas.', where: RR.rs.filter(r => r.over > 0).sort((a, b) => b.over - a.over).slice(0, 4).map(r => r.nama).join(', ') || 'RS sabuk asap', when: 'Sebelum awal musim (lihat Kalender siaga)', kpi: 'Tidak ada hari dengan pasien baru melebihi kapasitas',
          ev: `<b>${fi(RR.tot)}</b> kematian di atas normal di RS rujukan selama 1 Agu–14 Okt 2026, ${f(100 * sum(RR.rs.filter(r => /^KTG/.test(r.c)).map(r => r.ex)) / RR.tot, 0)}% di dua RS Kalteng.`, go: '#/rs' });
      if (e0 && e0.shift < -14) R[0].ev += ` Di ${esc(stShort(e0.c))} awal musim maju ${-e0.shift} hari sejak 2024.`;
    }
    const REC_EV = [[/^Status siaga/, 'season', 'Stasiun gambut melonjak pada Agustus–Oktober. Lonjakan itu yang menjadi dasar siaga otomatis di bulan tersebut.'],
      [/^Siapkan kapasitas RS/, 'case', 'Kasus RS rujukan naik bersamaan dengan lonjakan PM2.5 saat musim asap 2026, jadi kapasitas perlu siap sebelum puncak.'],
      [/^Peringatan dini/, 'lag', 'Kasus naik pada hari polusi tinggi itu sendiri dan tidak menyusul sesudahnya, jadi peringatan harus keluar pada hari itu juga.'],
      [/^Kendalikan sumber emisi/, 'ps', 'JKT-02 melewati baku harian hampir setiap hari sepanjang tahun, tanda sumber lokal yang menetap dan bukan musiman.'],
      [/^Perbaiki atau ganti stasiun/, 'net', 'Peta ini menunjukkan provinsi tanpa stasiun serta stasiun yang rusak atau hanya sebagian datanya.'],
      [/^Pasang QC/, 'pq', 'Bulan yang pucat adalah bulan ketika data macet dibuang. BJB-01 macet Sep 2024–Jun 2025 padahal tercatat VALID.'],
      [/^Manfaatkan titik kembar/, 'net', 'Peta ini menunjukkan provinsi yang masih kosong. KTG-01 dan KTG-02 angkanya hampir identik, jadi salah satunya bisa dipindah ke sana.'],
      [/^Mulai peringatan kelompok rentan/, 'amb', 'Batang pita 35–55 µg/m³ sudah di atas garis 1,0: kasus RS naik sebelum baku harian 55 terlampaui.'],
      [/^Tambah tempat tidur darurat/, 'rsd', 'Garis pasien baru melewati garis kapasitas tempat tidur pada beberapa hari saat puncak asap 2026.']];
    window.REC_EVS = Object.fromEntries(R.map((r, i) => { const m = REC_EV.find(x => x[0].test(r.t)); return [i + 1, m ? { card: m[1], why: m[2] } : null]; }));
    const AUD = [['semua', 'Semua'], ['daerah', 'Pemda & DLH'], ['kesehatan', 'Dinkes & RS'], ['jaringan', 'Pengelola jaringan']];
    this._aud = this._aud || 'semua';
    const cnt = k => k === 'semua' ? R.length : R.filter(r => r.aud === k).length, audL = k => AUD.find(x => x[0] === k)[1];
    const vis = R.map((r, i) => ({ ...r, n: i + 1 })).filter(r => (this._aud === 'semua' || r.aud === this._aud) && (!S.pulau.length || r.pulau.some(p => S.pulau.includes(p))));
    const wil = r => r.pulau.length < 5 ? r.pulau.join(', ') : 'Semua pulau';
    return ph({ k: 'Tindak lanjut', h: 'Apa yang harus dilakukan?', lede: `${R.length} tindakan dari temuan T1–T5 dan analisis lanjutan, diurutkan menurut dampaknya dan masing-masing memuat bukti angka serta tautan ke grafik asalnya.`,
      right: seg('aud', AUD.map(([k, l]) => [k, `${l} <i class="cnt">${cnt(k)}</i>`]), this._aud) }) +
      (vis.length ? `<div class="rlist">${vis.map(r => `<details class="rl" id="rec${r.n}" style="scroll-margin-top:96px"><summary><span class="rec-n">${r.n}</span><span class="rl-tx"><span class="rl-t">${r.t}</span><span class="rl-s">${wil(r)}</span></span><span class="pill au au-${r.aud}">${audL(r.aud)}</span></summary>
        <div class="rl-b"><div class="rl-m"><p class="rec-what">${r.what}</p><div class="ev"><b>Bukti:</b> ${r.ev}</div><div class="acts"><a class="btn" href="${r.go}" onclick="window.REC_FROM={n:${r.n},p:'${r.go.slice(2).split('?')[0]}',h:hashOf('rekomendasi')};window.SCROLL_TO=(window.REC_EVS[${r.n}]||{}).card?'card-'+window.REC_EVS[${r.n}].card:null">Lihat bukti ${IC.arrow}</a></div></div>
        <dl><dt>Siapa</dt><dd>${r.who}</dd><dt>Kapan</dt><dd>${r.when}</dd><dt>Di mana</dt><dd>${r.where}</dd><dt>Ukuran berhasil</dt><dd>${r.kpi}</dd></dl></div></details>`).join('')}</div>` : '<div class="empty">Tidak ada rekomendasi untuk kombinasi filter ini.</div>') +
      (PAGES.papan ? `<div class="pp-link"><span><b>Ingin membandingkan dua wilayah?</b> Pilih dua stasiun, lihat udara dan kasus RS-nya berdampingan dalam grafik, lalu unduh datanya.</span><a class="btn" href="${hashOf('papan')}">Perbandingan wilayah ${IC.arrow}</a></div>` : '');
  },
  mount(C) {
    bindSeg(C, 'aud', v => { this._aud = v; render(false); });
    const m = /^rec(\d+)$/.exec(window.SCROLL_TO || ''); if (m) { const d = C.querySelector('#rec' + m[1]); if (d) d.open = true; }
    C.querySelectorAll('.rl .acts a').forEach(x => x.addEventListener('click', e => e.stopPropagation()));
  },
};

/* ================= PROFIL STASIUN ================= */
PAGES.stasiun = {
  title: 'Profil stasiun', nav: 'Profil stasiun', group: 'Data',
  html() {
    const s = BY[S.st], t = sstat(s.code), i = ST.indexOf(s);
    const prev = ST[(i + ST.length - 1) % ST.length].code, next = ST[(i + 1) % ST.length].code;
    const eps = D.episodes.filter(e => e.code === s.code), all = sstat(s.code, [0, ND - 1]);
    const peers = ST.filter(x => x.pulau === s.pulau && x.use !== 'rusak');
    const useCol = s.use === 'andal' ? 'ok' : s.use === 'parsial' ? 'warn' : 'bad';
    const hmIns = (() => {
      const hs = Array.from({ length: 24 }, () => []), ms = Array.from({ length: 12 }, () => []);
      for (let m = S.from; m <= S.to; m++) { const mo = +MONTHS[m].slice(5) - 1; ((D.hm[s.code] || [])[m] || []).forEach((v, h) => { if (v == null) return; hs[h].push(v); ms[mo].push(v); }); }
      const hp = hs.map(x => x.length ? mean(x) : null), mp = ms.map(x => x.length ? mean(x) : null);
      const hv = hp.filter(v => v != null), mv = mp.filter(v => v != null); if (hv.length < 12 || !mv.length) return '';
      const hMax = Math.max(...hv), hMin = Math.min(...hv), mMax = Math.max(...mv), mMin = Math.min(...mv), avg = mean(hv);
      const pk = hp.indexOf(hMax), pm = mp.indexOf(mMax), ah = (hMax - hMin) / avg, am = (mMax - mMin) / avg;
      const kind = Math.max(ah, am) < 0.2 ? 'Hampir datar sepanjang jam dan bulan.' : ah >= am ? 'Pola jam lebih kuat daripada pola musim, khas lalu lintas dan aktivitas harian.' : 'Pola musim lebih kuat daripada pola jam, khas asap musiman.';
      return `Puncak harian pukul <b>${String(pk).padStart(2, '0')}:00</b> (${f(hMax, 0)} µg/m³)${mv.length > 1 ? `, bulan tertinggi <b>${BULAN_L[pm]}</b> (${f(mMax, 0)} µg/m³)` : ''}. ${kind}`;
    })();
    this._d = { s, peers, eps };
    const head = `<div class="ph"><div class="ph-txt"><div class="kicker">Profil stasiun · ${s.pulau}</div><h1>${s.code} ${esc(s.nama)}</h1>
      <p class="lede">${esc(s.kec)}, ${esc(s.kota)}, ${esc(s.prov)}. ${esc(s.wilayah)}. ${t.n ? `Pada filter ini rata-rata PM2.5 <b>${f(t.mean)} µg/m³</b> ${ispuBadge(t.mean)}, <b>${f(t.pct)}%</b> hari di atas baku.` : '<b>Tidak ada hari sah pada periode ini.</b>'} ${s.reason ? esc(s.reason) : ''}</p>
      <div class="meta-chips"><span class="pill ${useCol}">Data ${s.use}</span><span class="pill">${esc(s.tipe)}</span><span class="pill">Alat: ${esc(s.model)}</span><span class="pill">Status alat: ${esc(s.status)}</span><span class="pill">Satuan asli: ${esc(s.unit)}</span><span class="pill">${fi(s.road)} m dari jalan · ${fi(s.traffic)} kendaraan/jam</span><span class="pill">RS: ${esc(s.rs_nama)} (${esc(s.rs_kelas)}, ${s.rs_tt ? fi(s.rs_tt) + ' TT' : 'TT ?'})</span></div></div>
      <div class="ctrl">${backBtn()}<a class="btn" href="${hashOf('stasiun', { st: prev })}" aria-label="Stasiun sebelumnya">← ${prev}</a>${stSelect('pSt', s.code, ST)}<a class="btn" href="${hashOf('stasiun', { st: next })}" aria-label="Stasiun berikutnya">${next} →</a></div></div>`;
    if (s.use === 'rusak') {
      return head + `<div class="grid">${card({ id: 'pq', span: 's12', h: 'h220', title: 'Seberapa lengkap data tiap bulan? (% jam)', sub: 'Stasiun ini tidak dipakai untuk perhitungan T1–T4, tetapi menjadi bukti celah pemantauan di T5.' })}
        ${card({ id: 'pf', span: 's12', title: 'Masalah alat apa yang tersering?', body: `<div class="tbl-wrap" style="max-height:none">${tableHTML({ cols: [{ k: 'f', l: 'qc_flag' }, { k: 'n', l: 'Baris', num: 1, fmt: fi }, { k: 'p', l: '%', num: 1, fmt: v => f(v) }], rows: Object.entries(s.q.flags).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ f: k, n: v, p: 100 * v / s.q.rows })) })}</div>` })}</div>`;
    }
    return head + `<div class="kpis">${[
      kpi({ l: 'Rata-rata PM2.5', ic: 'air', v: f(t.mean), u: 'µg/m³', c: `seluruh periode ${f(all.mean)} µg/m³`, color: ispuCol(t.mean) }),
      kpi({ l: 'Hari > 55 µg/m³', ic: 'cal', v: f(t.pct), u: '%', c: `${fi(t.ex)} dari ${fi(t.n)} hari sah`, color: cv('--ispu-3') }),
      kpi({ l: 'Hari terburuk', ic: 'warn', v: f(t.max), u: 'µg/m³', c: t.maxDay >= 0 ? `<span class="kc-row"><span>${fd(t.maxDay)}</span>${ispuBadge(t.max)}</span>` : '', color: cv('--ispu-4') }),
      kpi({ l: 'Episode kabut asap', ic: 'fire', v: fi(eps.length), c: eps.length ? `terpanjang ${Math.max(...eps.map(e => e.days))} hari` : 'tidak pernah', color: cv('--k-gambut') }),
      kpi({ l: 'Kelengkapan data', ic: 'db', v: f(100 * s.q.days_ok / ND, 0), u: '%', c: `${fi(s.q.days_ok)} hari sah · ${fi(s.q.stuck)} jam macet dibuang`, color: cv(s.use === 'andal' ? '--ok' : '--warn'), go: '#/metodologi' }),
    ].join('')}</div>
    <div class="grid">
      ${card({ id: 'ps', span: 's12', h: 'h380', title: 'Kapan PM2.5 tinggi di stasiun ini?', sub: 'Garis = PM2.5 harian. Pita merah = episode kabut asap, garis titik hitam = baku 24 jam 55 µg/m³.',
        info: { rumus: 'Rata-rata 24 jam (hari ≥18 jam valid).', data: `${s.code} AQMS`, filter: false } })}
      ${card({ id: 'phm', span: 's6', h: 'h380', title: 'Kapan PM2.5 memuncak di stasiun ini?', sub: 'Tiap kotak = rata-rata PM2.5 pada satu jam dan satu bulan, dalam periode filter.', note: hmIns || undefined })}
      ${card({ id: 'ppeer', span: 's6', h: 'h380', title: `Lebih buruk dari stasiun lain di ${s.pulau}?`, sub: 'Batang = rata-rata PM2.5 tiap stasiun pada periode filter. Stasiun ini disorot.' })}
      ${card({ id: 'prs', span: 's12', h: 'h440', title: `Apakah kasus RS ikut naik saat PM2.5 naik?`, sub: 'Rata-rata bulanan. Atas: PM2.5. Bawah: kasus per hari (ISPA balita, ISPA lansia, kematian).',
        legend: `<span><i class="line" style="background:var(--k-gambut)"></i>ISPA balita</span><span><i class="line" style="background:var(--k-industri)"></i>ISPA lansia</span><span><i class="line" style="background:var(--ispu-4)"></i>Kematian</span>` })}
      ${card({ id: 'pq', span: 's12', h: 'h220', title: 'Seberapa lengkap data tiap bulan? (% jam)', sub: 'Tiap kotak = satu bulan. Warna pucat = banyak data dibuang (flag tidak valid, sensor macet, atau tidak terkirim).' })}
    </div>`;
  },
  mount(C) {
    const d = this._d, s = d.s;
    const ps = C.querySelector('#pSt'); if (ps) ps.onchange = e => go('stasiun', { st: e.target.value });
    const q = D.comp[s.code];
    mk('pq', { grid: { left: 8, right: 12, top: 14, bottom: 8, containLabel: true }, tooltip: { formatter: p => `${fm(p.dataIndex)}: <b>${fi(p.value)}%</b> jam lolos` },
      xAxis: ax({ type: 'category', data: MONTHS.map((_, m) => fmShort(m)), axisLabel: { color: cv('--muted'), fontSize: 10.5, interval: 2 } }), yAxis: ax({ type: 'value', max: 100, axisLabel: { formatter: '{value}%', color: cv('--muted'), fontSize: 10.5 } }),
      series: [{ type: 'bar', barWidth: '70%', data: q.map(v => ({ value: v, itemStyle: { color: v >= 90 ? cv('--ok') : v >= 50 ? cv('--warn') : cv('--bad'), borderRadius: [3, 3, 0, 0] } })) }] });
    if (s.use === 'rusak') return;
    const [d0, d1] = range(), a = D.pm25[s.code];
    const xs = [], ys = []; for (let i = d0; i <= d1; i++) { xs.push(dayDate(i).getTime()); ys.push([dayDate(i).getTime(), a[i]]); }
    const ma = d.eps.filter(e => dayIdx(e.end) >= d0 && dayIdx(e.start) <= d1).map(e => [{ xAxis: dayDate(dayIdx(e.start)).getTime(), name: e.days + ' hari' }, { xAxis: dayDate(dayIdx(e.end)).getTime() + 864e5 }]);
    mk('ps', { grid: { left: 8, right: 16, top: 24, bottom: 52, containLabel: true }, tooltip: { trigger: 'axis', formatter: p => `${fd(Math.round((p[0].value[0] - DAY0) / 864e5))}<br>PM2.5 <b>${p[0].value[1] == null ? 'tidak ada data' : f(p[0].value[1]) + ' µg/m³'}</b>` },
      dataZoom: [{ type: 'inside', zoomOnMouseWheel: 'ctrl', moveOnMouseWheel: false }, { type: 'slider', height: 22, bottom: 6, borderColor: cv('--line'), fillerColor: 'rgba(120,130,140,.15)', dataBackground: { lineStyle: { color: cv('--muted') }, areaStyle: { color: cv('--surface-3') } }, textStyle: { color: cv('--muted') } }],
      xAxis: ax({ type: 'time', axisLabel: { color: cv('--muted'), fontSize: 11, formatter: v => { const x = new Date(v); return BULAN[x.getMonth()] + " '" + String(x.getFullYear()).slice(2); } } }),
      yAxis: ax({ type: 'value', name: 'µg/m³', nameGap: 8 }),
      series: [{ type: 'line', data: ys, symbol: 'none', connectNulls: false, lineStyle: { width: 1.4, color: cv('--brand') }, areaStyle: { color: cv('--brand'), opacity: .08 }, markLine: mlBaku(),
        markArea: ma.length ? { silent: true, itemStyle: { color: cv('--ispu-4'), opacity: .1 }, label: { color: cv('--ispu-4'), fontSize: 10.5, position: 'insideTop' }, data: ma } : undefined }] });
    const cells = [], acc = {}; for (let m = S.from; m <= S.to; m++) { const mo = +MONTHS[m].slice(5) - 1; D.hm[s.code][m].forEach((v, h) => { if (v == null) return; (acc[mo + '_' + h] = acc[mo + '_' + h] || []).push(v); }); }
    let vmin = Infinity, vmax = -Infinity; for (const k in acc) { const [mo, h] = k.split('_').map(Number), v = mean(acc[k]); cells.push([h, mo, Math.round(v * 10) / 10]); vmin = Math.min(vmin, v); vmax = Math.max(vmax, v); }
    mk('phm', { grid: { left: 8, right: 12, top: 8, bottom: 48, containLabel: true }, tooltip: { formatter: p => `${BULAN_L[p.data[1]]}, ${String(p.data[0]).padStart(2, '0')}:00: <b>${f(p.data[2])}</b> µg/m³` },
      xAxis: ax({ type: 'category', data: Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')), splitLine: { show: false } }), yAxis: ax({ type: 'category', data: BULAN, inverse: true, splitLine: { show: false } }),
      visualMap: { min: vmin, max: vmax, orient: 'horizontal', left: 'center', bottom: 0, itemHeight: 140, itemWidth: 10, text: [f(vmax, 0), f(vmin, 0)], textStyle: { color: cv('--muted'), fontSize: 11 }, inRange: { color: ['--seq-0', '--seq-1', '--seq-2', '--seq-3', '--seq-4', '--seq-5'].map(cv) } },
      series: [{ type: 'heatmap', data: cells, itemStyle: { borderColor: cv('--surface'), borderWidth: 1 } }] });
    const pr = d.peers.map(x => ({ code: x.code, m: sstat(x.code).mean })).filter(x => x.m != null).sort((a, b) => a.m - b.m);
    mk('ppeer', { grid: { left: 8, right: 44, top: 8, bottom: 20, containLabel: true }, tooltip: { formatter: p => `<b>${pr[p.dataIndex].code}</b> ${esc(BY[pr[p.dataIndex].code].kota)}: ${f(p.value)} µg/m³` },
      xAxis: ax({ type: 'value', name: 'µg/m³', nameGap: 4 }), yAxis: ax({ type: 'category', data: pr.map(x => x.code), axisLabel: { color: cv('--ink-2'), fontSize: 11 } }),
      series: [{ type: 'bar', barWidth: '60%', data: pr.map(x => ({ value: x.m, itemStyle: { color: x.code === s.code ? cv('--brand') : cv('--line-2'), borderRadius: [0, 4, 4, 0] } })), label: { show: true, position: 'right', formatter: p => f(p.value), fontSize: 10.5, color: cv('--ink-2') } }] },
      p => go('stasiun', { st: pr[p.dataIndex].code }));
    const H = D.health[s.rs], mx = [], pmM = [], ser = { u5: [], o60: [], death: [] };
    for (let m = S.from; m <= S.to; m++) { mx.push(fmShort(m)); pmM.push(D.mon[s.code].n[m] ? D.mon[s.code].pm25[m] : null); for (const k in ser) { const v = []; for (let i = monStart(m); i <= monEnd(m); i++) v.push(H[k][i]); ser[k].push(mean(v)); } }
    mk('prs', { axisPointer: { link: [{ xAxisIndex: 'all' }] }, tooltip: { trigger: 'axis', valueFormatter: v => f(v) },
      ...twoPanel('prs', 'PM2.5 bulanan (µg/m³)', 'Tinggi batang = rata-rata PM2.5 bulan itu. Warna = kategori ISPU (hijau baik, biru sedang, kuning tidak sehat, makin gelap makin buruk).',
        'Kasus per hari di RS rujukan', 'Rata-rata kasus harian tiap bulan: ISPA balita, ISPA lansia, dan kematian.'),
      xAxis: [ax({ type: 'category', data: mx, gridIndex: 0, axisLabel: { show: false } }), ax({ type: 'category', data: mx, gridIndex: 1 })],
      yAxis: [ax({ type: 'value', gridIndex: 0, splitNumber: 3 }), ax({ type: 'value', gridIndex: 1, splitNumber: 3 })],
      series: [{ name: 'PM2.5', type: 'bar', data: pmM.map(v => ({ value: v, itemStyle: { color: v == null ? cv('--line') : ispuCol(v), borderRadius: [3, 3, 0, 0] } })), barWidth: '62%' },
        ...[['u5', '--k-gambut'], ['o60', '--k-industri'], ['death', '--ispu-4']].map(([k, v]) => ({ name: OUTC[k].l, type: 'line', xAxisIndex: 1, yAxisIndex: 1, data: ser[k], symbol: 'none', lineStyle: { width: 2, color: cv(v) }, itemStyle: { color: cv(v) } }))] });
  },
};

/* ================= METODOLOGI ================= */
PAGES.metodologi = {
  title: 'Metodologi & kualitas data', nav: 'Metodologi', group: 'Data',
  html() {
    const m = D.meta, tot = m.rows_total;
    const pipe = [[fi(tot), 'baris per jam dari 27 file AQMS', '33 file dibaca seluruhnya'], [fi(m.valid_flag), `qc_flag = VALID (${f(100 * m.valid_flag / tot)}%)`, '12 jenis flag; hanya VALID dipakai'],
      ['3 stasiun', 'satuan ppm dikonversi', 'PM ×1000; gas ppm×BM×1000/24,45'], [fi(m.stuck), 'jam sensor macet dibuang', 'nilai identik ≥ 6 jam (BJB-01)'],
      [fi(m.clean_hours), 'jam bersih', 'dibulatkan ke jam, duplikat dirata-rata'], ['25 + 2', 'stasiun dianalisis + dipakai di T5', 'hari sah = ≥ 18 jam valid']];
    const rows = ST.map(s => ({ _st: s.code, code: s.code, kota: s.kota, unit: s.unit, status: s.status, rows: s.q.rows, vf: 100 * s.q.valid_flag / s.q.rows, stuck: s.q.stuck, out: s.q.ts_out + s.q.pm_invalid, clean: s.q.clean_pct, days: s.q.days_ok, use: s.use }));
    const cols = [{ k: 'code', l: 'Kode' }, { k: 'kota', l: 'Lokasi' }, { k: 'unit', l: 'Satuan asli' }, { k: 'status', l: 'Status alat' }, { k: 'rows', l: 'Baris', num: 1, fmt: fi }, { k: 'vf', l: '% VALID', num: 1, fmt: v => f(v) }, { k: 'out', l: 'Nilai/waktu mustahil', num: 1, fmt: fi }, { k: 'stuck', l: 'Jam macet', num: 1, fmt: fi }, { k: 'clean', l: '% jam bersih', num: 1, fmt: v => f(v) }, { k: 'days', l: 'Hari sah', num: 1, fmt: fi },
      { k: 'use', l: 'Dipakai sebagai', fmt: v => `<span class="pill ${v === 'andal' ? 'ok' : v === 'parsial' ? 'warn' : 'bad'}">${v}</span>` }];
    this._t = { cols, rows };
    return ph({ k: 'Data', h: 'Seberapa bisa dipercaya?', lede: `Semua angka dihitung ulang dari 33 file panitia tanpa data tambahan, dan <b>${f(100 * m.clean_hours / tot)}%</b> dari ${fi(tot)} baris per jam lolos pembersihan.` }) +
      `<div class="grid">
      ${card({ id: 'pipe', span: 's12', title: 'Bagaimana data dibersihkan sebelum dianalisis?', body: `<div class="pipe" style="margin-top:10px">${pipe.map(([b, s, e]) => `<div><b>${b}</b><span>${s}</span><em>${e}</em></div>`).join('')}</div>` })}
      ${card({ id: 'avail', span: 's12', h: 'h520', title: 'Stasiun dan bulan mana yang datanya bolong?', sub: 'Tiap kotak = persen jam yang lolos pembersihan pada satu stasiun dan bulan. Pola gelap-terang memperlihatkan kapan alat bermasalah: BJB-01 (macet Sep 2024–Jun 2025), MDN-01, PLB-01, SM2-01, MER-01, JMB-02.',
        info: { rumus: 'Jam lolos pembersihan ÷ jam dalam bulan.', data: '27 file AQMS', filter: false } })}
      ${card({ id: 'qtab', span: 's12', title: 'Seberapa bersih data tiap stasiun?', sub: 'Unduh CSV untuk lampiran laporan.', body: `<div class="tbl-wrap">${tableHTML(this._t, true)}</div>`, table: () => this._t })}
      ${card({ id: 'flags', span: 's6', h: 'h520', title: 'Stasiun mana alatnya paling bermasalah?', sub: 'Metadata menyebut 4 jenis flag, data berisi 12. Semua selain VALID dibuang.',
        legend: '<span><i style="background:var(--ok)"></i>VALID</span><span><i style="background:var(--warn)"></i>SUSPECT</span><span><i style="background:var(--k-bersih)"></i>Kalibrasi/perawatan/pemanasan</span><span><i style="background:var(--bad)"></i>Rusak/hilang/korup</span>' })}
      ${card({ id: 'defs', span: 's6', title: 'Istilah dan asumsi apa yang dipakai?', body: `<dl class="deflist">
        <dt>PM2.5</dt><dd>Partikel halus berdiameter ≤ 2,5 mikron yang dapat masuk sampai paru-paru dan aliran darah. Satuan µg/m³ = mikrogram per meter kubik udara.</dd>
        <dt>Sumber data</dt><dd>27 stasiun AQMS dan 27 rumah sakit rujukan, Januari 2024 sampai 14 Oktober 2026 (data sintetis dari panitia).</dd>
        <dt>Hari sah</dt><dd>Rata-rata 24 jam dihitung bila ada ≥ 18 jam valid (75%).</dd>
        <dt>Baku mutu</dt><dd>PP 22/2021 Lampiran VII: PM2.5 24 jam 55 µg/m³, tahunan 15; PM10 75; NO₂ 65; SO₂ 75; CO 8 jam 4.000; O₃ 8 jam 100.</dd>
        <dt>ISPU</dt><dd>Permen LHK 14/2020, PM2.5: Baik ≤ 15,5; Sedang ≤ 55,4; Tidak sehat ≤ 150,4; Sangat tidak sehat ≤ 250,4; Berbahaya > 250,4.</dd>
        <dt>Konversi ppm</dt><dd>Partikel bukan gas, sehingga "ppm" diasumsikan mg/m³ (×1000). Hasilnya cocok dengan baseline_pm25 (BJB 36 vs 35; MDN 46 vs 42,8; PSW 51 vs 54,3). Gas: µg/m³ = ppm × BM × 1000 / 24,45 (25 °C, 1 atm).</dd>
        <dt>Aturan buang</dt><dd>qc_flag ≠ VALID; waktu di luar 31 Des 2023–14 Okt 2026; PM2.5 &lt; 0, ≥ 999, atau ±inf; PM2.5 &gt; PM10 × 1,05; nilai identik ≥ 6 jam; RH &gt; 100 atau arah angin di luar 0–360 (hanya variabel cuacanya).</dd>
        <dt>Episode</dt><dd>≥ 3 hari berturut-turut PM2.5 harian &gt; 150,4 µg/m³.</dd>
        <dt>Pasangan RS</dt><dd>RS-XXX-nn ↔ stasiun nomor nn (Booklet hlm. 4–7).</dd>
        <dt>Model kesehatan</dt><dd>Poisson; kasus ~ PM2.5 lag 0–7 (per 10 µg/m³) + efek tetap RS × bulan-tahun + hari + suhu. n = ${fi(D.model.n)} hari-RS.</dd>
        <dt>Pulau</dt><dd>BTM-01 (Kepulauan Riau) digabung ke Sumatera. 11 label site_type diringkas menjadi 5 tipe lokasi.</dd></dl>` })}
      ${card({ id: 'lim', span: 's6', title: 'Apa keterbatasan analisis ini?', body: `<ul class="lim">
        <li><b>Data sintetis.</b> Pola tahunan berulang (korelasi harian 2024 vs 2025 = 0,92–0,99 di 20 stasiun). Tren harus dibaca hati-hati.</li>
        <li><b>KTG-01 dan KTG-02 identik</b> pada rata-rata harian meski berjarak 112 km. Dianalisis, tetapi dihitung sebagai satu sinyal di T5.</li>
        <li><b>Meteorologi seperti acak</b> di 15 stasiun (kelembapan bilangan bulat 60–93%, sebaran rata). Hubungan cuaca–polusi tidak bisa disimpulkan kuat.</li>
        <li><b>Tidak ada efek akhir pekan</b> dan pola jam tepi jalan berbentuk tangga: tanda pembangkitan data, bukan perilaku lalu lintas nyata.</li>
        <li><b>Model kesehatan = asosiasi</b>, bukan sebab-akibat. Tidak ada data populasi, sehingga beban RS dinormalisasi dengan jumlah tempat tidur.</li>
        <li>92 baris kesehatan memiliki resp &lt; ISPA balita + ISPA lansia. Dibiarkan, karena resp adalah rawat pernapasan umum (catatan revisi panitia).</li>
        <li>Koordinat JMB-02 hanya 0,8 km dari JMB-01 meski kecamatannya berbeda.</li>
        <li>Batas provinsi pada peta memakai GeoJSON luar (ardian28, lisensi MIT) hanya untuk gambar, sesuai penjelasan panitia di Padlet. Semua perhitungan, termasuk jarak antarstasiun, memakai koordinat sites.csv dan data panitia.</li></ul>` })}
      ${card({ id: 'cover', span: 's6', title: 'Data apa yang ada dan tidak ada?', body: `<dl class="deflist">
        <dt>Ada</dt><dd>Udara per jam di 27 stasiun (PM2.5, PM10, SO₂, NO₂, CO, O₃, cuaca), kesehatan harian di 27 RS (7 luaran), lokasi dan sensor, kapasitas tempat tidur, periode observasi.</dd>
        <dt>Tidak ada</dt><dd>Data penduduk dan luas wilayah (beban RS dinormalisasi dengan tempat tidur), titik panas atau sumber emisi (sebab asap tidak diuji), lalu lintas per jam (hanya intensitas rata-rata per stasiun), dan data udara dari 18 dari 38 provinsi (tanpa stasiun, atau hanya stasiun rusak).</dd>
        <dt>Dampaknya</dt><dd>Temuan berupa asosiasi dan pola, bukan sebab-akibat atau cakupan nasional.</dd></dl>` })}
      ${card({ id: 'srcs', span: 's6', title: 'Dari mana angka ini berasal?', body: `<ul class="lim">
        <li>Dataset: <em>Synthetic Metropolitan AQMS</em> (Dataset DA Gelar Rasa 2026): 27 file AQMS, HLT-01, sites, sensors, hospitals, metadata_dates, metadata_sensors.</li>
        <li>Skrip Python: <code>01_clean.py</code> (pembersihan), <code>02_answers.py</code> (T1–T5), <code>03_extra.py</code> (model jeda), <code>04_dash_data.py</code> (data dashboard), <code>05_robust.py</code> (uji kekokohan model kesehatan).</li>
        <li>Dashboard: HTML + Apache ECharts 5.5, statis tanpa server. Semua filter dihitung di peramban dari data harian.</li>
        <li>Acuan: PP 22/2021; Permen LHK 14/2020; Permen LHK 27/2021; WHO Global Air Quality Guidelines 2021.</li></ul>` })}
      ${typeof sgMethodHTML === 'function' ? card({ id: 'adv', span: 's12', title: 'Analisis lanjutan: strategi bersama (teori permainan)', sub: 'Definisi, rumus, dan batasan untuk halaman <a href="#/strategi">Strategi bersama</a>.', body: sgMethodHTML() }) : ''}
      ${typeof ppMethodHTML === 'function' ? card({ id: 'advpp', span: 's12', title: 'Perbandingan wilayah', sub: 'Definisi dan batasan untuk halaman <a href="#/papan">Perbandingan wilayah</a>.', body: ppMethodHTML() }) : ''}
      ${typeof prMethodHTML === 'function' ? card({ id: 'advpr', span: 's12', title: 'Analisis lanjutan: proyeksi sisa musim 2026 dan jam aman', sub: 'Definisi, rumus, rujukan, dan batasan untuk halaman <a href="#/proyeksi">Musim 2026 belum usai</a>.', body: prMethodHTML() }) : ''}
      </div>`;
  },
  mount() {
    const codes = ST.map(s => s.code);
    const cells = []; codes.forEach((c, i) => D.comp[c].forEach((v, m) => cells.push([m, i, v])));
    mk('avail', { grid: { left: 8, right: 12, top: 8, bottom: 52, containLabel: true }, tooltip: { formatter: p => { const t = BY[codes[p.data[1]]]; return `<b>${t.code}</b> · ${esc(t.kota)}<br><span style="opacity:.7">${esc(t.kec)}, ${esc(t.prov)} · ${esc(t.kel)}</span><br>${useTag(t)}<br>${fm(p.data[0])}: <b>${fi(p.data[2])}%</b> jam lolos`; } },
      xAxis: ax({ type: 'category', data: MONTHS.map((_, m) => fmShort(m)), splitLine: { show: false }, axisLabel: { color: cv('--muted'), fontSize: 10, interval: 2 } }),
      yAxis: ax({ type: 'category', data: codes, inverse: true, splitLine: { show: false }, axisLabel: { color: cv('--ink-2'), fontSize: 10.5, interval: 0 } }),
      visualMap: { min: 0, max: 100, orient: 'horizontal', left: 'center', bottom: 0, itemHeight: 140, itemWidth: 10, text: ['100%', '0%'], textStyle: { color: cv('--muted'), fontSize: 11 }, inRange: { color: [cv('--bad'), cv('--warn'), cv('--surface-3'), cv('--ok')] } },
      series: [{ type: 'heatmap', data: cells, itemStyle: { borderColor: cv('--surface'), borderWidth: 1 } }] }, p => go('stasiun', { st: codes[p.data[1]] }));
    const G = { VALID: ['VALID'], SUSPECT: ['SUSPECT'], Kalibrasi: ['CALIBRATING', 'MAINTENANCE', 'WARMUP'], Rusak: ['MISSING', 'FATAL_ERR', 'GARBAGE', 'CORRUPT', 'SENSOR_DEAD', 'COMM_LOST', 'PARSER_FAIL', 'NA'] };
    const GC = { VALID: '--ok', SUSPECT: '--warn', Kalibrasi: '--k-bersih', Rusak: '--bad' };
    const sorted = ST.slice().sort((a, b) => a.q.valid_flag / a.q.rows - b.q.valid_flag / b.q.rows).map(s => s.code).reverse();
    mk('flags', { grid: { left: 8, right: 12, top: 8, bottom: 20, containLabel: true },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: ps => { const t = BY[ps[0].name]; return `<b>${ps[0].name}</b> · ${esc(t.kota)}<br><span style="opacity:.7">${esc(t.kec)}, ${esc(t.prov)} · ${esc(t.kel)}</span><br>${useTag(t)}<br>` + ps.map(p => `${p.marker}${p.seriesName}: ${f(p.value)}%`).join('<br>'); } },
      xAxis: ax({ type: 'value', max: 100, axisLabel: { formatter: '{value}%', color: cv('--muted'), fontSize: 10.5 } }), yAxis: ax({ type: 'category', data: sorted, axisLabel: { color: cv('--ink-2'), fontSize: 10.5, interval: 0 } }),
      series: Object.entries(G).map(([g, ks]) => ({ name: g, type: 'bar', stack: 'f', barWidth: '66%', itemStyle: { color: cv(GC[g]), borderColor: cv('--surface'), borderWidth: .5 },
        data: sorted.map(c => { const q = BY[c].q; return 100 * sum(ks.map(k => q.flags[k] || 0)) / q.rows; }) })) }, p => go('stasiun', { st: sorted[p.dataIndex] }));
  },
};
