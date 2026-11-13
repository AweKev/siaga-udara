/* ================= PAPAN PERTIMBANGAN WILAYAH =================
   Alat banding antarstasiun: hanya fakta tercatat (hari, kasus, nilai tertinggi), tanpa skor gabungan atau prediksi.
   Dihitung saat runtime dari D.pm25 harian, D.health[RS] harian, dan D.stations. Filter global tidak berlaku. */
const PP_PER = {
  '2024': { l: '2024', r: () => [dayIdx('2024-01-01'), dayIdx('2024-12-31')] },
  '2025': { l: '2025', r: () => [dayIdx('2025-01-01'), dayIdx('2025-12-31')] },
  '2026': { l: '2026 (s.d. 14 Okt)', r: () => [dayIdx('2026-01-01'), ND - 1] },
  all: { l: 'Seluruh periode', r: () => [0, ND - 1] },
};
const PP_THR = [[55, '55', 'Baku mutu harian PM2.5 (PP 22/2021)'], [150.4, '150,4', 'Batas atas ISPU “Tidak sehat” (Permen LHK 14/2020)'], [250.4, '250,4', 'Batas atas ISPU “Sangat tidak sehat” (Permen LHK 14/2020)']];
const PP_OUT = [['resp', 'Pernapasan umum'], ['u5', 'ISPA balita'], ['o60', 'ISPA lansia']];
const PP_MIN = 10;   // batas "hari sedikit"
/* catatan yang perlu dicek manusia, dari halaman Metodologi dan Langkah 5 */
const PP_CHECK = {
  'KTG-01': ['Sinyal kembar dengan KTG-02; nilai menempel di ±420 lalu ±850'],
  'KTG-02': ['Sinyal kembar dengan KTG-01; nilai menempel di ±420 lalu ±850'],
  'PSW-01': ['Satuan asli ppm, dikonversi'],
  'MDN-01': ['Satuan asli ppm, dikonversi', 'Data parsial'],
  'BJB-01': ['Satuan asli ppm, dikonversi', 'Data parsial'],
  'PLB-01': ['Data parsial'],
  'SM2-01': ['Data parsial'],
};

/* kondisi normal per stasiun dan luaran: rata-rata kasus pada hari PM2.5 ≤ persentil-25 stasiun itu (seluruh periode), sama dengan strategi.js */
const PP_BASE = {};
function ppBase(s, o) {
  const k = s.code + '|' + o; if (k in PP_BASE) return PP_BASE[k];
  const pm = D.pm25[s.code], h = D.health[s.rs][o];
  const v = pm.filter(x => x != null).sort((a, b) => a - b), p25 = v[Math.floor(.25 * (v.length - 1))];
  const c = []; pm.forEach((x, i) => { if (x != null && x <= p25 && h[i] != null) c.push(h[i]); });
  return (PP_BASE[k] = { p25, base: mean(c), n: c.length });
}
function ppRows(per, thr, o) {
  const [a, b] = PP_PER[per].r(), nd = b - a + 1, rows = [];
  let never = 0;
  for (const s of ST) {
    if (s.use === 'rusak') continue;
    const pm = D.pm25[s.code], h = D.health[s.rs][o], B = ppBase(s, o);
    let n = 0, below = 0, ok = 0, ex = 0, mx = null, mxi = -1;
    for (let i = a; i <= b; i++) {
      if (h[i] != null && (mx == null || h[i] > mx)) { mx = h[i]; mxi = i; }
      if (pm[i] == null) continue;
      ok++;
      if (pm[i] >= thr) { n++; if (h[i] != null) ex += h[i] - B.base; } else below++;
    }
    if (!n) { never++; continue; }
    const noRef = below < PP_MIN || B.p25 >= thr;   // tidak ada hari pembanding di bawah ambang
    rows.push({ s, code: s.code, nama: s.kota, prov: s.prov, kel: s.kel, n, below, ex: noRef ? null : ex, noRef, base: B.base,
      kelas: s.rs_kelas, tt: s.rs_tt, mx, mxi, use: s.use, ok, okp: 100 * ok / nd, check: PP_CHECK[s.code] || [] });
  }
  return { rows, never, nUse: ST.filter(s => s.use !== 'rusak').length, nd };
}
function ppThrLabel(t) { const p = PP_THR.find(x => x[0] === t); return p ? p[2] : 'Ambang pilihan Anda'; }

