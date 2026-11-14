/* Siaga Udara: inti (data, state, filter, router, helper grafik). */
'use strict';
const D = window.DATA;
const ST = D.stations;
const BY = Object.fromEntries(ST.map(s => [s.code, s]));
const MONTHS = D.meta.months;            // '2024-01' ... '2026-10'
const ND = D.meta.ndays;                 // 1018 hari, mulai 2024-01-01
const DAY0 = Date.UTC(2024, 0, 1);
const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const BULAN_L = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const HARI = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
const PULAU = ['Sumatera', 'Jawa', 'Kalimantan', 'Sulawesi', 'Papua'];
const KEL = ['Gambut', 'Perkotaan', 'Industri', 'Tepi jalan', 'Latar bersih'];   // urutan warna tetap
const KEL_VAR = { 'Gambut': '--k-gambut', 'Perkotaan': '--k-kota', 'Industri': '--k-industri', 'Tepi jalan': '--k-jalan', 'Latar bersih': '--k-bersih' };
const BAKU = 55, BAKU_THN = 15, WHO_THN = 5;
const POLS = {
  pm25: { l: 'PM2.5', std: 55, stdL: 'baku 24 jam 55 µg/m³', thn: 15 },
  pm10: { l: 'PM10', std: 75, stdL: 'baku 24 jam 75 µg/m³', thn: 40 },
  no2: { l: 'NO₂', std: 65, stdL: 'baku 24 jam 65 µg/m³', thn: 50 },
  so2: { l: 'SO₂', std: 75, stdL: 'baku 24 jam 75 µg/m³', thn: 45 },
  co: { l: 'CO', std: 4000, stdL: 'baku 8 jam 4.000 µg/m³', thn: null },
  o3: { l: 'O₃', std: 100, stdL: 'baku 8 jam 100 µg/m³', thn: 35 },
};
const ISPU = [
  { k: 1, l: 'Baik', max: 15.5, v: '--ispu-1', s: 'Udara sehat dan aman untuk beraktivitas di luar ruangan.' },
  { k: 2, l: 'Sedang', max: 55.4, v: '--ispu-2', s: 'Masih dapat diterima, tetapi kelompok sensitif sebaiknya membatasi aktivitas berat di luar ruangan.' },
  { k: 3, l: 'Tidak sehat', max: 150.4, v: '--ispu-3', s: 'Merugikan kelompok sensitif. Kurangi aktivitas di luar ruangan dan pakai masker.' },
  { k: 4, l: 'Sangat tidak sehat', max: 250.4, v: '--ispu-4', s: 'Berisiko bagi semua orang. Hindari aktivitas di luar ruangan.' },
  { k: 5, l: 'Berbahaya', max: Infinity, v: '--ispu-5', s: 'Darurat kesehatan. Tetap di dalam ruangan dengan udara tersaring.' },
];
const OUTC = {
  u5: { l: 'ISPA balita', s: 'ISPA balita (<5 th)' }, o60: { l: 'ISPA lansia', s: 'ISPA lansia (>60 th)' },
  asma: { l: 'Darurat asma', s: 'Kasus darurat asma' }, ppok: { l: 'PPOK', s: 'Rawat inap PPOK' },
  resp: { l: 'Pernapasan umum', s: 'Rawat pernapasan umum (semua umur)' }, cvd: { l: 'Kardiovaskular', s: 'Kasus kardiovaskular' },
  death: { l: 'Kematian', s: 'Kematian' },
};

