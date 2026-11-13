/* Analisis lanjutan: "Strategi bersama" (teori permainan).
   Semua angka dihitung saat runtime dari window.DATA. Jendela tetap 1 Agu–14 Okt 2026; filter global tidak berlaku.
   Fungsi: sgCalc() (semua statistik, di-cache), sgCoal() (manfaat per RS untuk satu koalisi), sgMethodHTML() (teks Metodologi). */
const SG_CL = ['KTB-01', 'PKU-01', 'JMB-01', 'BTM-01', 'STG-01', 'PKN-01'];
const SG_PROV = { 'KTB-01': 'Sumbar', 'PKU-01': 'Riau', 'JMB-01': 'Jambi', 'BTM-01': 'Kepri', 'STG-01': 'Kalbar', 'PKN-01': 'Kalteng' };
const SG_COL = { 'KTB-01': '--k-bersih', 'PKU-01': '--k-kota', 'JMB-01': '--k-industri', 'BTM-01': '--k-jalan', 'STG-01': '--ispu-3', 'PKN-01': '--k-gambut' };
const SG_NEAR = ['MDN-01', 'IDP-01', 'BGL-01', 'BJB-01', 'SM2-01', 'MRS-01', 'PLU-01'];   // RS terdekat di luar sabuk asap
const SG_SC = { reg: [0.1, 'Sebagian besar regional'], mix: [0.4, 'Campuran'], lok: [0.7, 'Sebagian besar lokal'] };
const SG_YRS = [2024, 2025, 2026];
const sgNm = c => `${SG_PROV[c]} · ${stShort(c)}`;
const sgD = i => { const d = dayDate(i); return d.getUTCDate() + ' ' + BULAN[d.getUTCMonth()]; };

function sgPc(a, b) { const x = [], y = []; for (let i = 0; i < a.length; i++) if (a[i] != null && b[i] != null) { x.push(a[i]); y.push(b[i]); } return pearson(x, y); }

let SGC = null;
function sgCalc() {
  if (SGC) return SGC;
  const W0 = dayIdx('2026-08-01'), W1 = Math.min(dayIdx('2026-10-14'), ND - 1), Y26 = dayIdx('2026-01-01');
  const q25 = a => { const s = a.filter(v => v != null).sort((x, y) => x - y); return s[Math.floor(.25 * (s.length - 1))]; };
  const st = {};
  for (const s of ST) {
    if (s.use === 'rusak') continue;
    const c = s.code, pm = D.pm25[c], h = D.health[s.rs], p25 = q25(pm), cl = [];
    pm.forEach((v, i) => { if (v != null && v <= p25) cl.push(i); });
    const base = {}, exc = {};
    for (const o of ['resp', 'u5', 'death']) { base[o] = mean(cl.map(i => h[o][i])); let e = 0; for (let i = W0; i <= W1; i++) e += h[o][i] - base[o]; exc[o] = e; }
    let n = 0, k = 0; for (let i = 0; i < ND; i++) { const m = dayDate(i).getUTCMonth(); if (m >= 7 && m <= 9) { n++; if (pm[i] != null) k++; } }
    st[c] = { pm0: mean(cl.map(i => pm[i])), base, exc, xs: h.resp.map(v => v - base.resp), avail: k / n };
  }
  // hubungan lurus kasus pernapasan ~ PM2.5 per RS (2024–2025), lalu kasus terhindar bila lonjakan 2026 turun separuh
  for (const c of SG_CL) {
    const pm = D.pm25[c], h = D.health[BY[c].rs].resp; let n = 0, sx = 0, sy = 0, sxx = 0, sxy = 0;
    for (let i = 0; i < Y26; i++) if (pm[i] != null) { n++; sx += pm[i]; sy += h[i]; sxx += pm[i] * pm[i]; sxy += pm[i] * h[i]; }
    const slope = (n * sxy - sx * sy) / (n * sxx - sx * sx); let B = 0;
    for (let i = W0; i <= W1; i++) if (pm[i] != null) B += .5 * slope * Math.max(0, pm[i] - st[c].pm0);
    Object.assign(st[c], { slope, B });
  }
  const sumB = sum(SG_CL.map(c => st[c].B));
  // tanggal mulai musim: hari pertama sejak 1 Jul dengan 3 hari berturut > 2× median Jan–Jun tahun itu
  const onset = {};
  for (const c of SG_CL) { onset[c] = {}; for (const y of SG_YRS) { const pm = D.pm25[c], med = median(pm.slice(dayIdx(y + '-01-01'), dayIdx(y + '-06-30') + 1));
    let o = null; for (let i = dayIdx(y + '-07-01'); i <= Math.min(dayIdx(y + '-11-30'), ND - 3); i++) if (pm[i] > 2 * med && pm[i + 1] > 2 * med && pm[i + 2] > 2 * med) { o = i; break; }
    onset[c][y] = o; } }
  const onsetSet = [...new Set(SG_CL.flatMap(c => SG_YRS.map(y => onset[c][y] == null ? 'tidak ada' : sgD(onset[c][y]))))];
  // keserempakan per musim (nilai harian) dan uji jeda pada perubahan harian (−5..+5 hari)
  const win = (c, y) => D.pm25[c].slice(dayIdx(y + '-08-01'), Math.min(dayIdx(y + '-10-14'), ND - 1) + 1);
  const dif = (c, y) => { const a = win(c, y); return a.slice(1).map((v, i) => v != null && a[i] != null ? v - a[i] : null); };
  const lagR = (a, b, L) => { const x = [], z = []; for (const y of SG_YRS) { const A = dif(a, y), Bb = dif(b, y); for (let i = 0; i < A.length; i++) { const j = i + L; if (j >= 0 && j < Bb.length) { x.push(A[i]); z.push(Bb[j]); } } } return sgPc(x, z); };
  const yrR = {}; for (const y of SG_YRS) yrR[y] = [];
  const pairs = [];
  for (let i = 0; i < 6; i++) for (let j = i + 1; j < 6; j++) {
    const a = SG_CL[i], b = SG_CL[j]; for (const y of SG_YRS) yrR[y].push(sgPc(win(a, y), win(b, y)));
    let best = -2, bl = 0; for (let L = -5; L <= 5; L++) { const r = lagR(a, b, L); if (r > best) { best = r; bl = L; } }
    pairs.push({ a, b, lag: bl, r: best });
  }
  // bagian naik-turun harian yang khas tiap kota (1 − r² terhadap rata-rata lima kota lain), Agu–Okt tiga musim
  const uniq = {};
  for (const c of SG_CL) { const x = [], y = [];
    for (const yy of SG_YRS) { const i0 = dayIdx(yy + '-08-01'), i1 = Math.min(dayIdx(yy + '-10-31'), ND - 1);
      for (let i = i0 + 1; i <= i1; i++) { const o = SG_CL.filter(k => k !== c); const now = o.map(k => D.pm25[k][i]), pre = o.map(k => D.pm25[k][i - 1]);
        if (D.pm25[c][i] == null || D.pm25[c][i - 1] == null || now.some(v => v == null) || pre.some(v => v == null)) continue;
        x.push(mean(now) - mean(pre)); y.push(D.pm25[c][i] - D.pm25[c][i - 1]); } }
    const r = pearson(x, y); uniq[c] = 1 - r * r; }
  // kenaikan 8→14 Okt 2026
  const i8 = dayIdx('2026-10-08');
  const rise = ST.filter(s => s.use !== 'rusak').map(s => { const a = D.pm25[s.code]; return { c: s.code, v: a[W1] != null && a[i8] != null ? a[W1] - a[i8] : null }; }).filter(r => r.v != null);
  // permainan 2: berbagi beban antar-RS
  const nonClub = ST.filter(s => s.use !== 'rusak' && !SG_CL.includes(s.code) && !s.code.startsWith('KTG')).map(s => s.code);
  const days = []; for (let i = W0; i <= W1; i++) days.push(i);
  const grp = { club: SG_CL, dekat: SG_CL.concat(SG_NEAR), semua: SG_CL.concat(nonClub) };
  const pool = {};
  for (const [g, set] of Object.entries(grp)) {
    const b0 = sum(set.map(c => st[c].base.resp)), ex = days.map(i => sum(set.map(c => st[c].xs[i])));
    const sumPk = sum(set.map(c => Math.max(0, ...days.map(i => st[c].xs[i]))));
    const ratio = ex.map(e => (b0 + e) / b0), pk = Math.max(...ex), at = ex.indexOf(pk);
    pool[g] = { set, b0, ratio, peak: ratio[at], peakDay: days[at], gain: 1 - pk / sumPk };
  }
  const clubEx = days.map(i => sum(SG_CL.map(c => st[c].xs[i])));
  const partner = nonClub.map(c => ({ c, r: sgPc(clubEx, days.map(i => st[c].xs[i])), b0: st[c].base.resp })).sort((a, b) => a.r - b.r);
  const exc = { resp: sum(SG_CL.map(c => st[c].exc.resp)), u5: sum(SG_CL.map(c => st[c].exc.u5)), death: sum(SG_CL.map(c => st[c].exc.death)) };
  // bukti sederhana: 8 Okt 2026 di PKU (asap turun mendadak) dan RS Jakarta saat musim asap mulai
  const pku = { pm: [D.pm25['PKU-01'][i8 - 1], D.pm25['PKU-01'][i8]], rs: [D.health[BY['PKU-01'].rs].resp[i8 - 1], D.health[BY['PKU-01'].rs].resp[i8]] };
  const avgRs = (c, a, b) => mean(D.health[BY[c].rs].resp.slice(dayIdx(a), dayIdx(b) + 1));
  const jkt = { pre: avgRs('JKT-01', '2026-07-16', '2026-07-31'), post: avgRs('JKT-01', '2026-08-01', '2026-08-15') };
  const pkuStep = { pre: avgRs('PKU-01', '2026-07-16', '2026-07-31'), post: avgRs('PKU-01', '2026-08-01', '2026-08-15') };
  const clubB0 = sum(SG_CL.map(c => st[c].base.resp));
  SGC = { W0, W1, days, st, sumB, onset, onsetSet, yrR, pairs, uniq, rise, nonClub, pool, partner, exc, pku, jkt, pkuStep, clubB0 };
  return SGC;
}
/* manfaat (kasus pernapasan terhindar) di tiap RS bila koalisi K bertindak; s = porsi lonjakan yang berasal dari wilayah sendiri */
function sgCoal(K, s) {
  const C = sgCalc(), k = K.size;
  return SG_CL.map(c => { const B = C.st[c].B, inK = K.has(c);
    const own = inK ? B * (s + (1 - s) / 6) : 0, nb = B * (1 - s) * (k - (inK ? 1 : 0)) / 6;
    return { c, B, own, nb, tot: own + nb }; });
}
const sgAloneF = s => s + (1 - s) / 6;   // bagian manfaat di RS sendiri bila bertindak sendirian
const sgRange = a => { const v = a.filter(x => x != null); return [Math.min(...v), Math.max(...v)]; };