/* ================= BANDINGKAN WILAYAH =================
   Dua wilayah (stasiun dan RS rujukannya) berdampingan: kualitas udara dan semua jenis kasus RS. Hanya fakta tercatat, tanpa skor atau prediksi.
   Dihitung saat runtime dari D.pm25 harian dan D.health[RS] harian. Filter global tidak berlaku. */
const CMP_OUT = [['u5', 'ISPA balita'], ['o60', 'ISPA lansia'], ['asma', 'Darurat asma'], ['ppok', 'PPOK'], ['resp', 'Pernapasan umum'], ['cvd', 'Kardiovaskular'], ['death', 'Kematian']];
function cmpStat(code, per) {
  const s = BY[code], [a, b] = PP_PER[per].r(), pm = D.pm25[code], H = D.health[s.rs] || {}, nd = b - a + 1;
  let n = 0, sm = 0, mx = null, d55 = 0, d150 = 0;
  for (let i = a; i <= b; i++) { const v = pm[i]; if (v == null) continue; n++; sm += v; if (mx == null || v > mx) mx = v; if (v >= 55) d55++; if (v >= 150.4) d150++; }
  const out = {};
  for (const [k] of CMP_OUT) { const arr = H[k]; let t = 0, m = 0; if (arr) for (let i = a; i <= b; i++) if (arr[i] != null) { t += arr[i]; m++; } out[k] = m ? t / m : null; }
  return { s, n, mean: n ? sm / n : null, mx, d55, d150, okp: 100 * n / nd, out };
}

/* rata-rata bulanan dalam rentang hari [a, b]; null bila bulan itu tanpa data */
function cmpMonthly(arr, a, b) {
  const labels = [], vals = [];
  MONTHS.forEach((m, k) => {
    const s0 = dayIdx(m + '-01'), s1 = (MONTHS[k + 1] ? dayIdx(MONTHS[k + 1] + '-01') : ND) - 1, i0 = Math.max(s0, a), i1 = Math.min(s1, b);
    if (i0 > i1) return;
    let t = 0, n = 0; for (let i = i0; i <= i1; i++) if (arr && arr[i] != null) { t += arr[i]; n++; }
    labels.push(BULAN[+m.slice(5) - 1] + ' ' + m.slice(2, 4)); vals.push(n ? t / n : null);
  });
  return { labels, vals };
}
/* kasus pada hari PM2.5 ≥ 55 dibanding hari bersih stasiun itu (kondisi normal); null bila hari pembanding kurang */
function cmpRatio(s, o, a, b) {
  const pm = D.pm25[s.code], h = (D.health[s.rs] || {})[o]; if (!h) return null;
  const B = ppBase(s, o); if (!(B.base > 0) || B.p25 >= 55) return null;
  let t = 0, n = 0; for (let i = a; i <= b; i++) if (pm[i] != null && pm[i] >= 55 && h[i] != null) { t += h[i]; n++; }
  return n >= 5 ? t / n / B.base : null;
}
/* porsi hari sah per kategori ISPU (%) */
function cmpIspu(code, a, b) {
  const pm = D.pm25[code], c = ISPU.map(() => 0); let n = 0;
  for (let i = a; i <= b; i++) if (pm[i] != null) { c[ispuOf(pm[i]).k - 1]++; n++; }
  return c.map(x => n ? 100 * x / n : 0);
}