/* ---------- format */
const NF = {};
const nfmt = d => NF[d] || (NF[d] = new Intl.NumberFormat('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d }));
const f = (x, d = 1) => (x == null || !isFinite(x)) ? '–' : nfmt(d).format(x);
const fi = x => f(x, 0);
const fp = (x, d = 1) => (x == null || !isFinite(x)) ? '–' : (x > 0 ? '+' : x < 0 ? '−' : '') + nfmt(d).format(Math.abs(x)) + '%';
const dayDate = i => new Date(DAY0 + i * 864e5);
const dayIdx = s => Math.round((Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) - DAY0) / 864e5);
const fd = i => { const d = dayDate(i); return d.getUTCDate() + ' ' + BULAN[d.getUTCMonth()] + ' ' + d.getUTCFullYear(); };
const fds = s => fd(dayIdx(s));
const fm = m => { const [y, mm] = MONTHS[m].split('-'); return BULAN[+mm - 1] + ' ' + y; };
const fmShort = m => { const [y, mm] = MONTHS[m].split('-'); return BULAN[+mm - 1] + " '" + y.slice(2); };
const monStart = m => { const [y, mm] = MONTHS[m].split('-').map(Number); return Math.round((Date.UTC(y, mm - 1, 1) - DAY0) / 864e5); };
const monEnd = m => m + 1 < MONTHS.length ? monStart(m + 1) - 1 : ND - 1;
const monOfDay = i => { const d = dayDate(i); return (d.getUTCFullYear() - 2024) * 12 + d.getUTCMonth(); };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const sum = a => a.reduce((x, y) => x + (y || 0), 0);
const mean = a => { let s = 0, n = 0; for (const v of a) if (v != null && isFinite(v)) { s += v; n++; } return n ? s / n : null; };
const median = a => { const b = a.filter(v => v != null && isFinite(v)).sort((x, y) => x - y); if (!b.length) return null; const m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };
const cv = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const ispuOf = v => ISPU.find(c => v <= c.max) || ISPU[4];
const ispuCol = v => cv(ispuOf(v).v);
const kelCol = k => cv(KEL_VAR[k]);
/* warna teks yang kontras (≥4,5:1) di atas latar warna hex */
const lum = h => { const m = /^#?([0-9a-f]{6})$/i.exec(h || ''); if (!m) return 0; const n = parseInt(m[1], 16);
  return [n >> 16, n >> 8 & 255, n & 255].map(c => { c /= 255; return c <= .03928 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; }).reduce((a, c, i) => a + c * [.2126, .7152, .0722][i], 0); };
const onCol = h => lum(h) > .183 ? '#141a22' : '#ffffff';
const hexA = (h, a) => { const n = parseInt(String(h).replace('#', ''), 16); return `rgba(${n >> 16},${n >> 8 & 255},${n & 255},${a})`; };
/* badge kategori ISPU: soft (default) atau solid */
function ispuBadge(v, solid) {
  const c = ispuOf(v); if (v == null || !isFinite(v)) return '';
  return solid ? `<span class="ib solid" style="background:var(${c.v});color:${onCol(cv(c.v))}"><i></i>${c.l}</span>`
    : `<span class="ib" style="--c:var(${c.v})"><i></i>${c.l}</span>`;
}
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const stName = c => BY[c] ? `${c} ${BY[c].kota}` : c;
const stShort = c => { const s = BY[c]; return s ? s.kota.replace('Kab. ', '') : c; };

/* ---------- state + URL */
const DEF = { from: 0, to: MONTHS.length - 1, pulau: [], kel: [], st: 'KTG-01', pol: 'pm25', yr: 2026, out: 'u5', mdl: 'dlm' };
const S = { page: 'overview', ...structuredClone(DEF) };
function readHash() {
  const h = location.hash.replace(/^#\/?/, '');
  const [p, q] = h.split('?');
  let pg = p === 'ringkasan' ? 'overview' : p === 'analisis' ? 't1' : (p === '' ? 'mulai' : p);
  if (window.AN_PAGE && window.AN_PAGE[pg]) { window.SEC = pg; window.SCROLL_TO = window.SCROLL_TO || 'sec-' + pg; pg = window.AN_PAGE[pg]; } else window.SEC = null;   // langkah/sub-bab alur analisis -> halaman babnya
  S.page = PAGES[pg] ? pg : 'overview';
  Object.assign(S, structuredClone(DEF));
  new URLSearchParams(q || '').forEach((v, k) => {
    if (k === 'from' || k === 'to') { const i = MONTHS.indexOf(v); if (i >= 0) S[k] = i; }
    else if (k === 'pulau' || k === 'kel') S[k] = v.split('|').filter(Boolean);
    else if (k === 'yr') S.yr = +v;
    else if (k in DEF) S[k] = v;
  });
  if (!BY[S.st]) S.st = DEF.st;
  if (S.from > S.to) [S.from, S.to] = [S.to, S.from];
}
function hashOf(page = S.page, patch = {}) {
  const t = { ...S, ...patch };
  const q = new URLSearchParams();
  if (t.from !== DEF.from) q.set('from', MONTHS[t.from]);
  if (t.to !== DEF.to) q.set('to', MONTHS[t.to]);
  if (t.pulau.length) q.set('pulau', t.pulau.join('|'));
  if (t.kel.length) q.set('kel', t.kel.join('|'));
  for (const k of ['st', 'pol', 'yr', 'out', 'mdl']) if (t[k] !== DEF[k]) q.set(k, t[k]);
  const s = q.toString();
  return '#/' + page + (s ? '?' + s : '');
}
function go(page, patch = {}) { location.hash = hashOf(page, patch); }
function setS(patch) { history.replaceState(null, '', hashOf(S.page, patch)); Object.assign(S, patch); render(false); }

/* ---------- himpunan stasiun & statistik */
const isFilt = s => (!S.pulau.length || S.pulau.includes(s.pulau)) && (!S.kel.length || S.kel.includes(s.kel));
const active = () => ST.filter(s => s.use !== 'rusak' && isFilt(s));
const activeAll = () => ST.filter(isFilt);
const range = () => [monStart(S.from), monEnd(S.to)];
function sstat(code, r = range()) {
  const a = D.pm25[code]; let n = 0, s = 0, ex = 0, max = null, mi = -1; const cats = [0, 0, 0, 0, 0];
  for (let i = r[0]; i <= r[1]; i++) { const v = a[i]; if (v == null) continue; n++; s += v; if (v > BAKU) ex++; if (max == null || v > max) { max = v; mi = i; } cats[ispuOf(v).k - 1]++; }
  return { n, mean: n ? s / n : null, ex, pct: n ? 100 * ex / n : null, max, maxDay: mi, cats };
}
function magg(code, pol, m0 = S.from, m1 = S.to) {
  const r = D.mon[code]; let s = 0, n = 0, ex = 0;
  for (let m = m0; m <= m1; m++) { const v = r[pol][m], k = r.n[m]; if (v != null && k) { s += v * k; n += k; ex += r[pol + '_ex'][m] || 0; } }
  return { mean: n ? s / n : null, n, ex, pct: n ? 100 * ex / n : null };
}
function episodesIn(codes, r = range()) {
  return D.episodes.filter(e => codes.includes(e.code) && dayIdx(e.end) >= r[0] && dayIdx(e.start) <= r[1]);
}

/* ---------- tema */
function applyTheme(t) { if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme; }
function curTheme() { const t = document.documentElement.dataset.theme; if (t) return t; return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; }
applyTheme('light'); try { const t = localStorage.getItem('su-theme3'); if (t) applyTheme(t); } catch (e) { }

/* ---------- grafik */
const CH = new Map();
const FONT = '"Inter", system-ui, sans-serif';
function tipBox() {
  return { backgroundColor: cv('--surface'), borderColor: cv('--line'), borderWidth: 1, padding: [10, 13],
    textStyle: { color: cv('--ink'), fontSize: 12, fontFamily: FONT }, extraCssText: 'border-radius:8px;box-shadow:0 2px 4px rgba(16,24,40,.06),0 14px 32px -6px rgba(16,24,40,.22);line-height:1.55;', confine: true };
}
function ax(extra = {}) {
  return Object.assign({ axisLine: { lineStyle: { color: cv('--line-2') } }, axisTick: { show: false },
    axisLabel: { color: cv('--muted'), fontSize: 11, fontFamily: FONT, hideOverlap: true },
    splitLine: { lineStyle: { color: cv('--line'), type: [4, 4] } }, nameTextStyle: { color: cv('--muted'), fontSize: 11, fontFamily: FONT } }, extra);
}
/* gaya bersama: area gradasi transparan, batang membulat (tanpa mengubah data) */
/* dua panel bertumpuk, tiap panel punya judul + keterangan di atasnya (tanpa nama sumbu yang menabrak angka) */
function twoPanel(id, t1, s1, t2, s2, hFrac = .3) {
  const el = document.getElementById(id), W = el.clientWidth, Hh = el.clientHeight;
  const lines = (s, px) => Math.max(1, Math.ceil(String(s || '').length * px / Math.max(120, W - 8)));
  const hd = Math.max(...[[t1, s1], [t2, s2]].map(([t, s]) => lines(t, 7.4) * 17 + lines(s, 6.3) * 15 + 12));
  const ttl = (text, sub, top) => ({ text, subtext: sub, left: 0, top, itemGap: 3,
    textStyle: { fontSize: 13, fontWeight: 700, color: cv('--ink'), fontFamily: FONT, width: W - 8, overflow: 'break' },
    subtextStyle: { fontSize: 11.5, color: cv('--muted'), fontFamily: FONT, width: W - 8, overflow: 'break', lineHeight: 15 } });
  const h0 = Math.max(60, Math.round((Hh - 2 * hd - 44) * (hFrac + .1)));
  const top2 = hd + h0 + 14;
  return { title: [ttl(t1, s1, 0), ttl(t2, s2, top2)],
    grid: [{ left: 50, right: 14, top: hd, height: h0 }, { left: 50, right: 14, top: top2 + hd, bottom: 26 }] };
}
const fmtAx = v => Number.isInteger(v) ? fi(v) : f(v, Math.min(2, (String(v).split('.')[1] || '').length));
function polish(opt) {
  const ys = [].concat(opt.yAxis || []).filter(Boolean), xs = [].concat(opt.xAxis || []).filter(Boolean), g = opt.grid && !Array.isArray(opt.grid) ? opt.grid : null;
  for (const y of ys) if (y.name && !y.nameLocation) y.nameTextStyle = Object.assign({ align: 'left' }, y.nameTextStyle);
  // angka sumbu format Indonesia (3.000, bukan 3,000)
  for (const a of ys.concat(xs)) { const t = a.type || (ys.includes(a) ? 'value' : 'category'); if ((t === 'value' || t === 'log') && !(a.axisLabel && a.axisLabel.formatter != null)) a.axisLabel = Object.assign({}, a.axisLabel, { formatter: fmtAx }); }
  // nama sumbu tegak di atas grafik tidak terpotong; nama sumbu datar di ujung kanan tidak terpotong; label terakhir sumbu datar tidak keluar kanan
  if (g && typeof g.top === 'number' && ys.some(y => y.name && !y.nameLocation && y.show !== false)) g.top = Math.max(g.top, 30);
  if (g && typeof g.right === 'number') for (const x of xs) if (x.name && (!x.nameLocation || x.nameLocation === 'end') && x.show !== false) g.right = Math.max(g.right, Math.ceil(String(x.name).length * 6.4 + (x.nameGap ?? 15) + 6));
  for (const x of xs) if (x.show !== false && ((x.type || 'category') !== 'category' || x.boundaryGap === false)) x.axisLabel = Object.assign({ alignMaxLabel: 'right' }, x.axisLabel);
  for (const a of ys.concat(xs)) a.axisLabel = Object.assign({ hideOverlap: true }, a.axisLabel);
  const ser = Array.isArray(opt.series) ? opt.series : opt.series ? [opt.series] : [];
  for (const s of ser) {
    if (s.type === 'line' && s.areaStyle && typeof s.areaStyle.color === 'string' && s.areaStyle.color[0] === '#' && !s.areaStyle.noGrad) {
      const top = Math.min(.38, (s.areaStyle.opacity ?? .2) * 2.6);
      s.areaStyle = Object.assign({}, s.areaStyle, { opacity: 1, color: new echarts.graphic.LinearGradient(0, 0, 0, 1,
        [{ offset: 0, color: hexA(s.areaStyle.color, top) }, { offset: 1, color: hexA(s.areaStyle.color, .02) }]) });
    }
    if (s.type === 'bar' && !s.stack) { s.itemStyle = Object.assign({ borderRadius: 4 }, s.itemStyle); }
  }
  return opt;
}
/* tooltip sumbu seragam di semua grafik: penanda = garis pendek berwarna sama dengan garisnya, tanggal/kategori sekali, panel atas dulu lalu bawah, di tiap panel dari nilai terbesar */
const tipMk = p => p.seriesType === 'line' ? `<i style="display:inline-block;width:12px;height:3px;border-radius:2px;background:${p.color};margin-right:7px;vertical-align:middle"></i>` : `<i style="display:inline-block;width:9px;height:9px;border-radius:2px;background:${typeof p.color === 'string' ? p.color : 'var(--muted)'};margin-right:6px;vertical-align:-1px"></i>`;
function axisTipStyle(opt) {
  [].concat(opt.series || []).forEach(s => { if (s && s.type === 'line' && s.lineStyle && typeof s.lineStyle.color === 'string' && !(s.itemStyle && s.itemStyle.color)) s.itemStyle = Object.assign({}, s.itemStyle, { color: s.lineStyle.color }); });
  const tt = opt.tooltip; if (!tt || tt.trigger !== 'axis') return;
  const user = tt.formatter, vf = tt.valueFormatter;
  tt.formatter = ps => {
    const arr = [].concat(ps).map(p => Object.assign({}, p, { marker: tipMk(p) }));
    if (user) return user(arr);
    const o = arr.filter(p => (Array.isArray(p.value) ? p.value[1] : p.value) != null).sort((a, b) => (a.axisIndex || 0) - (b.axisIndex || 0) || ((Array.isArray(b.value) ? b.value[1] : b.value) - (Array.isArray(a.value) ? a.value[1] : a.value)) || a.seriesIndex - b.seriesIndex);
    if (!o.length) return '';
    let h = `<b>${o[0].axisValueLabel ?? o[0].name}</b>`, last = o[0].axisIndex || 0;
    for (const p of o) {
      const ai = p.axisIndex || 0; if (ai !== last) { h += `<div style="margin-top:6px;border-top:1px solid ${cv('--line')}"></div>`; last = ai; }
      const v = Array.isArray(p.value) ? p.value[1] : p.value;
      h += `<div style="display:flex;align-items:center;gap:14px;justify-content:space-between;margin-top:3px"><span>${p.marker}${esc(p.seriesName)}</span><b>${vf ? vf(v) : typeof v === 'number' ? (Number.isInteger(v) ? fi(v) : f(v, 1)) : v}</b></div>`;
    }
    return h;
  };
}
function mk(id, opt, onClick) {
  const el = document.getElementById(id); if (!el || el.offsetParent === null && !el.closest('.card')) return null;
  let c = echarts.getInstanceByDom(el) || echarts.init(el, null, { renderer: 'canvas' });
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const base = { color: ['--c1', '--c2', '--c3', '--c4', '--c5', '--c6'].map(cv), textStyle: { fontFamily: FONT, color: cv('--ink-2') }, animation: !calm, animationDuration: 750, animationEasing: 'cubicOut', animationDurationUpdate: 450,
    tooltip: Object.assign({ trigger: 'item' }, tipBox()) };
  if (opt.tooltip) opt.tooltip = Object.assign(tipBox(), opt.tooltip);
  axisTipStyle(opt);
  { const ser = [].concat(opt.series || []).filter(s => s && s.endLabel && s.endLabel.show);
    if (el.clientWidth < 760 && ser.length >= 4) { ser.forEach(s => { s.endLabel = Object.assign({}, s.endLabel, { show: false }); }); if (opt.grid && !Array.isArray(opt.grid) && typeof opt.grid.right === 'number' && opt.grid.right > 40) opt.grid.right = 16; } }
  c.setOption(Object.assign(base, polish(opt)), true);
  c.off('click'); if (onClick) c.on('click', onClick);
  if (RO) RO.observe(el);
  CH.set(id, c); return c;
}
/* grafik ikut ukuran kartunya (mis. setelah font web selesai dimuat) */
const RO = window.ResizeObserver ? new ResizeObserver(es => es.forEach(e => { const c = echarts.getInstanceByDom(e.target);
  if (c && (Math.abs(c.getWidth() - e.target.clientWidth) > 1 || Math.abs(c.getHeight() - e.target.clientHeight) > 1)) c.resize(); })) : null;
function disposeCharts() { if (typeof disposeMap3D === 'function') disposeMap3D(); if (RO) RO.disconnect(); CH.forEach(c => c.dispose()); CH.clear(); }
window.addEventListener('resize', debounce(() => CH.forEach(c => c.resize()), 120));
/* garis acuan seragam: garis titik hitam tebal + label berbingkai (pill) di ujungnya */
const refLine = (v, text, o = {}) => { const x = o.axis === 'xAxis';
  return { [o.axis || 'yAxis']: v, name: text, tip: o.tip, lineStyle: { color: cv('--ink'), type: 'dotted', width: 2, cap: 'round' },
    label: Object.assign({ formatter: text, position: x ? 'end' : (o.pos || 'insideEndTop'), color: cv('--ink'), fontSize: 11.5, fontWeight: 700, fontFamily: FONT,
      backgroundColor: cv('--surface'), padding: [2, 5], borderRadius: 4, borderColor: cv('--ink'), borderWidth: 1 }, x ? { rotate: 0 } : {}, o.label || {}) }; };
/* markLine yang bisa di-hover: label dan garis menampilkan penjelasan (tip) */
const mlRef = data => ({ silent: false, symbol: 'none', animation: false, cursor: 'help', data,
  tooltip: { trigger: 'item', extraCssText: 'max-width:270px;white-space:normal;line-height:1.5', formatter: p => { const d = p.data || {}; return d.tip ? `<b>${esc(d.name || p.name || '')}</b><br>${d.tip}` : ''; } } });
const TIP_BAKU24 = 'Baku mutu harian PM2.5 = 55 µg/m³ (PP 22/2021). Rata-rata sehari yang melewati garis ini dihitung "di atas baku", yaitu batas yang ditetapkan pemerintah untuk udara yang masih dianggap aman dihirup sehari penuh.';
const mlBaku = (v = BAKU, label = 'baku 24 jam ' + v, axis = 'yAxis') => mlRef([refLine(v, label, { axis, tip: TIP_BAKU24 })]);

/* ---------- kartu, KPI, popover */
const CARDS = {};
const IC = {
  info: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.6v.2"/></svg>',
  table: '<svg viewBox="0 0 24 24"><rect x="3.5" y="4.5" width="17" height="15" rx="2"/><path d="M3.5 9.5h17M3.5 14.5h17M9.5 9.5v10"/></svg>',
  dl: '<svg viewBox="0 0 24 24"><path d="M12 4v11M7 10.5l5 5 5-5M5 19.5h14"/></svg>',
  arrow: '<svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  bulb: '<svg viewBox="0 0 24 24"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.4 1 1.1 1 1.9V16h5v-.2c0-.8.4-1.5 1-1.9A6 6 0 0 0 12 3z"/></svg>',
  warn: '<svg viewBox="0 0 24 24"><path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17v.2"/></svg>',
  air: '<svg viewBox="0 0 24 24"><path d="M3 8h11a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h8"/></svg>',
  cal: '<svg viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4M12 13.5v2.5M12 18.4v.1"/></svg>',
  pin: '<svg viewBox="0 0 24 24"><path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0C18.5 15 12 21 12 21z"/><circle cx="12" cy="10" r="2.3"/></svg>',
  fire: '<svg viewBox="0 0 24 24"><path d="M12 21c-3.9 0-6.5-2.6-6.5-6.2 0-3.4 2.4-5.4 3.6-8.3.9 1.7 1.4 3 2.9 3.8.3-2.6 1.6-4.9 3.6-6.3-.2 3 2.9 5.4 2.9 9.6 0 4-2.7 7.4-6.5 7.4z"/><path d="M12 21c-1.6 0-2.7-1.2-2.7-2.8 0-1.8 1.6-2.7 2.7-4.4 1.1 1.7 2.7 2.6 2.7 4.4 0 1.6-1.1 2.8-2.7 2.8z"/></svg>',
  heart: '<svg viewBox="0 0 24 24"><path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.4a4.3 4.3 0 0 1 7.5 2.4C19.5 15.4 12 20 12 20z"/><path d="M7 12.5h2.6l1.4-2.4 2 4.4 1.3-2h2.7"/></svg>',
  gauge: '<svg viewBox="0 0 24 24"><path d="M4 16a8 8 0 1 1 16 0"/><path d="M12 16l4-5"/><circle cx="12" cy="16" r="1.3"/></svg>',
  game: '<svg viewBox="0 0 24 24"><circle cx="7" cy="8" r="2.8"/><circle cx="17" cy="8" r="2.8"/><path d="M2.5 19.5c.4-3 2.2-4.8 4.5-4.8 1.8 0 3.3 1.1 4.1 3M21.5 19.5c-.4-3-2.2-4.8-4.5-4.8-1.8 0-3.3 1.1-4.1 3"/></svg>',
  db: '<svg viewBox="0 0 24 24"><ellipse cx="12" cy="6" rx="7.5" ry="2.8"/><path d="M4.5 6v12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8V6M4.5 12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8"/></svg>',
  clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
};
/* o: {id, span, title, sub, h, info:{...}, table:()=>({cols,rows}), ctrl:html, body:html, note:html, src} */
function card(o) {
  // Batasan di insight pindah ke ikon info (Catatan) supaya insight tetap satu baris.
  const lm = typeof o.note === 'string' && o.note.match(/<span class="lim"><b>Batasan\.<\/b> ([\s\S]*)<\/span>$/);
  if (lm) o.note = o.note.slice(0, lm.index);
  if (lm || o.lead) {
    o.info = Object.assign({ filter: false }, o.info);
    const det = o.lead ? 'Rincian: ' + o.note : '';
    if (o.lead) o.note = o.lead;
    o.info.cat = [det, o.info.cat, lm ? 'Batasan: ' + lm[1] : ''].filter(Boolean).join(' ');
  }
  if (o.sub) o.info = Object.assign({ filter: false }, o.info, { read: o.sub });   // penjelasan cara baca pindah ke ikon info
  CARDS[o.id] = o;
  const tools = [o.table ? `<button data-act="table" title="Lihat sebagai tabel" aria-label="Lihat sebagai tabel">${IC.table}</button>` : '',
    o.table ? `<button data-act="csv" title="Unduh CSV" aria-label="Unduh CSV">${IC.dl}</button>` : '',
    o.info ? `<button data-act="info" title="Cara menghitung" aria-label="Cara menghitung">${IC.info}</button>` : ''].join('');
  return `<section class="card ${o.span || 's12'}${o.go ? ' card-go' : ''}" id="card-${o.id}"${o.go ? ` role="link" tabindex="0" data-go="${o.go}"` : ''}>
    <div class="card-h"><div>${o.k ? `<div class="card-k">${o.k}</div>` : ''}<h3>${o.title}</h3></div><div class="tools" data-card="${o.id}">${tools}</div></div>
    ${o.ctrl ? `<div class="card-ctrl">${o.ctrl}</div>` : ''}
    ${o.body != null ? o.body : `<div class="chart ${o.h || ''}" id="${o.id}" role="img" aria-label="${esc(o.title.replace(/<[^>]+>/g, ''))}"></div>`}
    <div class="tbl-wrap" id="tbl-${o.id}" hidden></div>
    ${o.legend ? `<div class="legend">${o.legend}</div>` : ''}
    ${o.note ? `<div class="note ${o.noteWarn ? 'warn' : ''}">${o.note}</div>` : ''}
    ${o.src ? `<div class="src">${o.src}</div>` : ''}
  </section>`;
}
function tableHTML(t, clickable) {
  const h = t.cols.map(c => `<th class="${c.num ? 'num' : ''}">${c.l}</th>`).join('');
  const b = t.rows.map(r => `<tr${clickable && r._st ? ` class="click" data-st="${r._st}"` : ''}>` + t.cols.map(c => {
    const v = r[c.k]; return `<td class="${c.num ? 'num' : ''}">${c.fmt ? c.fmt(v, r) : (v == null ? '–' : esc(v))}</td>`; }).join('') + '</tr>').join('');
  return `<table class="t"><thead><tr>${h}</tr></thead><tbody>${b}</tbody></table>`;
}
function csvDownload(name, t) {
  const q = v => { const s = v == null ? '' : String(v); return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const txt = [t.cols.map(c => q(c.l.replace(/<[^>]+>/g, ''))).join(',')].concat(t.rows.map(r => t.cols.map(c => q(typeof r[c.k] === 'number' ? Math.round(r[c.k] * 1000) / 1000 : r[c.k])).join(','))).join('\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + txt], { type: 'text/csv;charset=utf-8' }));
  a.download = `siaga-udara_${name}.csv`; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
function kpi(o) {
  const id = 'k' + Math.random().toString(36).slice(2, 8); if (o.info) CARDS[id] = { info: o.info };
  return `<div class="kpi" style="--kc:${o.color || 'var(--brand)'}"${o.go ? ` role="link" tabindex="0" data-go="${o.go}"` : o.sc ? ` role="link" tabindex="0" data-sc="${o.sc}"` : ''}>
    <div class="kpi-l"><span class="kpi-ic" aria-hidden="true">${IC[o.ic] || IC.gauge}</span><span class="kpi-t">${o.l}</span>${o.info ? `<button data-card="${id}" data-act="info" aria-label="Cara menghitung">${IC.info}</button>` : ''}</div>
    <div class="kpi-v"><span class="cu">${o.v}</span>${o.u ? `<small>${o.u}</small>` : ''}</div>
    <div class="kpi-c">${o.c || ''}</div>${o.spark ? `<div class="spark" id="${o.spark}"></div>` : ''}</div>`;
}
const pop = document.getElementById('pop');
function showPop(anchor, html) {
  pop.innerHTML = `<button class="x" aria-label="Tutup">×</button>${html}`; pop.hidden = false;
  const r = anchor.getBoundingClientRect(), w = Math.min(360, innerWidth - 24);
  pop.style.maxWidth = w + 'px';
  const left = Math.max(12, Math.min(innerWidth - w - 12, r.right - w));
  pop.style.left = left + 'px';
  const top = r.bottom + 8; pop.style.top = (top + pop.offsetHeight > innerHeight - 8 ? Math.max(8, r.top - pop.offsetHeight - 8) : top) + 'px';
  pop.querySelector('.x').onclick = hidePop;
}
function hidePop() { pop.hidden = true; }
function infoHTML(i) {
  return `<h4>${i.t || 'Cara menghitung'}</h4><dl>${i.read ? `<dt>Cara membaca</dt><dd>${i.read}</dd>` : ''}${i.def ? `<dt>Apa itu</dt><dd>${i.def}</dd>` : ''}${i.rumus ? `<dt>Rumus</dt><dd>${i.rumus}</dd>` : ''}${i.data ? `<dt>Data</dt><dd>${i.data}</dd>` : ''}${i.filter !== false ? `<dt>Filter</dt><dd>${filterText()}</dd>` : ''}${i.cat ? `<dt>Catatan</dt><dd>${i.cat}</dd>` : ''}</dl>`;
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]');
  if (b) {
    const id = b.dataset.card || b.closest('[data-card]')?.dataset.card, o = CARDS[id]; if (!o) return;
    if (b.dataset.act === 'info') { e.stopPropagation(); showPop(b, infoHTML(o.info)); return; }
    if (b.dataset.act === 'table') {
      const w = document.getElementById('tbl-' + id), ch = document.getElementById(id + '-wrap') || document.getElementById(id), on = w.hidden;
      w.hidden = !on; if (ch) ch.style.display = on ? 'none' : ''; b.classList.toggle('on', on);
      if (on) { w.innerHTML = tableHTML(o.table(), true); } else if (CH.get(id)) CH.get(id).resize();
      return;
    }
    if (b.dataset.act === 'csv') { csvDownload(id, o.table()); return; }
  }
  const tr = e.target.closest('tr.click[data-st]'); if (tr) { go('stasiun', { st: tr.dataset.st }); return; }
  const k = e.target.closest('[data-go]'); if (k && !e.target.closest('button, #sp3, abbr.tip, a')) { location.hash = k.dataset.go; return; }
  const sc = e.target.closest('[data-sc]'); if (sc && !e.target.closest('button, #sp3')) { const el = document.getElementById(sc.dataset.sc); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
  if (!pop.hidden && !e.target.closest('#pop')) hidePop();
  if (!e.target.closest('.ms')) document.querySelectorAll('.ms-panel').forEach(p => p.hidden = true);
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { hidePop(); document.getElementById('app').classList.remove('menu', 'fopen'); }
  if (e.key === 'Enter' && e.target.matches('[data-go]')) location.hash = e.target.dataset.go;
  if (e.key === 'Enter' && e.target.matches('[data-sc]')) { const el = document.getElementById(e.target.dataset.sc); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
});

/* ---------- filter global */
function filterText() {
  const n = active().length;
  return `${fm(S.from)} – ${fm(S.to)} · ${S.pulau.length ? S.pulau.join(', ') : 'semua pulau'} · ${S.kel.length ? S.kel.join(', ') : 'semua tipe lokasi'} · ${n} stasiun`;
}
const PRESETS = [['Semua periode', 0, MONTHS.length - 1], ['Tahun 2024', 0, 11], ['Tahun 2025', 12, 23], ['Tahun 2026 (s.d. 14 Okt)', 24, MONTHS.length - 1],
  ['Kemarau 2024 (Jul–Okt)', 6, 9], ['Kemarau 2025 (Jul–Okt)', 18, 21], ['Kemarau 2026 (Jul–Okt)', 30, 33]];
function msHTML(key, label, items) {
  const sel = S[key];
  const opts = items.map(([v, sw, n]) => `<label><input type="checkbox" value="${esc(v)}" ${sel.includes(v) ? 'checked' : ''}>${sw ? `<i class="sw" style="background:${sw}"></i>` : ''}${esc(v)}<span class="n">${n}</span></label>`).join('');
  return `<div class="fgroup"><label>${label}</label><div class="ms" data-key="${key}"><button type="button" aria-haspopup="true">${sel.length ? (sel.length === 1 ? esc(sel[0]) : sel.length + ' dipilih') : 'Semua'}<svg viewBox="0 0 24 24"><path d="M7 10l5 5 5-5"/></svg></button><div class="ms-panel" hidden>${opts}</div></div></div>`;
}
function renderFilters() {
  const pi = PRESETS.findIndex(p => p[1] === S.from && p[2] === S.to);
  const mopt = sel => MONTHS.map((m, i) => `<option value="${i}" ${i === sel ? 'selected' : ''}>${fm(i)}</option>`).join('');
  const cnt = (k, v) => ST.filter(s => s[k] === v && s.use !== 'rusak').length;
  document.getElementById('filters').innerHTML = `
    <div class="fgroup"><label for="fPreset">Periode</label><select class="sel" id="fPreset">${PRESETS.map((p, i) => `<option value="${i}" ${i === pi ? 'selected' : ''}>${p[0]}</option>`).join('')}${pi < 0 ? '<option selected>Kustom</option>' : ''}</select></div>
    <div class="fgroup"><label for="fFrom">Dari</label><select class="sel" id="fFrom">${mopt(S.from)}</select></div>
    <div class="fgroup"><label for="fTo">Sampai</label><select class="sel" id="fTo">${mopt(S.to)}</select></div>
    ${msHTML('pulau', 'Pulau', PULAU.map(p => [p, null, cnt('pulau', p)]))}
    ${msHTML('kel', 'Tipe lokasi', KEL.map(k => [k, `var(${KEL_VAR[k]})`, cnt('kel', k)]))}
    <button class="btn primary only-m" id="fDone">Terapkan</button>`;
  const F = document.getElementById('filters');
  F.querySelector('#fPreset').onchange = e => { const p = PRESETS[+e.target.value]; if (p) setS({ from: p[1], to: p[2] }); };
  F.querySelector('#fFrom').onchange = e => { const v = +e.target.value; setS(v > S.to ? { from: S.to, to: v } : { from: v }); };
  F.querySelector('#fTo').onchange = e => { const v = +e.target.value; setS(v < S.from ? { from: v, to: S.from } : { to: v }); };
  F.querySelectorAll('.ms').forEach(ms => {
    const key = ms.dataset.key, panel = ms.querySelector('.ms-panel');
    ms.querySelector('button').onclick = () => { const h = panel.hidden; document.querySelectorAll('.ms-panel').forEach(p => p.hidden = true); panel.hidden = !h; };
    panel.onchange = () => { const v = [...panel.querySelectorAll('input:checked')].map(i => i.value); setS({ [key]: v }); };
  });
  F.querySelector('#fDone').onclick = () => document.getElementById('app').classList.remove('fopen');
  const nf = (S.from !== DEF.from || S.to !== DEF.to) + S.pulau.length + S.kel.length;
  document.getElementById('filterCount').textContent = nf || '';
}
function renderFstate() {
  const a = active(), [d0, d1] = range();
  const chips = [`<span class="chip">${fm(S.from)} – ${fm(S.to)} · ${fi(d1 - d0 + 1)} hari</span>`, `<span class="chip">${a.length} stasiun dianalisis</span>`];
  S.pulau.forEach(p => chips.push(`<span class="chip">${esc(p)}<button data-rm="pulau" data-v="${esc(p)}" aria-label="Hapus ${esc(p)}">×</button></span>`));
  S.kel.forEach(p => chips.push(`<span class="chip">${esc(p)}<button data-rm="kel" data-v="${esc(p)}" aria-label="Hapus ${esc(p)}">×</button></span>`));
  if (!a.length) chips.push('<span class="chip warn">Tidak ada stasiun yang cocok dengan filter</span>');
  const nf = (S.from !== DEF.from || S.to !== DEF.to) + S.pulau.length + S.kel.length;
  const el = document.getElementById('fstate');
  el.innerHTML = `<span>Filter aktif:</span>${chips.join('')}${nf ? '<button class="linkbtn" id="fReset">Reset filter</button>' : ''}`;
  el.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => setS({ [b.dataset.rm]: S[b.dataset.rm].filter(x => x !== b.dataset.v) }));
  const r = el.querySelector('#fReset'); if (r) r.onclick = () => setS({ from: DEF.from, to: DEF.to, pulau: [], kel: [] });
}

/* ---------- navigasi */
const NAVI = {
  game: IC.game,
  home: '<svg viewBox="0 0 24 24"><rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/></svg>',
  rec: '<svg viewBox="0 0 24 24"><path d="M9 11l2 2 4-4"/><rect x="4" y="3.5" width="16" height="17" rx="2.5"/></svg>',
  pin: '<svg viewBox="0 0 24 24"><path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0C18.5 15 12 21 12 21z"/><circle cx="12" cy="10" r="2.3"/></svg>',
  db: '<svg viewBox="0 0 24 24"><ellipse cx="12" cy="6" rx="7.5" ry="2.8"/><path d="M4.5 6v12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8V6M4.5 12c0 1.5 3.4 2.8 7.5 2.8s7.5-1.3 7.5-2.8"/></svg>',
};
const STEPS = ['t1', 't2', 't3', 't4'];
function renderNav() {
  const nRusak = ST.filter(s => s.use !== 'andal').length;
  const a = (id, inner) => `<a href="${hashOf(id)}" class="${S.page === id ? 'on' : ''}" ${S.page === id ? 'aria-current="page"' : ''}>${inner}</a>`;
  document.getElementById('nav').innerHTML =
    a('overview', `${NAVI.home}Overview`) +
    '<h6>Alur analisis</h6>' + (window.AN_CH ? window.AN_CH.map(([m, s], i) => `<a href="${hashOf(m)}" class="an-ch${S.page === AN_PAGE[m] ? ' on' : ''}" data-sec="${m}"><span class="step">${i + 1}</span>${AN_LABEL[m]}</a>`).join('') : '') +
    '<h6>Tindak lanjut</h6>' + a('rekomendasi', `${NAVI.rec}Aksi pemerintah`) + a('t5', `${IC.pin}Jaringan pemantau`) +
    '<h6>Data</h6>' + a('stasiun', `${NAVI.pin}Profil stasiun`) + (PAGES.papan ? a('papan', `${IC.table}Perbandingan wilayah`) : '') + a('metodologi', `${NAVI.db}Metodologi &amp; kualitas<span class="count" title="Stasiun berdata parsial/rusak">${nRusak}</span>`);
}
function stepper() {
  const i = STEPS.indexOf(S.page); if (i < 0) return '';
  const nx = STEPS[i + 1] || (typeof LANJUT !== 'undefined' ? LANJUT[0] : 'rekomendasi');
  return `<div class="stepper">${STEPS.map((id, j) => `${j ? '<span class="sep"></span>' : ''}<a href="${hashOf(id)}" class="${j === i ? 'on' : j < i ? 'done' : ''}"><span class="step">${j + 1}</span>${PAGES[id].nav}</a>`).join('')}
    <a class="btn primary" href="${hashOf(nx)}">Berikutnya: ${PAGES[nx].nav} ${IC.arrow}</a></div>`;
}
function ph(o) {
  const sc = '';   // baris "Tujuan booklet · Dasar" dihapus
  const sn = /Langkah (\d)|lanjutan (\d) dari|menjawab T(\d)/.exec(o.k || ''), n = sn && (sn[1] || sn[2] || sn[3]);
  return `<div class="ph${n ? ' has-n' : ''}">${n ? `<span class="ph-n" aria-hidden="true">${n}</span>` : ''}<div class="ph-txt"><div class="kicker">${o.k}</div><h1>${o.h}</h1><p class="lede">${o.lede}</p>${sc}</div>${o.right ? `<div class="ctrl">${o.right}</div>` : ''}</div>`;
}
/* paragraf temuan di bawah grafik + baris batasan (opsional) */
const nt = (t, lim) => `${t}${lim ? `<span class="lim"><b>Batasan.</b> ${lim}</span>` : ''}`;
/* kartu penutup tiap langkah: temuan dan artinya berdampingan, catatan batasan kecil di bawah, lalu tombol ke langkah berikutnya */
function jawab() { return ''; }   // kartu "Jadi, apa yang didapat?" dihapus dari semua halaman
/* hero besar ala aplikasi cuaca: o {k, h, lede, l, v, u, val (untuk kategori ISPU), note, stats:[[ikon, label, nilai]], go} */
function hero(o) {
  const c = ispuOf(o.val), col = cv(c.v);
  return `<section class="hero${o.l ? '' : ' solo'}" style="--hc:${col}">
    <svg class="hero-haze" viewBox="0 0 1200 200" preserveAspectRatio="none" aria-hidden="true"><path d="M0 120c150-40 300 30 450 0s300-60 450-20 220 40 300 10v90H0z"/><path d="M0 160c200-30 350 20 520-6s320-40 460-8 160 20 220 6v48H0z"/></svg>
    <div class="hero-txt"><div class="hero-k">${o.k}</div><h1>${o.h}</h1><p>${o.lede}</p></div>
    ${o.l ? `    <div class="hero-now"${o.go ? ` role="link" tabindex="0" data-go="${o.go}"` : ''}>
      <div class="hero-l">${o.l}</div>
      <div class="hero-v"><span class="cu">${o.v}</span><small>${o.u || ''}</small></div>
      <div class="hero-cat">${ispuBadge(o.val, true)}<span>${o.note || ''}</span></div>
      <p class="hero-s">${c.s}</p>
    </div>` : ''}
    ${o.stats ? `<div class="hero-stats">${o.stats.map(([ic, l, v]) => `<div><span class="hs-ic" aria-hidden="true">${IC[ic] || ''}</span><span><span class="hs-l">${l}</span><b>${v}</b></span></div>`).join('')}</div>` : ''}
  </section>`;
}
/* angka naik sekali saat halaman dibuka; format id-ID dipertahankan */
function countUp(root) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  root.querySelectorAll('.cu').forEach(el => {
    const n = el.firstChild; if (!n || n.nodeType !== 3) return;
    const m = /^([+−-]?)(\d{1,3}(?:\.\d{3})*|\d+)(?:,(\d+))?(.*)$/.exec(n.nodeValue.trim()); if (!m) return;
    const d = m[3] ? m[3].length : 0, end = parseFloat(m[2].replace(/\./g, '') + (m[3] ? '.' + m[3] : '')); if (!isFinite(end) || end === 0) return;
    const t0 = performance.now(), dur = 900, txt = n.nodeValue; let done = false;
    const step = t => { if (done) return; const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      n.nodeValue = p < 1 ? m[1] + nfmt(d).format(end * e) + m[4] : txt; if (p < 1) requestAnimationFrame(step); else done = true; };
    requestAnimationFrame(step);
    setTimeout(() => { done = true; n.nodeValue = txt; }, dur + 300);   // jaminan angka akhir bila rAF diperlambat
  });
}
function enter(root) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const els = [...root.querySelectorAll('.hero, .ph, .stepper, .kpi, .funnel, .grid > .card, .rec')];
  els.forEach((el, i) => { el.style.animationDelay = Math.min(i, 14) * 40 + 'ms'; el.classList.add('rise'); });
  setTimeout(() => els.forEach(el => el.classList.remove('rise')), 1400);   // jaminan tampil penuh bila animasi tertahan
}
function seg(name, opts, cur, tips) {
  tips = tips || (typeof SEG_TIPS !== 'undefined' && SEG_TIPS[name]);
  return `<div class="seg" role="group" data-seg="${name}">${opts.map(([v, l]) => `<button type="button" data-v="${v}"${tips && tips[v] ? ` data-tip="${tips[v]}"` : ''} class="${String(v) === String(cur) ? 'on' : ''}" aria-pressed="${String(v) === String(cur)}">${l}</button>`).join('')}</div>`;
}
function bindSeg(root, name, fn) {
  root.querySelectorAll(`[data-seg="${name}"] button`).forEach(b => b.onclick = () => {
    b.parentNode.querySelectorAll('button').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); }); fn(b.dataset.v); });
}
function stSelect(id, cur, list = ST.filter(s => s.use !== 'rusak')) {
  return `<select class="sel" id="${id}" aria-label="Pilih stasiun">${PULAU.map(p => { const g = list.filter(s => s.pulau === p); return g.length ? `<optgroup label="${p}">${g.map(s => `<option value="${s.code}" ${s.code === cur ? 'selected' : ''}>${s.code} · ${esc(s.kota)}</option>`).join('')}</optgroup>` : ''; }).join('')}</select>`;
}