const secH = (id, k, h, p) => `<div class="sec-h" id="${id}"><div class="kicker">${k}</div><h2>${h}</h2>${p ? `<p>${p}</p>` : ''}</div>`;

PAGES.strategi = {
  title: 'Strategi bersama', nav: 'Strategi bersama', group: 'Analisis lanjutan',
  html() {
    const C = sgCalc(), st = C.st;
    this._y = this._y || 2026; this._s = this._s || 'mix'; this._K = this._K || new Set(['PKN-01']);
    const s = SG_SC[this._s][0], mult = 1 / sgAloneF(s);
    const rows = sgCoal(this._K, s), tot = sum(rows.map(r => r.tot));
    const onsetTxt = C.onsetSet.length === 1 ? C.onsetSet[0] : C.onsetSet.join(', ');
    const lag0 = C.pairs.filter(p => p.lag === 0).length, rr = sgRange(C.pairs.map(p => p.r));
    const uq = sgRange(Object.values(C.uniq));
    const pc = C.pool, best = C.partner.filter(p => p.r < .2).map(p => p.c);
    const shp = SG_CL.map(c => ({ c, v: (s * st[c].B + (1 - s) / 6 * C.sumB) / C.sumB })).sort((a, b) => b.v - a.v);
    const chips = SG_CL.map(c => `<button type="button" data-tg="${c}" class="${this._K.has(c) ? 'on' : ''}" aria-pressed="${this._K.has(c)}">${SG_PROV[c]}</button>`).join('');
    const legCl = SG_CL.map(c => `<span><i class="line" style="background:var(${SG_COL[c]})"></i>${sgNm(c)}</span>`).join('') + '<span><i class="line" style="background:var(--div-mid)"></i>Jakarta & Yogyakarta (pembanding)</span>';
    const sensRows = ['SM2-01', 'MDN-01', 'BJB-01', 'PLB-01'].map(c => ({ _st: c, code: c, kota: BY[c].kota, prov: BY[c].prov, av: 100 * st[c].avail,
      r: (C.partner.find(p => p.c === c) || {}).r, saran: c === 'PLB-01' ? 'Perbaiki; bebannya ikut naik bersama sabuk asap, jadi perlu dipantau sendiri' : 'Perbaiki dulu; di sini tidak ada stasiun lain yang bisa menggantikan' }));
    const avCl = sgRange(SG_CL.map(c => 100 * st[c].avail));
    return ph({ k: 'Analisis lanjutan · Teori permainan', h: 'Asap tidak mengenal batas provinsi: siapa harus bertindak, bersama siapa, dan siapa membayar?',
      lede: `Enam kota di Sumatera dan Kalimantan menghirup asap yang naik dan turun di hari yang sama, jadi halaman ini memperlakukannya sebagai <b>permainan</b>: siapa untung bila bertindak, mengapa tidak ada yang mau mulai, dan aturan apa yang membuat semua bergerak. <span class="muted-s">Jendela tetap 1 Agu–14 Okt 2026; filter di atas tidak memengaruhi halaman ini.</span>` }) +
      `<div class="kpis k4">${[
        kpi({ l: 'Jeda antarkota', ic: 'clock', v: '0', u: 'hari', c: `Keenam kota mulai naik pada <b>${onsetTxt}</b> di 2024, 2025, dan 2026`, color: cv('--k-gambut'), go: '#/strategi?sec=serentak',
          info: { rumus: 'Tanggal mulai = hari pertama sejak 1 Juli dengan 3 hari berturut-turut PM2.5 > 2× median Jan–Jun tahun itu. Uji jeda: perubahan harian tiap pasangan stasiun, jeda −5..+5 hari.', data: 'pm25 harian 6 stasiun, 2024–2026', filter: false, cat: `Puncak kecocokan di jeda 0 hari untuk ${lag0} dari ${C.pairs.length} pasangan.` } }),
        kpi({ l: 'Kasus pernapasan berlebih', ic: 'heart', v: fi(C.exc.resp), c: `6 RS sabuk asap, 1 Agu–14 Okt 2026 · balita ${fi(C.exc.u5)} · kematian ${fi(C.exc.death)}`, color: cv('--ispu-4'),
          info: { rumus: 'Σ (kasus harian − kasus normal RS itu). Kasus normal = rata-rata kasus pada hari PM2.5 stasiun pasangannya ≤ persentil-25.', data: 'HLT-01 RS-XXX-10, 11, 12, 13, 19, 20', filter: false } }),
        kpi({ l: 'Bisa dihindari bila bersama', ic: 'bulb', v: fi(C.sumB), c: 'kasus pernapasan, bila keenam kota menurunkan lonjakan asapnya separuh', color: cv('--ok'), go: '#/strategi?sec=dilema',
          info: { rumus: 'Per RS: Σ 0,5 × kemiringan × (PM2.5 − PM2.5 hari normal). Kemiringan = tambahan kasus per µg/m³, dihitung dari data 2024–2025.', data: 'pm25 harian + HLT-01', filter: false, cat: 'Skenario perhitungan, bukan prediksi kebijakan.' } }),
        kpi({ l: 'Saling bantu sesama sabuk', ic: 'warn', v: fi(100 * pc.club.gain), u: '%', c: 'puncak beban tidak turun sama sekali, karena keenam RS penuh di hari yang sama', color: cv('--bad'), go: '#/strategi?sec=kembaran',
          info: { rumus: '1 − puncak(Σ kasus berlebih) ÷ Σ puncak kasus berlebih tiap RS.', data: 'HLT-01, 1 Agu–14 Okt 2026', filter: false } }),
      ].join('')}</div>` +

      secH('serentak', '1 · Satu musim asap', 'Enam kota naik dan turun di hari yang sama, setiap tahun',
        `Asap di Sumbar, Riau, Jambi, Kepri, Kalbar, dan Kalteng melompat bersamaan pada <b>${onsetTxt}</b> di tiga tahun berturut-turut, dan lonjakan Oktober 2026 juga dimulai serentak. Jakarta dan Yogyakarta tetap tenang.`) +
      `<div class="grid">
      ${card({ id: 'sync', span: 's8', h: 'h440', title: 'PM2.5 harian, Juli–November', sub: 'Pilih tahun untuk melihat pola yang sama berulang. Garis putus abu-abu = kota pembanding.',
        ctrl: seg('sgy', SG_YRS.map(y => [y, y]), this._y), legend: legCl,
        table: () => { const y = this._y, i0 = dayIdx(y + '-07-01'), i1 = Math.min(dayIdx(y + '-11-15'), ND - 1), r = []; for (let i = i0; i <= i1; i++) { const o = { tgl: fd(i) }; SG_CL.concat(['JKT-01', 'YKY-01']).forEach(c => o[c] = D.pm25[c][i]); r.push(o); }
          return { cols: [{ k: 'tgl', l: 'Tanggal' }].concat(SG_CL.concat(['JKT-01', 'YKY-01']).map(c => ({ k: c, l: c, num: 1, fmt: v => f(v, 0) }))), rows: r }; },
        info: { rumus: 'Rata-rata PM2.5 harian (hari sah ≥ 18 jam).', data: 'pm25 harian', filter: false, cat: `Kemiripan harian keenam kota per musim: 2024 ${f(sgRange(C.yrR[2024])[0], 2)}–${f(sgRange(C.yrR[2024])[1], 2)}, 2025 ${f(sgRange(C.yrR[2025])[0], 2)}–${f(sgRange(C.yrR[2025])[1], 2)}, 2026 ${f(sgRange(C.yrR[2026])[0], 2)}–${f(sgRange(C.yrR[2026])[1], 2)} (1 = identik).` } })}
      ${card({ id: 'rise', span: 's4', h: 'h440', title: 'Kenaikan PM2.5, 8 → 14 Okt 2026', sub: 'Hanya enam kota sabuk asap yang naik. Kota lain hampir tidak berubah.',
        table: () => ({ cols: [{ k: 'code', l: 'Stasiun' }, { k: 'kota', l: 'Lokasi' }, { k: 'v', l: 'Kenaikan µg/m³', num: 1, fmt: v => f(v, 0) }], rows: C.rise.slice().sort((a, b) => b.v - a.v).map(r => ({ _st: r.c, code: r.c, kota: BY[r.c].kota, v: r.v })) }),
        info: { rumus: 'PM2.5 harian 14 Okt − 8 Okt 2026.', data: 'pm25 harian', filter: false, cat: 'KTG-01/02, MDN-01, SM2-01 tidak punya data di salah satu tanggal.' } })}
      ${card({ id: 'two', span: 's12', h: 'h380', title: 'Dua jenis udara buruk: kronis dan musiman', sub: 'Rata-rata PM2.5 bulanan. Marunda (JKT-02) selalu di atas baku 24 jam 55. Palangka Raya (KTG-01) rendah di luar musim dan melonjak saat kemarau (blok oranye muda, Juli–Oktober).',
        legend: `<span><i class="line" style="background:var(--k-industri)"></i>JKT-02 Marunda</span><span><i class="line" style="background:var(--k-gambut)"></i>KTG-01 Palangka Raya</span>`,
        note: `Marunda tidak punya musim: tetap sekitar 58–64 sepanjang tahun karena sumbernya (industri dan lalu lintas) menyala terus. Palangka Raya biasanya 20–25, puncak musim sekitar <b>58</b> (2024) dan <b>125</b> (2025). Angka <b>850 µg/m³</b> di Oktober 2026 adalah lonjakan anomali, bukan kelanjutan tren dua tahun sebelumnya. Itu sebabnya halaman ini fokus pada sabuk asap musiman, sedangkan masalah kronis seperti Marunda butuh penanganan sumber emisi.`,
        info: { rumus: 'Rata-rata bulanan dari hari sah.', data: 'pm25 harian', filter: false, cat: 'Tidak ikut filter pulau/tipe agar perbandingan tetap terlihat.' } })}
      </div>
      <div class="note"><b>Artinya bagi kita:</b> tidak ada waktu menunggu asap "datang" dari provinsi lain. Begitu satu kota naik, kota lain sudah naik hari itu juga, jadi peringatan dan aksi harus dikirim ke keenam provinsi sekaligus. Data ini menunjukkan lonjakan terjadi bersamaan, bukan provinsi mana yang menyebabkan provinsi lain.</div>` +

      secH('dilema', '2 · Permainan pertama: dilema asap bersama', 'Bertindak sendirian hanya menyelamatkan sebagian; sisanya dinikmati tetangga',
        `Bila keenam provinsi menurunkan lonjakan asapnya separuh, <b>${fi(C.sumB)} kasus pernapasan</b> terhindar. Satu provinsi yang bergerak sendiri hanya menikmati sebagian manfaat di RS-nya sendiri, sehingga setiap provinsi tergoda menunggu yang lain. Kalau semua menunggu, tidak ada kasus yang terhindar.`) +
      `<div class="grid">
      ${card({ id: 'coal', span: 's7', title: 'Coba sendiri: provinsi mana yang bertindak?', sub: 'Skenario = seberapa besar asap di tiap kota berasal dari wilayahnya sendiri (data tidak bisa memastikannya, jadi ada tiga pilihan).',
        ctrl: `<div class="seg tg" role="group" aria-label="Provinsi yang bertindak">${chips}</div><button type="button" class="linkbtn" id="sgAll">Semua bertindak</button><button type="button" class="linkbtn" id="sgNone">Kosongkan</button>${seg('sgs', Object.entries(SG_SC).map(([k, v]) => [k, v[1]]), this._s)}`,
        body: `<div id="coal-wrap"><div class="sg-stat"><span><b class="big cu">${fi(tot)}</b> kasus terhindar</span><span>dari ${fi(C.sumB)} yang mungkin (${f(100 * tot / C.sumB, 0)}%)</span><span>${this._K.size} dari 6 provinsi bertindak</span></div><div class="chart h380" id="coal" role="img" aria-label="Kasus terhindar per RS"></div></div>`,
        legend: '<span><i style="background:var(--brand)"></i>Dari tindakan provinsi sendiri</span><span><i style="background:var(--k-kota)"></i>Dari tindakan provinsi tetangga</span><span><i style="background:var(--surface-3);outline:1px solid var(--line-2)"></i>Belum terhindar</span>',
        table: () => ({ cols: [{ k: 'p', l: 'RS di provinsi' }, { k: 'own', l: 'Dari tindakan sendiri', num: 1, fmt: fi }, { k: 'nb', l: 'Dari tetangga', num: 1, fmt: fi }, { k: 'tot', l: 'Total terhindar', num: 1, fmt: fi }, { k: 'B', l: 'Bila semua bertindak', num: 1, fmt: fi }],
          rows: sgCoal(this._K, SG_SC[this._s][0]).map(r => ({ _st: r.c, p: sgNm(r.c), own: r.own, nb: r.nb, tot: r.tot, B: r.B })) }),
        info: { t: 'Cara menghitung', rumus: 'Manfaat di RS j = (kasus terhindar di j bila semua bertindak) × [porsi lokal bila provinsi j ikut + (1 − porsi lokal) × jumlah provinsi yang bertindak ÷ 6].', data: 'pm25 harian + HLT-01 6 RS sabuk asap', filter: false,
          cat: `Sebagian asap di tiap kota berasal dari udara regional bersama. Porsinya tidak bisa diukur dari data, jadi kami tampilkan tiga skenario (lokal 10%, 40%, 70%). Petunjuk dari data: bagian naik-turun harian yang khas milik satu kota saja hanya ${f(100 * uq[0], 0)}–${f(100 * uq[1], 0)}%.` } })}
      ${card({ id: 'dil', span: 's5', h: 'h440', title: 'Mengapa tidak ada yang mau mulai', sub: `Kasus terhindar di RS provinsi sendiri: bila bertindak sendirian vs bila keenamnya bertindak (skenario "${SG_SC[this._s][1].toLowerCase()}").`,
        legend: '<span><i style="background:var(--div-mid)"></i>Sendirian</span><span><i style="background:var(--ok)"></i>Bersama</span>',
        table: () => ({ cols: [{ k: 'p', l: 'Provinsi' }, { k: 'a', l: 'Sendirian', num: 1, fmt: fi }, { k: 'b', l: 'Bersama', num: 1, fmt: fi }, { k: 'x', l: 'Kelipatan', num: 1, fmt: v => f(v, 2) + '×' }],
          rows: SG_CL.map(c => ({ _st: c, p: sgNm(c), a: st[c].B * sgAloneF(SG_SC[this._s][0]), b: st[c].B, x: 1 / sgAloneF(SG_SC[this._s][0]) })) }),
        note: `Untuk usaha yang sama, setiap provinsi mendapat <b>${f(mult, 1)}× manfaat</b> di RS-nya sendiri bila bergerak bersama. Selama biaya tindakan suatu provinsi berada di antara batang abu-abu dan hijau, bertindak sendirian terasa rugi padahal bertindak bersama untung. Itulah dilemanya: hasil terbaik untuk semua (${fi(C.sumB)} kasus) tidak tercapai bila tiap provinsi memutuskan sendiri (0 kasus).`,
        info: { rumus: 'Sendirian = kasus terhindar bila semua bertindak × [porsi lokal + (1 − porsi lokal) ÷ 6]. Bersama = kasus terhindar bila semua bertindak.', data: 'pm25 harian + HLT-01', filter: false, cat: 'Biaya tindakan tidak ada di data, jadi manfaat diukur dalam kasus terhindar. Kelipatan: 4× (lokal 10%), 2× (40%), 1,3× (70%); hanya bila asap 100% lokal tidak ada dilema.' } })}
      </div>
      <div class="note"><b>Artinya bagi kita:</b> koordinasi antarprovinsi (waktu larangan pembakaran, patroli, pemadaman) memberi hasil jauh lebih besar daripada upaya masing-masing. Ini skenario perhitungan, bukan prediksi kebijakan; biaya pelaksanaan tidak ada dalam data.</div>` +

      secH('aturan', '3 · Aturan main', 'Tiga aturan agar setiap provinsi mau bergerak',
        'Dilema seperti ini tidak selesai dengan imbauan. Yang dibutuhkan adalah aturan main yang membuat bergerak bersama lebih menguntungkan daripada menunggu, untuk setiap provinsi.') +
      `<div class="grid">
      ${card({ id: 'shap', span: 's5', h: 'h380', title: 'Iuran dana bersama yang adil', sub: `Bagian iuran tiap provinsi = bagian manfaat yang ditimbulkan tindakannya bagi seluruh kawasan (skenario "${SG_SC[this._s][1].toLowerCase()}").`,
        table: () => ({ cols: [{ k: 'p', l: 'Provinsi' }, { k: 'v', l: 'Bagian iuran', num: 1, fmt: v => f(100 * v, 1) + '%' }], rows: shp.map(r => ({ _st: r.c, p: sgNm(r.c), v: r.v })) }),
        info: { rumus: 'Bagian = [porsi lokal × kasus terhindar di RS sendiri + (1 − porsi lokal) ÷ 6 × total kasus terhindar] ÷ total kasus terhindar. Ini cara pembagian yang adil menurut sumbangan tiap pemain (lihat Metodologi).', data: 'pm25 harian + HLT-01', filter: false,
          cat: 'Makin regional asapnya, makin rata pembagiannya; makin lokal, makin besar bagian provinsi dengan beban RS terbesar.' } })}
      ${card({ id: 'rules', span: 's7', title: 'Aturan main yang kami usulkan', body: `<ol class="sg-rules">
        <li><b>Satu pemicu untuk enam provinsi.</b> Keenam kota naik di hari yang sama, jadi cukup satu angka bersama (misalnya rata-rata PM2.5 keenam stasiun di atas 55 µg/m³ dua hari berturut-turut) untuk memulai aksi serentak: larangan bakar, patroli, dan pemadaman. Provinsi yang tidak bergerak langsung terlihat.</li>
        <li><b>Dana bersama dengan iuran sesuai manfaat.</b> Provinsi yang paling diuntungkan membayar lebih (grafik di kiri). Dengan begitu tidak ada provinsi yang menanggung biaya untuk manfaat yang dinikmati tetangganya.</li>
        <li><b>Perjanjian tahunan, bukan sekali jalan.</b> Musim asap datang setiap ${onsetTxt} (3 dari 3 tahun), sehingga kesepakatan bisa diteken sebelum Juli dan dinilai setiap November lewat rapor bersama. Karena "permainan" ini berulang tiap tahun, provinsi yang ingkar tahun ini menanggung akibatnya tahun depan.</li></ol>` })}
      </div>` +

      secH('kembaran', '4 · Permainan kedua: saling bantu antar-RS', 'Sesama RS di sabuk asap tidak bisa saling menolong, karena semuanya penuh di hari yang sama',
        `Pada ${sgD(pc.club.peakDay)} 2026, enam RS sabuk asap menampung <b>${f(pc.club.peak, 1)}×</b> kasus pernapasan hari normal mereka. Berbagi tenaga atau stok di antara mereka tidak menurunkan puncak sama sekali. Mitra yang berguna adalah RS di luar sabuk yang bebannya tidak ikut naik.`) +
      `<div class="grid">
      ${card({ id: 'pool', span: 's7', h: 'h380', title: 'Beban gabungan dibanding hari normal', sub: 'Kasus pernapasan gabungan ÷ kasus normal gabungan, untuk tiga pilihan koalisi. Makin rendah garisnya, makin ringan beban yang ditanggung bersama.',
        legend: `<span><i class="line" style="background:var(--bad)"></i>Hanya 6 RS sabuk asap (puncak ${f(pc.club.peak, 1)}×)</span><span><i class="line" style="background:var(--warn)"></i>+ 7 RS terdekat di luar sabuk (${f(pc.dekat.peak, 1)}×)</span><span><i class="line" style="background:var(--ok)"></i>+ semua RS di luar sabuk (${f(pc.semua.peak, 1)}×)</span>`,
        table: () => ({ cols: [{ k: 't', l: 'Tanggal' }, { k: 'a', l: 'Sabuk saja', num: 1, fmt: v => f(v, 2) }, { k: 'b', l: '+ terdekat', num: 1, fmt: v => f(v, 2) }, { k: 'c', l: '+ semua', num: 1, fmt: v => f(v, 2) }], rows: C.days.map((d, i) => ({ t: fd(d), a: pc.club.ratio[i], b: pc.dekat.ratio[i], c: pc.semua.ratio[i] })) }),
        info: { rumus: 'Rasio = Σ kasus pernapasan harian ÷ Σ kasus normal RS dalam koalisi.', data: `RS terdekat: ${SG_NEAR.map(stShort).join(', ')}. KTG-01/02 tidak dipakai sebagai mitra karena punya episode asap sendiri.`, filter: false,
          cat: `Puncak beban turun ${f(100 * pc.dekat.gain, 0)}% (koalisi terdekat) dan ${f(100 * pc.semua.gain, 0)}% (semua) dibanding menanggung sendiri-sendiri; di antara 6 RS sabuk: ${f(100 * pc.club.gain, 0)}%.` } })}
      ${card({ id: 'partner', span: 's5', h: 'h440', title: 'Siapa mitra yang baik?', sub: 'Seberapa mirip naik-turun kasus berlebih tiap RS dengan beban gabungan sabuk asap. Mendekati 0 atau negatif = mitra baik, karena bebannya tidak ikut naik.',
        table: () => ({ cols: [{ k: 'code', l: 'Stasiun/RS' }, { k: 'kota', l: 'Lokasi' }, { k: 'r', l: 'Kemiripan', num: 1, fmt: v => f(v, 2) }, { k: 'b0', l: 'Kasus normal/hari', num: 1, fmt: v => f(v, 0) }], rows: C.partner.map(p => ({ _st: p.c, code: p.c, kota: BY[p.c].kota, r: p.r, b0: p.b0 })) }),
        info: { rumus: 'Korelasi kasus pernapasan berlebih harian RS itu dengan jumlah kasus berlebih 6 RS sabuk, 1 Agu–14 Okt 2026.', data: 'HLT-01', filter: false } })}
      </div>
      <div class="note"><b>Artinya bagi kita:</b> setiap RS sabuk asap perlu <b>RS kembaran</b> di luar sabuk yang mengirim tenaga, oksigen, nebulizer, dan masker begitu pemicu bersama menyala. Usulan pasangan: RS Sumbar, Riau, Jambi, dan Kepri dengan RS Medan, Aceh, dan Bengkulu; RS Kalbar dan Kalteng dengan RS Banjarbaru, Samarinda, dan Sulawesi. Yang dipindahkan adalah sumber daya, bukan pasien antarpulau. Palembang <b>bukan</b> mitra yang baik karena bebannya ikut naik (kemiripan ${f((C.partner.find(p => p.c === 'PLB-01') || {}).r, 2)}).</div>` +

      secH('sensor', '5 · Sensor', 'Untuk pemicu bersama, satu sensor sabuk asap sudah cukup; uangnya lebih berguna untuk sensor yang hilang saat musim asap', '') +
      `<div class="grid">
      ${card({ id: 'sens', span: 's12', title: 'Sensor yang perlu diperbaiki sebelum musim asap berikutnya', sub: `Keenam stasiun sabuk asap saling mirip dan datanya tersedia ${f(avCl[0], 0)}–${f(avCl[1], 0)}% pada Agu–Okt, jadi menambah stasiun di antaranya bernilai kecil. Masalahnya ada di luar sabuk.`,
        body: `<div class="tbl-wrap" style="max-height:none">${tableHTML({ cols: [{ k: 'code', l: 'Stasiun' }, { k: 'kota', l: 'Lokasi' }, { k: 'av', l: 'Data tersedia Agu–Okt', num: 1, fmt: v => f(v, 0) + '%' }, { k: 'saran', l: 'Saran' }], rows: sensRows }, true)}</div>`,
        table: () => ({ cols: [{ k: 'code', l: 'Stasiun' }, { k: 'kota', l: 'Lokasi' }, { k: 'av', l: 'Data tersedia Agu–Okt (%)', num: 1, fmt: v => f(v, 0) }, { k: 'saran', l: 'Saran' }], rows: sensRows }),
        note: 'KTG-01 dan KTG-02 memberi sinyal kembar; rinciannya di kartu "Sinyal duplikat" pada <a href="#/t5">Langkah 5</a>.',
        info: { rumus: 'Persen hari sah (≥ 18 jam) pada Agustus–Oktober 2024–2026.', data: 'pm25 harian', filter: false } })}
      </div>` +

      secH('solusi', '6 · Solusi', 'Tiga langkah yang kami rekomendasikan', '') +
      `<div class="grid">
      ${card({ id: 'sgrec', span: 's7', title: 'Rekomendasi', body: `<ol class="sg-rules">
        <li><b>Bentuk pakta asap enam provinsi</b> dengan satu pemicu bersama, aksi serentak di hari yang sama, dan dana bersama yang iurannya sesuai manfaat. Diteken sebelum Juli, dinilai setiap November.</li>
        <li><b>Pasangkan setiap RS sabuk asap dengan RS kembaran di luar sabuk</b> untuk kiriman tenaga, oksigen, dan alat saat pemicu menyala. Siagakan sejak lonjakan awal, karena kasus naik di hari yang sama dengan asap.</li>
        <li><b>Perbaiki sensor yang hilang saat musim asap</b> (SM2-01, MDN-01, BJB-01, PLB-01) sebelum menambah stasiun baru di sabuk asap.</li></ol>
        <div class="acts" style="margin-top:12px"><a class="btn" href="#/rekomendasi">Lihat semua rekomendasi ${IC.arrow}</a></div>` })}
      ${card({ id: 'yakin', span: 's5', title: 'Mengapa kami yakin', body: `<ol class="sg-rules">
        <li><b>Bukan kebetulan satu tahun.</b> Keenam kota naik serempak di tiga musim berbeda, dan untuk ${lag0} dari ${C.pairs.length} pasangan kota kecocokan tertinggi ada di hari yang sama (kemiripan perubahan harian ${f(rr[0], 2)}–${f(rr[1], 2)}).</li>
        <li><b>Kasus RS mengikuti asap, bukan musim.</b> Saat asap di Pekanbaru turun mendadak pada 8 Okt 2026 (${f(C.pku.pm[0], 0)} → ${f(C.pku.pm[1], 0)} µg/m³), kasus RS hari itu juga turun (${fi(C.pku.rs[0])} → ${fi(C.pku.rs[1])}). Saat musim asap mulai, kasus RS Pekanbaru naik ${f(C.pkuStep.pre, 0)} → ${f(C.pkuStep.post, 0)} per hari, sedangkan RS Jakarta yang udaranya tidak berubah tetap ${f(C.jkt.pre, 0)} → ${f(C.jkt.post, 0)}.</li>
        <li><b>Arah kesimpulan tidak bergantung pada asumsi.</b> Di ketiga skenario, bertindak bersama selalu lebih untung daripada sendirian; yang berubah hanya besar kelipatannya (1,3–4×).</li></ol>` })}
      </div>
      <p class="sg-foot">Data sintetis: temuan berlaku untuk data ini, bukan klaim dunia nyata. Data menunjukkan lonjakan terjadi bersamaan, bukan provinsi mana yang menyebabkan provinsi lain. Rumus lengkap ada di <a href="#/metodologi">Metodologi</a>.</p>`;
  },
  mount(C0) {
    const C = sgCalc(), st = C.st, s = SG_SC[this._s][0];
    bindSeg(C0, 'sgy', v => { this._y = +v; this.drawSync(); });
    bindSeg(C0, 'sgs', v => { this._s = v; render(false); });
    C0.querySelectorAll('[data-tg]').forEach(b => b.onclick = () => { const c = b.dataset.tg; this._K.has(c) ? this._K.delete(c) : this._K.add(c); render(false); });
    C0.querySelector('#sgAll').onclick = () => { this._K = new Set(SG_CL); render(false); };
    C0.querySelector('#sgNone').onclick = () => { this._K = new Set(); render(false); };
    this.drawSync();
    // dua jenis udara buruk (dipindah dari Overview)
    const lm = MONTHS.map((_, m) => fmShort(m));
    mk('two', { grid: { left: 40, right: 64, top: 20, bottom: 26 }, tooltip: { trigger: 'axis', valueFormatter: v => f(v) + ' µg/m³' },
      xAxis: ax({ type: 'category', data: lm, boundaryGap: false, axisLabel: { color: cv('--muted'), fontSize: 11, interval: 11 } }), yAxis: ax({ type: 'value', name: 'µg/m³', nameGap: 6 }),
      series: [['JKT-02', '--k-industri'], ['KTG-01', '--k-gambut']].map(([c, v]) => ({ name: c, type: 'line', data: D.mon[c].pm25, symbol: 'none', lineStyle: { width: 2.2, color: cv(v) },
        endLabel: { show: true, formatter: c, color: cv('--ink-2'), fontSize: 11 } })).concat([{ type: 'line', data: [], markLine: (m => { m.label.position = 'insideStartTop'; m.label.offset = [0, -26]; return m; })(mlBaku(BAKU, 'baku 24 jam ' + BAKU)),
        markArea: { silent: true, itemStyle: { color: cv('--k-gambut'), opacity: .1 }, label: { color: cv('--k-gambut'), fontSize: 10, fontWeight: 600, position: 'insideTop', fontFamily: FONT },
          data: [[6, 9], [18, 21], [30, 33]].map(([x0, x1], i) => [{ xAxis: x0, name: i === 2 ? 'Kemarau' : '' }, { xAxis: x1 }]) } }]) });
    // kenaikan 8→14 Okt
    const rr = C.rise.slice().sort((a, b) => a.v - b.v);
    mk('rise', { grid: { left: 8, right: 44, top: 6, bottom: 16, containLabel: true }, tooltip: { formatter: p => `<b>${rr[p.dataIndex].c}</b> ${esc(BY[rr[p.dataIndex].c].kota)}<br>Naik <b>${f(p.value, 0)}</b> µg/m³` },
      xAxis: ax({ type: 'value', name: 'µg/m³', nameLocation: 'end' }), yAxis: ax({ type: 'category', data: rr.map(r => r.c), splitLine: { show: false }, axisLabel: { color: cv('--ink-2'), fontSize: 10.5, interval: 0 } }),
      series: [{ type: 'bar', barWidth: '62%', data: rr.map(r => ({ value: r.v, itemStyle: { color: cv(SG_COL[r.c] || '--div-mid') } })),
        label: { show: true, position: 'right', formatter: p => Math.abs(p.value) >= 20 ? (p.value > 0 ? '+' : '') + f(p.value, 0) : '', color: cv('--ink'), fontSize: 11, fontWeight: 700 } }] }, p => go('stasiun', { st: rr[p.dataIndex].c }));
    // koalisi
    const rows = sgCoal(this._K, s), nm = rows.map(r => sgNm(r.c));
    const bar = (name, key, col) => ({ name, type: 'bar', stack: 'a', barWidth: '58%', data: rows.map(r => key === 'rest' ? Math.max(0, r.B - r.tot) : r[key]), itemStyle: { color: col, borderRadius: 0 } });
    mk('coal', { grid: { left: 8, right: 54, top: 6, bottom: 20, containLabel: true },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: ps => { const r = rows[ps[0].dataIndex]; return `<b>${esc(sgNm(r.c))}</b> · ${esc(BY[r.c].rs_nama)}<br>Dari tindakan sendiri: <b>${fi(r.own)}</b><br>Dari tindakan tetangga: <b>${fi(r.nb)}</b><br>Total terhindar: <b>${fi(r.tot)}</b> dari ${fi(r.B)} kasus`; } },
      xAxis: ax({ type: 'value', name: 'kasus', nameLocation: 'end', max: v => Math.ceil(v.max / 500) * 500 }), yAxis: ax({ type: 'category', data: nm, inverse: true, splitLine: { show: false }, axisLabel: { color: cv('--ink-2'), fontSize: 11.5, interval: 0 } }),
      series: [bar('Dari tindakan sendiri', 'own', cv('--brand')), bar('Dari tetangga', 'nb', cv('--k-kota')),
        Object.assign(bar('Belum terhindar', 'rest', cv('--surface-3')), { label: { show: true, position: 'right', formatter: p => fi(rows[p.dataIndex].tot), color: cv('--ink'), fontWeight: 700, fontSize: 11.5 } })] });
    // dilema: sendirian vs bersama
    const a = sgAloneF(s);
    mk('dil', { grid: { left: 8, right: 14, top: 20, bottom: 20, containLabel: true }, tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: ps => { const c = SG_CL[ps[0].dataIndex]; return `<b>${esc(sgNm(c))}</b><br>Sendirian: <b>${fi(st[c].B * a)}</b> kasus di RS sendiri<br>Bersama: <b>${fi(st[c].B)}</b> kasus (${f(1 / a, 1)}×)`; } },
      xAxis: ax({ type: 'category', data: SG_CL.map(c => SG_PROV[c]), splitLine: { show: false }, axisLabel: { color: cv('--ink-2'), fontSize: 11, interval: 0 } }), yAxis: ax({ type: 'value', name: 'kasus terhindar' }),
      series: [{ name: 'Sendirian', type: 'bar', barGap: '8%', data: SG_CL.map(c => st[c].B * a), itemStyle: { color: cv('--div-mid') } },
        { name: 'Bersama', type: 'bar', data: SG_CL.map(c => st[c].B), itemStyle: { color: cv('--ok') }, label: { show: true, position: 'top', formatter: p => fi(p.value), color: cv('--ink'), fontSize: 10.5, fontWeight: 700 } }] });
    // iuran adil
    const shp = SG_CL.map(c => ({ c, v: (s * st[c].B + (1 - s) / 6 * C.sumB) / C.sumB })).sort((x, y) => x.v - y.v);
    mk('shap', { grid: { left: 8, right: 48, top: 6, bottom: 16, containLabel: true }, tooltip: { formatter: p => `<b>${esc(sgNm(shp[p.dataIndex].c))}</b><br>Bagian iuran: <b>${f(100 * p.value, 1)}%</b>` },
      xAxis: ax({ type: 'value', max: 1, axisLabel: { formatter: v => f(100 * v, 0) + '%', color: cv('--muted'), fontSize: 11 } }), yAxis: ax({ type: 'category', data: shp.map(r => sgNm(r.c)), splitLine: { show: false }, axisLabel: { color: cv('--ink-2'), fontSize: 11.5, interval: 0 } }),
      series: [{ type: 'bar', barWidth: '58%', data: shp.map(r => ({ value: r.v, itemStyle: { color: cv(SG_COL[r.c]) } })), label: { show: true, position: 'right', formatter: p => f(100 * p.value, 0) + '%', color: cv('--ink'), fontWeight: 700, fontSize: 11.5 } }] });
    // beban gabungan
    const pc = C.pool, xl = C.days.map(fd);
    const ln = (name, g, col) => ({ name, type: 'line', showSymbol: false, data: pc[g].ratio, lineStyle: { width: 2.2, color: cv(col) }, itemStyle: { color: cv(col) } });
    mk('pool', { grid: { left: 8, right: 16, top: 26, bottom: 24, containLabel: true }, tooltip: { trigger: 'axis', formatter: ps => `<b>${ps[0].name}</b><br>` + ps.map(p => `${p.marker}${p.seriesName}: <b>${f(p.value, 1)}×</b>`).join('<br>') },
      xAxis: ax({ type: 'category', data: xl, boundaryGap: false, splitLine: { show: false }, axisLabel: { color: cv('--muted'), fontSize: 11, formatter: v => v.replace(/ \d{4}$/, '') } }),
      yAxis: ax({ type: 'value', name: '× hari normal', min: 0 }),
      series: [Object.assign(ln('Sabuk asap saja', 'club', '--bad'), { markLine: { silent: true, symbol: 'none', lineStyle: { color: cv('--muted'), type: [4, 4] }, label: { formatter: 'hari normal', color: cv('--muted'), fontSize: 10.5, position: 'insideEndTop' }, data: [{ yAxis: 1 }] } }),
        ln('+ RS terdekat', 'dekat', '--warn'), ln('+ semua RS luar sabuk', 'semua', '--ok')] });
    // mitra
    const pr = C.partner.slice().sort((x, y) => y.r - x.r);
    mk('partner', { grid: { left: 8, right: 40, top: 6, bottom: 16, containLabel: true }, tooltip: { formatter: p => { const r = pr[p.dataIndex]; return `<b>${r.c}</b> ${esc(BY[r.c].kota)}, ${esc(BY[r.c].prov)}<br>Kemiripan dengan beban sabuk: <b>${f(r.r, 2)}</b><br>Kasus normal: ${f(r.b0, 0)} per hari`; } },
      xAxis: ax({ type: 'value', min: -1, max: 1 }), yAxis: ax({ type: 'category', data: pr.map(r => r.c), splitLine: { show: false }, axisLabel: { color: cv('--ink-2'), fontSize: 10.5, interval: 0 } }),
      series: [{ type: 'bar', barWidth: '60%', data: pr.map(r => ({ value: r.r, itemStyle: { color: cv(r.r > .3 ? '--bad' : SG_NEAR.includes(r.c) ? '--ok' : '--div-mid') } })),
        label: { show: true, position: 'right', formatter: p => f(p.value, 2), color: cv('--ink-2'), fontSize: 10.5 } }] }, p => go('stasiun', { st: pr[p.dataIndex].c }));
    // lompat ke bagian (#/strategi?sec=...)
    const sec = new URLSearchParams((location.hash.split('?')[1]) || '').get('sec');
    if (sec) { history.replaceState(null, '', '#/strategi'); setTimeout(() => { const el = document.getElementById(sec); if (el) el.scrollIntoView({ block: 'start' }); }, 80); }   // setelah render() menggulir ke atas
  },
  drawSync() {
    const y = this._y, i0 = dayIdx(y + '-07-01'), i1 = Math.min(dayIdx(y + '-11-15'), ND - 1), xs = [];
    for (let i = i0; i <= i1; i++) xs.push(i);
    const ser = SG_CL.map(c => ({ name: sgNm(c), type: 'line', showSymbol: false, data: xs.map(i => D.pm25[c][i]), lineStyle: { width: 2, color: cv(SG_COL[c]) }, itemStyle: { color: cv(SG_COL[c]) } }));
    for (const c of ['JKT-01', 'YKY-01']) ser.push({ name: stShort(c) + ' (pembanding)', type: 'line', showSymbol: false, data: xs.map(i => D.pm25[c][i]), lineStyle: { width: 1.6, color: cv('--div-mid'), type: [4, 3] }, itemStyle: { color: cv('--div-mid') } });
    ser[0].markLine = { silent: true, symbol: 'none', lineStyle: { color: cv('--muted'), type: [3, 3] }, label: { formatter: '1 Agu', color: cv('--muted'), fontSize: 10.5, position: 'insideEndTop' }, data: [{ xAxis: fd(dayIdx(y + '-08-01')) }] };
    mk('sync', { grid: { left: 8, right: 16, top: 26, bottom: 24, containLabel: true },
      tooltip: { trigger: 'axis', formatter: ps => `<b>${ps[0].name}</b><br>` + ps.slice().sort((a, b) => (b.value ?? -1) - (a.value ?? -1)).map(p => `${p.marker}${esc(p.seriesName)}: <b>${f(p.value, 0)}</b>`).join('<br>') },
      xAxis: ax({ type: 'category', data: xs.map(fd), boundaryGap: false, splitLine: { show: false }, axisLabel: { color: cv('--muted'), fontSize: 11, formatter: v => v.replace(/ \d{4}$/, '') } }),
      yAxis: ax({ type: 'value', name: 'PM2.5 µg/m³' }), series: ser });
  },
};