PAGES.papan = {
  title: 'Perbandingan wilayah', nav: 'Perbandingan wilayah', group: 'Data', noFilters: true,
  html() {
    const list = ST.filter(s => s.use !== 'rusak');
    this._p = this._p || 'all'; this._o = this._o || 'resp';
    if (!this._a || !BY[this._a] || BY[this._a].use === 'rusak') this._a = BY['KTG-01'] ? 'KTG-01' : list[0].code;
    if (!this._b || !BY[this._b] || BY[this._b].use === 'rusak' || this._b === this._a) this._b = (BY['JKT-02'] && this._a !== 'JKT-02') ? 'JKT-02' : list.find(s => s.code !== this._a).code;
    const A = cmpStat(this._a, this._p), B = cmpStat(this._b, this._p), nm = x => `${x.s.code} ${esc(x.s.kota)}`;
    const [ra, rb] = PP_PER[this._p].r();
    const mA = cmpMonthly(D.pm25[A.s.code], ra, rb), mB = cmpMonthly(D.pm25[B.s.code], ra, rb);
    const kA = cmpMonthly((D.health[A.s.rs] || {})[this._o], ra, rb), kB = cmpMonthly((D.health[B.s.rs] || {})[this._o], ra, rb);
    const iA = cmpIspu(A.s.code, ra, rb), iB = cmpIspu(B.s.code, ra, rb);
    const xA = PP_OUT.map(([k]) => cmpRatio(A.s, k, ra, rb)), xB = PP_OUT.map(([k]) => cmpRatio(B.s, k, ra, rb));
    this._d = { A, B, mA, mB, kA, kB, iA, iB, xA, xB };
    const perSeg = seg('pp_p', Object.entries(PP_PER).map(([k, v]) => [k, v.l]), this._p);
    const ctrl = `<span class="ctrl"><span>Wilayah A</span>${stSelect('cmpA', this._a, list)}</span><span class="ctrl"><span>Wilayah B</span>${stSelect('cmpB', this._b, list)}</span>${perSeg}<button type="button" class="btn sm" id="cmpCsv">${IC.dl} Unduh CSV</button>`;
    const head = ph({ k: 'Data', h: 'Perbandingan wilayah', lede: 'Pilih dua wilayah (stasiun dan RS rujukannya) untuk membandingkan udara dan kasus RS-nya lewat grafik, dengan data yang bisa diunduh sebagai CSV.' });
    const lim = 'Hubungan yang tercatat pada data sintetis, bukan bukti sebab-akibat. Jumlah pasien ikut dipengaruhi ukuran RS dan jumlah penduduk, yang tidak ada di data.';
    const closeCard = `${card({ id: 'ppno', span: 's12', title: 'Apa yang tidak bisa dijawab data ini?', body: `<ul class="lim">
          <li>Sumber atau penyebab pencemaran dan kebakaran.</li>
          <li>Jumlah penduduk terdampak.</li>
          <li>Lama rawat dan keterisian RS.</li>
          <li>Biaya dan kapasitas intervensi.</li>
          <li>Kondisi di luar 27 titik pantau.</li></ul>
        <p class="pp-close">Hal-hal ini perlu pertimbangan dinas lingkungan, dinas kesehatan, dan pakar. Dashboard ini membantu memeriksa data, bukan menggantikan keputusan.</p>
        <p><span class="pill warn">Data sintetis: temuan berlaku untuk data ini, bukan klaim dunia nyata.</span></p>` })}`;
    const vs = (a, b) => { if (a == null || b == null) return '–'; if (a > 0 && b === 0) return 'hanya di wilayah A'; if (b > 0 && a === 0) return 'hanya di wilayah B'; if (!(a > 0) || !(b > 0)) return '–'; const r = a / b; return r > 1.1 ? `${f(r, 1)} kali lebih tinggi` : r < 0.9 ? `${f(1 / r, 1)} kali lebih rendah` : 'hampir sama'; };
    const who = (x, c, tag) => `<div class="cmp-w"><i style="background:${c}"></i><div><b>${tag}: ${nm(x)}</b><span>${esc(x.s.prov)} · ${esc(x.s.pulau)} · ${esc(x.s.kel)}</span><span>RS rujukan: ${esc(x.s.rs_nama)} (${esc(x.s.rs_kelas)}, ${fi(x.s.rs_tt)} TT)</span></div></div>`;
    const R = [
      ['Provinsi', A.s.prov, B.s.prov], ['Pulau', A.s.pulau, B.s.pulau], ['Tipe lokasi', A.s.kel, B.s.kel],
      ['RS rujukan', `${A.s.rs_nama} (${A.s.rs_kelas}, ${A.s.rs_tt} TT)`, `${B.s.rs_nama} (${B.s.rs_kelas}, ${B.s.rs_tt} TT)`],
      ['PM2.5 rata-rata (µg/m³)', A.mean, B.mean, 1], ['PM2.5 tertinggi sehari (µg/m³)', A.mx, B.mx, 1],
      ['Hari di atas baku harian 55', A.d55, B.d55, 1], ['Hari di atas 150,4 (Sangat tidak sehat)', A.d150, B.d150, 1], ['Kelengkapan data (% hari sah)', A.okp, B.okp],
      ...ISPU.map((c, i) => ['Porsi hari ' + c.l + ' (%)', iA[i], iB[i], 1]),
      ...PP_OUT.map(([k, l], i) => ['Kasus saat PM2.5 ≥ 55 dibanding hari bersih, ' + l + ' (×)', xA[i], xB[i], 1]),
      ...CMP_OUT.map(([k, l]) => ['Kasus RS per hari: ' + l, A.out[k], B.out[k], 1]),
    ];
    const rd = v => typeof v === 'number' ? Math.round(v * 100) / 100 : (v == null ? '' : v);
    const tbl = () => ({ cols: [{ k: 'm', l: 'Metrik' }, { k: 'a', l: A.s.code + ' ' + A.s.kota }, { k: 'b', l: B.s.code + ' ' + B.s.kota }, { k: 'd', l: 'A dibanding B' }],
      rows: R.map(r => ({ m: r[0], a: rd(r[1]), b: rd(r[2]), d: r[3] ? vs(r[1], r[2]) : '' })) });
    this._tbl = tbl;
    const pp = A.mean != null && B.mean != null && B.mean > 0 ? A.mean / B.mean : null;
    const peak = (m, c) => { let bi = -1; m.vals.forEach((v, i) => { if (v != null && (bi < 0 || v > m.vals[bi])) bi = i; }); return bi < 0 ? null : `${m.labels[bi]} (${f(m.vals[bi], 0)})`; };
    const worse = i => i.slice(2).reduce((x, y) => x + y, 0);
    const leadPm = pp == null ? null : `Rata-rata PM2.5 ${esc(A.s.kota)} <b>${f(A.mean)}</b> µg/m³ dan ${esc(B.s.kota)} <b>${f(B.mean)}</b> µg/m³, ${pp > 1.1 ? `jadi ${esc(A.s.kota)} sekitar ${f(pp, 1)} kali lebih tinggi` : pp < 0.9 ? `jadi ${esc(B.s.kota)} sekitar ${f(1 / pp, 1)} kali lebih tinggi` : 'hampir sama'}.`;
    const leadDy = `${esc(A.s.kota)} punya <b>${fi(A.d55)}</b> hari di atas baku 55, ${esc(B.s.kota)} <b>${fi(B.d55)}</b> hari. Kelengkapan data ${f(A.okp, 0)}% dan ${f(B.okp, 0)}%, jadi bandingkan dengan hati-hati bila berbeda jauh.`;
    const pa = peak(mA), pb = peak(mB);
    const leadMo = pa && pb ? `Bulan terburuk ${esc(A.s.kota)} <b>${pa}</b> µg/m³, ${esc(B.s.kota)} <b>${pb}</b> µg/m³.` : null;
    const leadIs = `Hari Tidak sehat atau lebih buruk: <b>${f(worse(iA), 0)}%</b> di ${esc(A.s.kota)} dan <b>${f(worse(iB), 0)}%</b> di ${esc(B.s.kota)}.`;
    const rx = (x, k) => x[k] == null ? null : f(x[k], 2);
    const leadRx = rx(xA, 0) && rx(xB, 0) ? `Saat PM2.5 ≥ 55, kasus pernapasan umum jadi <b>${rx(xA, 0)}×</b> hari bersih di ${esc(A.s.kota)} dan <b>${rx(xB, 0)}×</b> di ${esc(B.s.kota)}.` : 'Salah satu wilayah tidak punya cukup hari bersih atau hari di atas 55 sebagai pembanding.';
    const leadKs = A.out.resp != null && B.out.resp != null ? `Kasus pernapasan umum rata-rata <b>${f(A.out.resp)}</b> per hari di RS ${esc(A.s.kota)} dan <b>${f(B.out.resp)}</b> di RS ${esc(B.s.kota)}.` : null;
    const g = (id, span, title, sub, lead, tfn, extra = {}) => card(Object.assign({ id, span, h: 'h320', title, sub, lead, note: lead ? nt(lead, lim) : '', table: tfn, info: { rumus: 'PM2.5 dan jumlah hari dihitung dari hari sah stasiun. Kasus = rata-rata harian tiap jenis di RS yang dipasangkan dengan stasiun bernomor sama.', data: 'pm25 harian, HLT-01, sites.csv, hospitals.csv', filter: false } }, extra));
    const t2 = (cats, a, b) => () => ({ cols: [{ k: 'm', l: 'Metrik' }, { k: 'a', l: A.s.code }, { k: 'b', l: B.s.code }], rows: cats.map((c, i) => ({ m: c, a: rd(a[i]), b: rd(b[i]) })) });
    const tm = (m1, m2) => () => ({ cols: [{ k: 'm', l: 'Bulan' }, { k: 'a', l: A.s.code }, { k: 'b', l: B.s.code }], rows: m1.labels.map((l, i) => ({ m: l, a: rd(m1.vals[i]), b: rd(m2.vals[i]) })) });
    const kc = CMP_OUT.map(x => x[1]);
    const oSeg = seg('pp_o', CMP_OUT.map(([k, l]) => [k, l]), this._o);
    return head + `<div class="grid">
      ${card({ id: 'pp', span: 's12', title: `${nm(A)} dibanding ${nm(B)}`, sub: `${PP_PER[this._p].l}. Udara dari stasiun, kasus dari RS rujukannya.`, ctrl,
        body: `<div class="cmp-who">${who(A, 'var(--brand)', 'A')}${who(B, 'var(--warm)', 'B')}</div>`,
        table: tbl, info: { rumus: 'Tabel ini memuat semua angka perbandingan. Unduh CSV untuk membawanya ke spreadsheet.', data: 'pm25 harian, HLT-01, sites.csv, hospitals.csv', filter: false } })}
      ${g('cpm', 's6', 'Seberapa pekat udaranya?', 'Batang = PM2.5 rata-rata dan tertinggi sehari tiap wilayah (µg/m³).', leadPm, t2(['PM2.5 rata-rata', 'PM2.5 tertinggi sehari'], [A.mean, A.mx], [B.mean, B.mx]))}
      ${g('cdy', 's6', 'Berapa hari udaranya buruk?', 'Batang = jumlah hari sah dengan PM2.5 di atas 55 (baku harian) dan di atas 150,4 (Sangat tidak sehat).', leadDy, t2(['Hari > 55', 'Hari > 150,4'], [A.d55, A.d150], [B.d55, B.d150]))}
      ${g('cmo', 's12', 'Kapan udaranya paling buruk?', 'Garis = rata-rata PM2.5 tiap bulan (µg/m³). Garis titik hitam = baku harian 55.', leadMo, tm(mA, mB))}
      ${g('cis', 's6', 'Seberapa sering tiap kategori udara?', `Batang = porsi hari sah per kategori ${term('ISPU')} (%). Makin banyak warna oranye ke merah, makin sering udara tidak sehat.`, leadIs, () => ({ cols: [{ k: 'm', l: 'Kategori ISPU (% hari)' }, { k: 'a', l: A.s.code }, { k: 'b', l: B.s.code }], rows: ISPU.map((c, i) => ({ m: c.l, a: rd(iA[i]), b: rd(iB[i]) })) }), { h: 'h260' })}
      ${g('crx', 's6', 'Berapa kali lipat kasus saat udara buruk?', 'Batang = kasus RS pada hari PM2.5 ≥ 55 dibanding hari bersih RS itu sendiri (1,0 = kondisi biasa, garis titik hitam).', leadRx, t2(PP_OUT.map(x => x[1]), xA, xB), { h: 'h260' })}
      ${g('cmk', 's6', 'Kapan pasien paling banyak?', 'Garis = rata-rata kasus per hari tiap bulan di RS rujukan. Pilih jenis kasus di kanan.', null, tm(kA, kB), { ctrl: oSeg })}
      ${g('cks', 's6', 'Berapa pasien di RS rujukannya?', 'Batang = rata-rata kasus per hari tiap jenis di RS rujukan masing-masing wilayah.', leadKs, t2(kc, CMP_OUT.map(([k]) => A.out[k]), CMP_OUT.map(([k]) => B.out[k])))}
      ${closeCard}
      </div>`;
  },
  mount(C) {
    bindSeg(C, 'pp_p', v => { this._p = v; render(false); });
    bindSeg(C, 'pp_o', v => { this._o = v; render(false); });
    const a = C.querySelector('#cmpA'), b = C.querySelector('#cmpB'), csv = C.querySelector('#cmpCsv');
    if (a) a.onchange = e => { this._a = e.target.value; render(false); };
    if (b) b.onchange = e => { this._b = e.target.value; render(false); };
    const { A, B, mA, mB, kA, kB, iA, iB, xA, xB } = this._d;
    if (csv) csv.onclick = () => csvDownload(`perbandingan_${A.s.code}_${B.s.code}`, this._tbl());
    const cA = cv('--brand'), cB = cv('--warm'), nA = `${A.s.code} ${A.s.kota}`, nB = `${B.s.code} ${B.s.kota}`;
    const LEG = { top: 0, right: 0, itemWidth: 12, itemHeight: 12, textStyle: { color: cv('--ink-2'), fontSize: 12 } };
    const tip = (unit, d) => ({ trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: ps => `<b>${ps[0].axisValueLabel}</b><br>` + ps.map(p => `${p.marker} ${p.seriesName}: <b>${p.value == null ? '–' : f(p.value, d)}</b> ${unit}`).join('<br>') });
    const draw = (id, cats, va, vb, unit, d, extra) => mk(id, {
      grid: { left: 8, right: 16, top: 38, bottom: 8, containLabel: true }, legend: LEG, tooltip: tip(unit, d),
      xAxis: ax({ type: 'category', data: cats, splitLine: { show: false }, axisLabel: { color: cv('--ink-2'), fontSize: 11.5, interval: 0 } }), yAxis: ax({ type: 'value', min: 0 }),
      series: [[nA, va, cA], [nB, vb, cB]].map(([n, v, c], k) => Object.assign({ name: n, type: 'bar', barMaxWidth: 44, data: v, itemStyle: { color: c, borderRadius: [4, 4, 0, 0] },
        label: { show: true, position: 'top', fontSize: 11, color: cv('--ink-2'), formatter: p => p.value == null ? 'n/a' : f(p.value, d) } }, k === 0 && extra ? extra : {})) });
    const line = (id, m1, m2, unit, d, baku) => mk(id, {
      grid: { left: 8, right: 16, top: 38, bottom: 8, containLabel: true }, legend: LEG, tooltip: Object.assign(tip(unit, d), { axisPointer: { type: 'line' } }),
      xAxis: ax({ type: 'category', data: m1.labels, splitLine: { show: false }, axisLabel: { color: cv('--ink-2'), fontSize: 11, interval: 'auto' } }), yAxis: ax({ type: 'value', min: 0 }),
      series: [[nA, m1.vals, cA], [nB, m2.vals, cB]].map(([n, v, c]) => ({ name: n, type: 'line', data: v, symbol: 'circle', symbolSize: 5, connectNulls: false, lineStyle: { width: 2.4, color: c }, itemStyle: { color: c } }))
        .concat(baku ? [{ type: 'line', data: [], markLine: mlBaku(BAKU, 'baku 24 jam ' + BAKU) }] : []) });
    draw('cpm', ['Rata-rata', 'Tertinggi sehari'], [A.mean, A.mx], [B.mean, B.mx], 'µg/m³', 1);
    draw('cdy', ['Di atas 55', 'Di atas 150,4'], [A.d55, A.d150], [B.d55, B.d150], 'hari', 0);
    line('cmo', mA, mB, 'µg/m³', 0, true);
    line('cmk', kA, kB, 'kasus/hari', 1, false);
    draw('cks', CMP_OUT.map(x => x[1]), CMP_OUT.map(([k]) => A.out[k]), CMP_OUT.map(([k]) => B.out[k]), 'kasus/hari', 1);
    draw('crx', PP_OUT.map(x => x[1]), xA, xB, 'kali hari bersih', 2, { markLine: mlRef([refLine(1, 'hari biasa = 1,0', { tip: 'Pembanding: rata-rata kasus RS pada 25% hari terbersih RS itu dihitung 1,0. Batang di atas garis berarti kasus lebih banyak dari hari biasa.' })]) });
    mk('cis', {
      grid: { left: 8, right: 16, top: 34, bottom: 8, containLabel: true }, legend: Object.assign({}, LEG, { data: ISPU.map(c => c.l) }),
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: ps => `<b>${ps[0].axisValueLabel}</b><br>` + ps.map(p => `${p.marker} ${p.seriesName}: <b>${f(p.value, 1)}%</b>`).join('<br>') },
      xAxis: ax({ type: 'value', min: 0, max: 100, axisLabel: { formatter: '{value}%', color: cv('--ink-2') } }), yAxis: ax({ type: 'category', inverse: true, data: [nA, nB], splitLine: { show: false }, axisLabel: { color: cv('--ink-2'), fontSize: 11.5, width: 120, overflow: 'truncate' } }),
      series: ISPU.map((c, i) => ({ name: c.l, type: 'bar', stack: 'is', barWidth: '52%', data: [iA[i], iB[i]], itemStyle: { color: cv(c.v) },
        label: { show: true, formatter: p => p.value >= 7 ? f(p.value, 0) + '%' : '', color: onCol(cv(c.v)), fontSize: 11, fontWeight: 600 } })) });
  },
};