/* ---------- render */
const PAGES = {};   // diisi pages.js
let lastPage = null;
function render(scrollTop = true) {
  hidePop(); disposeCharts();
  for (const k in CARDS) delete CARDS[k];
  const P = PAGES[S.page];
  document.title = `${P.title} · Siaga Udara`;
  /* landing page: tampil penuh tanpa sidebar */
  const LPg = document.getElementById('landing');
  document.body.classList.toggle('on-landing', !!P.landing);
  if (LPg) LPg.hidden = !P.landing;
  if (P.landing) { if (lastPage !== S.page || !LPg.firstChild) { P.mount(LPg); window.scrollTo(0, 0); } lastPage = S.page; return; }
  if (LPg && LPg.firstChild) { if (typeof LPX !== 'undefined' && LPX.off) LPX.off(); LPg.innerHTML = ''; }
  document.getElementById('app').classList.toggle('no-filters', !!P.noFilters);
  document.getElementById('crumb').innerHTML = `${P.group ? P.group + ' / ' : ''}<b>${P.title}</b>`;
  renderNav(); renderFilters(); renderFstate();
  if (S.page === 'stasiun') { if (lastPage === 'overview') window.BACK_MAP = true; } else window.BACK_MAP = false;
  const C = document.getElementById('content');
  // tombol kembali ke Ringkasan: muncul bila halaman dibuka dari Ringkasan, bertahan selama masih di halaman itu
  if (S.page === 'overview' || S.page === 'stasiun') window.BACK_OV = false; else if (lastPage === 'overview') window.BACK_OV = true; else if (lastPage !== S.page) window.BACK_OV = false;
  const backOv = window.BACK_OV ? `<div class="backbar only-m"><a class="btn primary" href="${hashOf('overview')}" onclick="window.SCROLL_TO=${/^t[1-5]$/.test(window.SEC || S.page) ? `'ov-${window.SEC || S.page}'` : 'null'}">← Kembali ke Ringkasan</a></div>` : '';
  if (window.REC_FROM && window.REC_FROM.p !== (window.SEC || S.page)) window.REC_FROM = null;
  if (window.BACK_X && window.BACK_X.p !== S.page) window.BACK_X = null;
  const bx = window.BACK_X, bxBtn = cls => bx ? `<a class="btn primary ${cls}" href="${bx.h}" onclick="window.SCROLL_TO='${bx.id}'">← Kembali ke ${bx.label}</a>` : '';
  const backRec = window.REC_FROM ? `<div class="backbar only-m"><a class="btn primary" href="${window.REC_FROM.h}" onclick="window.SCROLL_TO='rec${window.REC_FROM.n}'">← Kembali ke Aksi pemerintah #${window.REC_FROM.n}</a></div>` : '';
  C.innerHTML = (bx ? `<div class="backbar only-m">${bxBtn('')}</div>` : '') + backRec + backOv + (P.steps ? stepper() : '') + P.html();
  const fresh = lastPage !== S.page;
  if (fresh) enter(C);
  P.mount && P.mount(C);
  autoTerms(C);
  /* tombol kembali di kanan atas (sebelah filter) + penerangan pada grafik bukti rekomendasi */
  { const F = document.getElementById('filters'); if (F) { F.querySelectorAll('.back-top').forEach(x => x.remove());
      const rf = window.REC_FROM;
      if (bx) F.insertAdjacentHTML('beforeend', bxBtn('back-top'));
      else if (rf) F.insertAdjacentHTML('beforeend', `<a class="btn primary back-top" href="${rf.h}" onclick="window.SCROLL_TO='rec${rf.n}'">← Kembali ke Aksi pemerintah #${rf.n}</a>`);
      else if (window.BACK_OV) F.insertAdjacentHTML('beforeend', `<a class="btn primary back-top" href="${hashOf('overview')}" onclick="window.SCROLL_TO=${/^t[1-5]$/.test(window.SEC || S.page) ? `'ov-${window.SEC || S.page}'` : 'null'}">← Kembali ke Ringkasan</a>`); }
    const ev = window.REC_FROM && window.REC_EVS && window.REC_EVS[window.REC_FROM.n], cd = ev && document.getElementById('card-' + ev.card);
    if (cd && !cd.querySelector('.ev-note')) { cd.classList.add('ev-focus'); const h = cd.querySelector('.card-h'); if (h) h.insertAdjacentHTML('afterend', `<div class="ev-note"><b>Bukti rekomendasi #${window.REC_FROM.n}.</b> ${ev.why}</div>`); } }
  if (fresh) countUp(C);
  if (window.SCROLL_TO) {
    const id = window.SCROLL_TO; window.SCROLL_TO = null;
    const jump = () => { const el = document.getElementById(id); if (el) el.scrollIntoView({ block: /^(ov|sec)-/.test(id) ? 'start' : 'center' }); };
    jump(); setTimeout(jump, 120); setTimeout(jump, 450);
  } else if (scrollTop && fresh) { window.scrollTo(0, 0); C.focus({ preventScroll: true }); }
  lastPage = S.page;
  document.getElementById('app').classList.remove('menu');
}
window.addEventListener('hashchange', () => { readHash(); render(); });
window.addEventListener('DOMContentLoaded', () => {
  document.getElementById('menuBtn').onclick = () => document.getElementById('app').classList.add('menu');
  document.getElementById('filterBtn').onclick = () => document.getElementById('app').classList.add('fopen');
  document.getElementById('scrim').onclick = () => document.getElementById('app').classList.remove('menu', 'fopen');
  document.getElementById('themeBtn').onclick = () => {
    const t = curTheme() === 'dark' ? 'light' : 'dark'; applyTheme(t); try { localStorage.setItem('su-theme3', t); } catch (e) { } render(false); };
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => render(false));
  readHash(); render();
});