/* teks untuk halaman Metodologi (istilah teknis boleh muncul di sini) */
function sgMethodHTML() {
  const C = sgCalc(), st = C.st, rr = sgRange(C.pairs.map(p => p.r)), uq = sgRange(Object.values(C.uniq)), yr = y => sgRange(C.yrR[y]).map(v => f(v, 2)).join('–');
  return `<dl class="deflist">
    <dt>Jendela</dt><dd>Tetap 1 Agu–14 Okt 2026 (${C.days.length} hari); filter global tidak berlaku. Pemain = enam pemerintah provinsi yang diwakili satu kota: ${SG_CL.map(c => `${SG_PROV[c]} (${c})`).join(', ')}. KTG-01/02 di Kalteng punya episode sendiri dan tidak ikut serempak.</dd>
    <dt>Kasus normal</dt><dd>Rata-rata kasus RS pada hari ketika PM2.5 stasiun pasangannya ≤ persentil-25 stasiun itu (seluruh periode). Kasus berlebih = Σ (kasus − kasus normal) dalam jendela: pernapasan ${fi(C.exc.resp)}, balita ${fi(C.exc.u5)}, kematian ${fi(C.exc.death)}.</dd>
    <dt>Keserempakan</dt><dd>Korelasi PM2.5 harian antar-6 stasiun, 1 Agu–14 Okt: 2024 ${yr(2024)}, 2025 ${yr(2025)}, 2026 ${yr(2026)}. Korelasi silang perubahan harian dengan jeda −5..+5 hari (tiga musim digabung): puncak di jeda 0 untuk ${C.pairs.filter(p => p.lag === 0).length}/${C.pairs.length} pasangan (r ${f(rr[0], 2)}–${f(rr[1], 2)}). Tanggal mulai musim (3 hari berturut > 2× median Jan–Jun): ${C.onsetSet.join(', ')} untuk semua kota dan tahun.</dd>
    <dt>Kasus terhindar</dt><dd>Kemiringan OLS kasus pernapasan ~ PM2.5 per RS, data 2024–2025 (${SG_CL.map(c => `${c} ${f(st[c].slope, 2)}`).join('; ')} kasus per µg/m³). B<sub>i</sub> = Σ 0,5 × kemiringan × max(0, PM2.5 − PM2.5 hari normal) dalam jendela 2026; Σ B = ${fi(C.sumB)}.</dd>
    <dt>Permainan 1</dt><dd>Permainan barang publik n = 6. Strategi: kendalikan (turunkan lonjakan separuh) atau diam. Manfaat di RS j bila koalisi K bertindak = B<sub>j</sub> × [s·1(j∈K) + (1−s)·|K|/6], dengan s = porsi lonjakan yang berasal dari wilayah sendiri. s tidak teridentifikasi dari data harian, jadi dipakai tiga skenario 0,1 / 0,4 / 0,7. Petunjuk: 1 − r² perubahan harian tiap kota terhadap rata-rata lima kota lain = ${f(100 * uq[0], 1)}–${f(100 * uq[1], 1)}%. Manfaat sendirian = B<sub>i</sub>(s + (1−s)/6); bersama = B<sub>i</sub>. Bila biaya c<sub>i</sub> berada di antara keduanya, "diam" adalah strategi dominan: kesetimbangan Nash = tidak ada yang bertindak (0 kasus), optimum sosial = ${fi(C.sumB)} kasus.</dd>
    <dt>Iuran adil</dt><dd>Nilai Shapley permainan koalisi v(K) = Σ<sub>j</sub> manfaat<sub>j</sub>(K) = s·Σ<sub>i∈K</sub>B<sub>i</sub> + (1−s)·|K|·ΣB/6. Karena v aditif, φ<sub>i</sub> = s·B<sub>i</sub> + (1−s)·ΣB/6, dan bagian iuran = φ<sub>i</sub>/ΣB.</dd>
    <dt>Permainan berulang</dt><dd>Musim asap mulai pada tanggal yang sama di 3/3 tahun, jadi permainan berulang tiap tahun. Kerja sama bisa dipertahankan dengan strategi balas-setimpal; ini dasar usulan perjanjian tahunan dengan rapor November.</dd>
    <dt>Permainan 2</dt><dd>Koalisi berbagi risiko antar-RS. Beban = Σ kasus pernapasan ÷ Σ kasus normal. Manfaat berbagi = 1 − puncak(Σ kasus berlebih) ÷ Σ puncak tiap RS: sabuk saja ${f(100 * C.pool.club.gain, 0)}%, + RS terdekat ${f(100 * C.pool.dekat.gain, 0)}%, + semua RS luar sabuk ${f(100 * C.pool.semua.gain, 0)}%. Mitra = RS non-sabuk; KTG-01/02 dikeluarkan.</dd>
    <dt>Diuji, tidak dipakai</dt><dd>Peringatan dini berbasis jeda antarprovinsi (tidak ada jeda: puncak selalu di hari yang sama). Nilai Shapley sensor untuk cakupan jaringan (hampir rata, ±4% per sensor, tidak informatif).</dd>
    <dt>Keterbatasan</dt><dd>Penyebab keserempakan (asap lintas batas atau cuaca yang sama memicu kebakaran serentak) tidak bisa dipisah dari data harian. Biaya tindakan tidak ada. Hubungan kasus–PM2.5 dianggap lurus dan merupakan asosiasi, bukan sebab-akibat murni; untuk KTB-01 hubungan ini kurang lurus. Logistik antarpulau tidak ada di data. Data sintetis.</dd>
    <dt>Reproduksi</dt><dd><code>js/strategi.js</code>: <code>sgCalc()</code> (semua statistik), <code>sgCoal(K, s)</code> (manfaat per RS untuk koalisi K), <code>sgMethodHTML()</code> (teks ini). Semua dihitung di peramban dari <code>window.DATA</code>.</dd></dl>`;
}