/* paragraf untuk Metodologi */
function ppMethodHTML() {
  return `<p class="sub" style="margin:8px 0 0;font-size:13px;color:var(--ink-2)">Halaman Perbandingan wilayah menyandingkan dua stasiun dan RS rujukannya dalam grafik pada periode pilihan, dengan data yang bisa diunduh sebagai CSV: PM2.5 rata-rata dan tertinggi, jumlah hari di atas 55 dan 150,4 µg/m³ (hari sah saja), serta rata-rata harian tujuh jenis kasus RS. Tidak ada skor atau prediksi. Batasan: hubungan yang tercatat bukan bukti sebab-akibat; jumlah pasien dipengaruhi ukuran RS dan jumlah penduduk yang tidak ada di data; dan datanya sintetis.</p>`;
}

/* gaya khusus halaman ini (memakai token warna yang sama, jadi ikut terang/gelap) */
(function () {
  const st = document.createElement('style');
  st.textContent = `
  .pp-fnote { margin: -6px 0 14px; font-size: 12.5px; color: var(--muted); }
  .pp-ctrl { display: flex; flex-wrap: wrap; gap: 12px 22px; align-items: flex-start; }
  .pp-ctrl .fgroup { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
  .pp-ctrl .fgroup > label { font-size: 11.5px; font-weight: 650; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
  .pp-thr { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .pp-num { width: 84px; font: inherit; font-size: 13px; color: var(--ink); background: var(--surface); border: 1px solid var(--line-2); border-radius: 9px; padding: 6px 9px; }
  .pp-num:focus-visible { outline: 2px solid var(--brand); outline-offset: 1px; }
  .pp-src { font-size: 11.5px; color: var(--muted); }
  .pp-lead { margin: 12px 0 4px; font-size: 14px; color: var(--ink); }
  .pp-never { margin: 0 0 8px; font-size: 12.5px; color: var(--ink-2); }
  .pp-act { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; font-size: 12.5px; color: var(--ink-2); }
  .pp-act .btn[disabled] { opacity: .5; cursor: not-allowed; }
  .pp-wrap { max-height: 620px; }
  .pp-t th { padding: 0; }
  .pp-t th:first-child { padding: 7px 10px; }
  .pp-sort { all: unset; box-sizing: border-box; display: block; width: 100%; padding: 7px 10px; cursor: pointer; font: inherit; color: inherit; text-align: inherit; }
  .pp-sort:hover, .pp-sort.on { color: var(--ink); }
  .pp-sort:focus-visible { outline: 2px solid var(--brand); outline-offset: -2px; }
  .pp-t a { color: var(--ink); text-decoration: none; }
  .pp-t a:hover { text-decoration: underline; }
  .pp-t tr.pp-on td { background: var(--surface-2); }
  .pp-few { display: block; font-size: 11px; color: var(--warn); white-space: normal; }
  .pp-na { font-size: 11.5px; color: var(--muted); white-space: normal; }
  .pp-chk { white-space: normal !important; min-width: 200px; }
  .pp-chk .pill { margin: 1px 0; }
  .pp-close { margin: 10px 0 0; font-size: 13px; color: var(--ink-2); }
  .pp-link { display: flex; flex-wrap: wrap; gap: 10px 16px; align-items: center; justify-content: space-between; margin: 14px 0 0; padding: 12px 14px; border: 1px solid var(--line); border-radius: 12px; background: var(--surface); font-size: 13px; color: var(--ink-2); }
  .pp-link b { color: var(--ink); }
  .cmp-who { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 20px; }
  #card-pp .card-ctrl { gap: 12px 16px; margin-top: 14px; }
  #card-pp .card-ctrl .btn { margin-left: auto; }
  .cmp-w { display: flex; gap: 11px; align-items: flex-start; padding: 12px 14px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface-2); }
  .cmp-w i { width: 12px; height: 12px; border-radius: 4px; margin-top: 4px; flex: none; }
  .cmp-w div { min-width: 0; display: grid; gap: 2px; font-size: 13px; color: var(--ink-2); }
  .cmp-w b { color: var(--ink); font-size: 14px; }
  @media (max-width: 700px) { .cmp-who { grid-template-columns: 1fr; } }`;
  document.head.appendChild(st);
})();