/* istilah dengan penjelasan saat disorot: <abbr class="tip" data-tip="..."> */
const TIPS = {
  'PM2.5': 'Partikel udara sangat halus yang bisa masuk ke paru-paru dan darah. Jadi tolok ukur utama karena paling berbahaya bagi kesehatan.',
  'baku tahunan': 'Batas rata-rata PM2.5 setahun yang ditetapkan pemerintah (PP 22/2021): 15 µg/m³.',
  'WHO 5': 'Pedoman WHO: rata-rata PM2.5 setahun sebaiknya tidak lebih dari 5 µg/m³.',
  'Hari tidak sehat': 'Hari dengan rata-rata PM2.5 di atas 55 µg/m³, batas harian dari pemerintah.',
  'Episode kabut asap': 'Tiga hari berturut-turut atau lebih dengan PM2.5 harian di atas 150 µg/m³.',
  'ISPA': 'Infeksi saluran pernapasan akut, seperti batuk-pilek berat dan radang paru.',
  'IK 95%': 'Rentang yang sangat mungkin memuat nilai sebenarnya. Makin sempit, makin pasti.',
  'µg/m³': 'Mikrogram partikel dalam satu meter kubik udara. Makin besar angkanya, makin kotor udaranya.',
  'ISPU': 'Indeks Standar Pencemar Udara: lima kategori dari Baik sampai Berbahaya (Permen LHK 14/2020).',
  'baku 24 jam': 'Batas rata-rata PM2.5 dalam sehari menurut PP 22/2021: 55 µg/m³.',
  'hari sah': 'Hari yang punya data valid minimal 18 dari 24 jam. Hari lain tidak dihitung.',
  'kronis': 'Udara buruk hampir sepanjang tahun, tidak bergantung musim.',
  'musiman': 'Udara buruk terutama saat kemarau (Juli–Oktober), lalu membaik lagi.',
  'ρ': 'Angka kekuatan hubungan, dari −1 sampai +1. Dekat 0 berarti tidak berhubungan; makin dekat ke −1 atau +1 makin kuat.',
  'variasi': 'Seberapa besar naik-turun PM2.5 bisa diterangkan oleh faktor itu. 100% berarti sepenuhnya, 0% berarti tidak sama sekali.',
  'pengaruh musim dibuang': 'Polusi tiap hari dibandingkan dengan rata-rata bulannya sendiri, supaya kemarau tidak membuat semua hal tampak berhubungan.',
  'latar bersih': 'Stasiun pembanding yang jauh dari sumber polusi, misalnya di pegunungan atau taman nasional.',
  'tipe lokasi': 'Pengelompokan stasiun menurut lingkungannya: gambut, perkotaan, industri, tepi jalan, atau latar bersih.',
  'skala logaritmik': 'Tiap langkah di sumbu berarti dikali 10 (10, 100, 1.000), supaya jarak yang sangat kecil dan sangat besar muat dalam satu grafik.',
  'efek jeda': 'Apakah dampak kesehatan muncul pada hari yang sama, atau baru beberapa hari setelah polusi tinggi.',
  'model': 'Perhitungan statistik (regresi Poisson) yang membandingkan jumlah kasus pada hari berpolusi tinggi dan rendah, sambil menyingkirkan pengaruh musim, hari, dan suhu.',
  'hari-RS': 'Satu hari data di satu rumah sakit. Contoh: 25 RS selama 900 hari = 22.500 hari-RS.',
  'TT': 'Tempat tidur rumah sakit.',
  'PPOK': 'Penyakit paru obstruktif kronis: saluran napas menyempit dalam jangka panjang, sering pada perokok dan lansia.',
  'kardiovaskular': 'Penyakit jantung dan pembuluh darah.',
  'andal': 'Stasiun dengan data sah pada 90% hari atau lebih.',
  'parsial': 'Stasiun yang sebagian datanya hilang atau macet.',
  'rusak': 'Stasiun yang hampir tidak punya data sah (kurang dari 1% hari).',
  'tetangga terdekat': 'Stasiun lain yang jaraknya paling dekat.',
  'sinyal kembar': 'Dua stasiun yang angkanya hampir selalu sama, sehingga stasiun kedua tidak menambah informasi baru.',
  'skor prioritas': 'Gabungan empat komponen (polusi, beban RS, celah data, keterpencilan) dengan bobot yang bisa diatur, skala 0–100.',
  'PM10': 'Partikel udara berukuran sampai 10 mikron, lebih besar dari PM2.5. Termasuk debu jalan dan abu.',
  'gambut': 'Tanah basah dari sisa tumbuhan yang menumpuk ribuan tahun. Saat kering mudah terbakar dan menghasilkan asap pekat.',
  'kemarau': 'Musim kering, di data ini sekitar Juli sampai Oktober.',
  'sabuk asap': 'Kelompok stasiun yang PM2.5 Agustus–Oktobernya minimal dua kali lipat bulan lain.',
  'qc_flag': 'Penanda kualitas tiap pembacaan alat. Hanya yang berlabel VALID yang dipakai.',
  'korelasi': 'Ukuran seberapa kompak dua angka naik-turun bersama, dari −1 sampai +1.' };
const term = (k, t) => TIPS[k] ? `<abbr class="tip" tabindex="0" data-tip="${TIPS[k]}">${t || k}</abbr>` : (t || k);
/* kata kunci otomatis: kemunculan pertama tiap istilah di satu halaman digaris bawahi dan diberi arti */
const lcf = t => /^(ISPA|PPOK)/.test(t) ? t : t.charAt(0).toLowerCase() + t.slice(1);
const TERM_AL = [['sinyal kembar', /sinyal(?:nya)? kembar/i], ['skor prioritas', /skor prioritas/i], ['tetangga terdekat', /tetangga terdekat/i], ['pengaruh musim dibuang', /pengaruh musim dibuang/i],
  ['latar bersih', /latar bersih/i], ['skala logaritmik', /skala log(?:aritmik)?/i], ['baku tahunan', /baku tahunan/i], ['baku 24 jam', /baku (?:24 jam|harian)/i], ['Hari tidak sehat', /hari tidak sehat/i],
  ['Episode kabut asap', /episode(?: kabut asap)?/i], ['efek jeda', /efek jeda/i], ['IK 95%', /IK 95%|selang kepercayaan 95%/], ['hari sah', /hari sah/i], ['hari-RS', /hari-RS/], ['tipe lokasi', /tipe lokasi/i],
  ['sabuk asap', /sabuk asap/i], ['gambut', /gambut/i], ['kemarau', /kemarau/i], ['kronis', /kronis/i], ['musiman', /musiman/i], ['qc_flag', /qc_flag/], ['korelasi', /korelasi/i], ['WHO 5', /WHO(?: 5)?/],
  ['PM2.5', /PM2\.5/], ['PM10', /PM10/], ['ISPU', /\bISPU\b/], ['ISPA', /\bISPA\b/], ['PPOK', /\bPPOK\b/], ['kardiovaskular', /kardiovaskular/i], ['TT', /\bTT\b/], ['µg/m³', /µg\/m³/]];
function autoTerms(root) {
  /* tidak ada garis bawah di halaman: semua istilah dikumpulkan di header, penjelasan muncul saat disorot */
  const head = root.querySelector('.ph, .ov-h');
  const txt = root.innerText;
  const found = [...root.querySelectorAll('abbr.tip')].map(a => [a.dataset.tip, a.textContent]);
  root.querySelectorAll('abbr.tip').forEach(a => a.replaceWith(document.createTextNode(a.textContent)));
  if (!head || head.querySelector('.gloss')) return;
  const keys = new Map();
  TERM_AL.forEach(([k, re]) => { const m = TIPS[k] && re.exec(txt); if (m) keys.set(k, m.index); });
  found.forEach(([tip, t]) => { const k = Object.keys(TIPS).find(x => TIPS[x] === tip); if (k && !keys.has(k)) keys.set(k, Math.max(0, txt.indexOf(t))); });
  const list = [...keys].sort((x, y) => x[1] - y[1]);
  const host = head.querySelector('.ph-txt') || head; if (!list.length || !host) return;
  const g = document.createElement('div'); g.className = 'gloss';
  g.innerHTML = '<span class="gloss-h">Istilah</span>' + list.map(([k]) => `<span class="gt" tabindex="0" data-tip="${esc(TIPS[k])}">${esc(k)}</span>`).join('<span class="gd"> · </span>');
  host.appendChild(g);
}
/* penjelasan tombol pilihan (seg) yang muncul saat disorot */
const SEG_TIPS = {
  mdl: { naive: 'Membandingkan hari kotor dan bersih apa adanya. Musim belum dikendalikan, jadi efek kemarau ikut terhitung.', mid: 'Membandingkan hari dalam tahun dan bulan kalender yang sama, serta mengendalikan hari dalam seminggu dan suhu.', dlm: 'Membandingkan hari-hari dalam bulan yang sama di RS yang sama, dengan efek 0–7 hari dihitung bersamaan. Paling ketat, jadi angka inilah yang dipakai.' },
  redm: { raw: 'Kemiripan angka harian apa adanya, termasuk karena sama-sama kotor saat kemarau.', anom: 'Kemiripan naik-turun harian setelah pengaruh musim dibuang.' },
  scx: { road: 'Jarak stasiun ke jalan raya terdekat, dalam meter.', traffic: 'Rata-rata jumlah kendaraan per jam di sekitar stasiun.' },
  mapmode: { '3d': 'Tiang = stasiun; tingginya mengikuti rata-rata PM2.5.', '2d': 'Peta datar; titik = stasiun.' },
  mapyr: { all: 'Rata-rata seluruh periode Januari 2024 – Oktober 2026.' },
  sgs: { reg: 'Asap di tiap kota kebanyakan kiriman udara regional bersama; hanya 10% berasal dari provinsi sendiri.', mix: 'Skenario tengah: 40% asap dari provinsi sendiri, 60% kiriman regional bersama.', lok: 'Asap kebanyakan dari provinsi sendiri (70%); hanya 30% kiriman regional.' },
  prsc: { tepat: 'Musim hujan datang sesuai pola tahun-tahun sebelumnya.', m20: 'Musim hujan terlambat 20 hari, sehingga kabut asap bertahan lebih lama.', m30: 'Musim hujan terlambat 30 hari, skenario terburuk yang dihitung.' },
  prlv: { rata: 'Proyeksi dimulai dari rata-rata PM2.5 tanggal 1–14 Oktober 2026.', akhir: 'Proyeksi dimulai dari nilai PM2.5 tanggal 14 Oktober 2026, data terakhir.' } };
(() => {
  let box = null;
  const show = el => {
    if (!box) { box = document.createElement('div'); box.className = 'tipx'; box.setAttribute('role', 'tooltip'); document.body.appendChild(box); }
    box.textContent = el.dataset.tip; box.style.display = 'block';
    const r = el.getBoundingClientRect(), w = box.offsetWidth, h = box.offsetHeight;
    let x = Math.min(Math.max(8, r.left + r.width / 2 - w / 2), innerWidth - w - 8), y = r.top - h - 8; if (y < 8) y = r.bottom + 8;
    box.style.left = x + 'px'; box.style.top = y + 'px';
  };
  const hide = () => { if (box) box.style.display = 'none'; };
  document.addEventListener('mouseover', e => { const t = e.target.closest && e.target.closest('[data-tip]'); if (t) show(t); });
  document.addEventListener('mouseout', e => { if (e.target.closest && e.target.closest('[data-tip]')) hide(); });
  document.addEventListener('focusin', e => { if (e.target.dataset && e.target.dataset.tip) show(e.target); });
  document.addEventListener('focusout', hide);
  let tm = null;
  document.addEventListener('click', e => { const t = e.target.closest && e.target.closest('[data-tip]'); clearTimeout(tm); if (t) { show(t); tm = setTimeout(hide, 3500); } else hide(); });
  addEventListener('scroll', hide, true);
})();
