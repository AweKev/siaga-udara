/* Analisis lanjutan: "Musim 2026 belum usai" (proyeksi sisa musim asap + jam aman).
   Dimuat setelah strategi.js (memakai sgCalc(), SG_CL, SG_PROV, SG_COL, sgNm, secH). Semua angka dihitung saat runtime dari window.DATA.
   Fungsi: prCalc() (statistik + proyeksi, di-cache), prScen(sc, lv) (satu skenario), prMethodHTML() (teks Metodologi). */
const PR_SC = { tepat: [0, 'Hujan tepat waktu', '--ok'], m20: [20, 'Hujan mundur 20 hari', '--warn'], m30: [30, 'Hujan mundur 30 hari', '--bad'] };
const PR_LV = { rata: 'Rata-rata 1–14 Okt', akhir: 'Level 14 Okt' };
const PR_MON = [['2026-06', 'Jun 2026 (di luar musim)'], ['2026-08', 'Agu 2026'], ['2026-10', 'Okt 2026']];
const PR_END = '12-31';   // sumbu proyeksi sampai 31 Des
const PR_CUT = .15;
const PR_H = [6, 18];     // jam aktivitas luar ruang yang dinilai (06:00–18:00)       // akhir musim: kasus berlebih < 15% level awal

let PRC = null;
function prCalc() {
  if (PRC) return PRC;
  const G = sgCalc(), st = G.st, OUT = ['resp', 'u5', 'death'];
  // kasus berlebih harian gabungan 6 RS sabuk asap (definisi sama dengan halaman Strategi bersama)
  const E = {}; for (const o of OUT) E[o] = Array.from({ length: ND }, (_, i) => sum(SG_CL.map(c => D.health[BY[c].rs][o][i] - st[c].base[o])));
  const beltPm = Array.from({ length: ND }, (_, i) => { const v = SG_CL.map(c => D.pm25[c][i]).filter(x => x != null); return v.length ? mean(v) : null; });
  const rng = (a, b) => { const r = []; for (let i = dayIdx(a); i <= Math.min(dayIdx(b), ND - 1); i++) r.push(i); return r; };
  const avg = (arr, a, b) => mean(rng(a, b).map(i => arr[i]).filter(v => v != null));
  const yrs = {};
  for (const y of SG_YRS) yrs[y] = { pm: avg(beltPm, y + '-08-01', y + '-10-14'), pmOct: avg(beltPm, y + '-10-01', y + '-10-14'), pmMax: Math.max(...rng(y + '-08-01', y + '-12-31').map(i => beltPm[i] ?? -1)),
    L: avg(E.resp, y + '-10-01', y + '-10-14'), toDate: sum(rng(y + '-08-01', y + '-10-14').map(i => E.resp[i])) };
  // sisa kasus di luar musim (1–31 Des) tidak terkait asap; dikurangkan agar yang diproyeksikan hanya bagian akibat asap
  for (const y of [2024, 2025]) yrs[y].T = avg(E.resp, y + '-12-01', y + '-12-31');
  const T = mean([2024, 2025].map(y => yrs[y].T));
  // pola penurunan 2024–2025: (kasus berlebih − sisa) setelah 14 Okt ÷ (rata-rata 1–14 Okt − sisa), dirata-rata dua tahun, dihaluskan 7 hari
  const K = dayIdx('2026-' + PR_END) - dayIdx('2026-10-15') + 1;
  const sm7 = a => a.map((_, k) => mean(a.slice(Math.max(0, k - 3), Math.min(a.length, k + 4))));
  const rel = y => Array.from({ length: K }, (_, k) => Math.max(0, (E.resp[dayIdx(y + '-10-15') + k] - yrs[y].T) / (yrs[y].L - yrs[y].T)));
  const r = sm7(Array.from({ length: K }, (_, k) => mean([2024, 2025].map(y => rel(y)[k]))));
  const endK = a => { const e = a.findIndex(v => v < PR_CUT); return e < 0 ? a.length : e; };   // hari pertama kasus berlebih (rata-rata 7 hari) turun di bawah 15% level awal
  const past = {}; for (const y of [2024, 2025]) past[y] = { end: dayIdx(y + '-10-15') + endK(sm7(rel(y))), season: 0 }; for (const y of [2024, 2025]) { const e = past[y].end; past[y].season = sum(rng(y + '-08-01', y + '-12-31').filter(i => i < e).map(i => E.resp[i])); }
  const i14 = dayIdx('2026-10-14'), i08 = dayIdx('2026-10-08'), w26 = rng('2026-10-01', '2026-10-14');
  const lv = { rata: yrs[2026].L - T, akhir: E.resp[i14] - T };
  const share = { u5: sum(w26.map(i => E.u5[i])) / sum(w26.map(i => E.resp[i])), death: sum(w26.map(i => E.death[i])) / sum(w26.map(i => E.resp[i])) };
  const ramp = (beltPm[i14] - beltPm[i08 + 1]) / (i14 - i08 - 1);
  const ktb7 = i => { const v = D.pm25['KTB-01'].slice(i - 6, i + 1).filter(x => x != null); return v.length >= 4 ? mean(v) : null; };   // rata-rata 7 hari
  const firstKtb = SG_YRS.find(y => rng(y + '-08-01', y + '-10-14').some(i => ktb7(i) > 55.4));
  const beds = sum(SG_CL.map(c => BY[c].rs_tt || 0));
  // jam aman: profil 24 jam bulan tertentu (data per jam, D.hm)
  const hm = (c, m) => D.hm[c][MONTHS.indexOf(m)];
  const jam = {}; for (const [m] of PR_MON) { jam[m] = {}; for (const c of SG_CL) jam[m][c] = hm(c, m); jam[m].all = Array.from({ length: 24 }, (_, h) => mean(SG_CL.map(c => hm(c, m)[h]))); }
  const jamRow = (c, m) => { const p = jam[m][c].slice(PR_H[0], PR_H[1] + 1), lo = Math.min(...p), hi = Math.max(...p); return { c, lo, hi, hLo: PR_H[0] + p.indexOf(lo), hHi: PR_H[0] + p.indexOf(hi), cut: 1 - lo / hi, ok: p.filter(v => v <= 55.4).length, n: p.length }; };   // hanya jam aktivitas
  PRC = { T, E, beltPm, yrs, r, K, past, lv, share, ramp, i14, i08, firstKtb, beds, jam, jamRow, b0: G.clubB0, exc: G.exc };
  return PRC;
}
/* satu skenario: sc = kunci PR_SC (jumlah hari hujan mundur), lv = titik awal */
function prScen(sc, lv) {
  const P = prCalc(), Dl = PR_SC[sc][0], L = P.lv[lv];
  const rel = Array.from({ length: P.K }, (_, k) => P.r[Math.max(0, k - Dl)]);
  const end = Math.max(0, rel.findIndex(v => v < PR_CUT)), resp = rel.map((v, k) => k < end ? L * v : 0);   // dihitung sampai akhir musim
  return { resp, add: { resp: sum(resp), u5: sum(resp) * P.share.u5, death: sum(resp) * P.share.death }, end: P.i14 + 1 + end, load: resp.map(v => (P.b0 + v) / P.b0) };
}

PAGES.proyeksi = {
  title: 'Musim 2026 belum usai', nav: 'Musim 2026 belum usai', group: 'Analisis lanjutan',
  html() {
    const P = prCalc(), Y = P.yrs;
    this._sc = this._sc || 'm20'; this._lv = this._lv || 'rata'; this._m = this._m || '2026-10'; this._c = this._c || 'all';
    const S0 = prScen(this._sc, this._lv), all = Object.keys(PR_SC).map(k => prScen(k, this._lv));
    const addR = [Math.min(...all.map(s => s.add.resp)), Math.max(...all.map(s => s.add.resp))];
    const endR = [Math.min(...all.map(s => s.end)), Math.max(...all.map(s => s.end))];
    const g1 = Y[2025].pm / Y[2024].pm - 1, g2 = Y[2026].pm / Y[2025].pm - 1;
    const endPast = [2024, 2025].map(y => sgD(P.past[y].end) + ' ' + y).join(' dan ');
    const okt = SG_CL.map(c => P.jamRow(c, '2026-10')), jun = SG_CL.map(c => P.jamRow(c, '2026-06'));
    const allO = P.jamRow('all', '2026-10'), allJ = P.jamRow('all', '2026-06'), allA = P.jamRow('all', '2026-08');
    const okNone = okt.filter(r => r.ok === 0).length, junBad = jun.filter(r => r.ok < r.n);
    const hh = h => String(h).padStart(2, '0') + ':00';
    const cityOpts = [['all', 'Rata-rata 6 kota']].concat(SG_CL.map(c => [c, SG_PROV[c]]));
    return ph({ k: 'Analisis lanjutan · Proyeksi', h: 'Musim asap 2026 belum usai: apa yang masih akan datang?',
      lede: `Data berhenti pada 14 Oktober 2026 di tengah lonjakan terparah dalam tiga tahun, sehingga halaman ini memproyeksikan sisa musim dengan pola penurunan 2024–2025 dan prakiraan BMKG bahwa musim hujan mundur 20–30 hari. <span class="muted-s">Filter di atas tidak memengaruhi halaman ini.</span>` }) +
      `<div class="kpis k4">${[
        kpi({ l: 'Musim makin parah', ic: 'fire', v: f(Y[2026].pm, 0), u: 'µg/m³', c: `rata-rata PM2.5 enam kota sabuk asap, 1 Agu–14 Okt · 2024 ${f(Y[2024].pm, 0)} → 2025 ${f(Y[2025].pm, 0)} (+${f(100 * g1, 0)}%) → 2026 (+${f(100 * g2, 0)}%)`, color: cv('--ispu-4'), go: '#/proyeksi?sec=musim',
          info: { rumus: 'Rata-rata harian PM2.5 keenam stasiun sabuk asap (stasiun tanpa data hari itu dilewati), lalu dirata-rata 1 Agu–14 Okt tiap tahun.', data: 'pm25 harian KTB-01, PKU-01, JMB-01, BTM-01, STG-01, PKN-01', filter: false } }),
        kpi({ l: 'Belum memuncak', ic: 'warn', v: f(P.beltPm[P.i14], 0), u: 'µg/m³', c: `rata-rata enam kota pada 14 Okt, hari terakhir data · naik sekitar ${f(P.ramp, 0)} µg/m³ per hari sejak 9 Okt`, color: cv('--bad'), go: '#/proyeksi?sec=musim',
          info: { rumus: 'Kenaikan rata-rata per hari = (PM2.5 14 Okt − 9 Okt) ÷ 5 hari.', data: 'pm25 harian 6 stasiun', filter: false, cat: `Puncak musim 2024 dan 2025 terjadi pada awal September; pada 2026 nilai tertinggi justru jatuh di hari terakhir data.` } }),
        kpi({ l: 'Kasus yang masih akan datang', ic: 'heart', v: fi(addR[0]) + '–' + fi(addR[1]), c: `kasus pernapasan berlebih setelah 14 Okt di 6 RS sabuk asap (tiga skenario) · sejauh ini ${fi(P.exc.resp)}`, color: cv('--ispu-4'), go: '#/proyeksi?sec=proyeksi',
          info: { rumus: 'Kasus berlebih harian = titik awal × pola penurunan 2024–2025, diperpanjang 0, 20, atau 30 hari. Dijumlah dari 15 Okt sampai akhir musim.', data: 'HLT-01 RS-XXX-10, 11, 12, 13, 19, 20', filter: false, cat: `Titik awal "${PR_LV[this._lv]}". Skenario perhitungan, bukan ramalan pasti.` } }),
        kpi({ l: 'Musim berakhir sekitar', ic: 'cal', v: sgD(endR[0]) + '–' + sgD(endR[1]), c: `2026, bila pola tahun lalu berulang · 2024 dan 2025 berakhir ${endPast}`, color: cv('--warn'), go: '#/proyeksi?sec=proyeksi',
          info: { rumus: 'Akhir musim = hari pertama kasus berlebih (rata-rata 7 hari, setelah dikurangi sisa di luar musim) turun di bawah 15% titik awal.', data: 'HLT-01', filter: false } }),
      ].join('')}</div>` +

      secH('musim', '1 · Musim terparah dalam tiga tahun', 'Setiap tahun lebih buruk, dan 2026 masih naik saat data berhenti',
        `Rata-rata asap di enam kota sabuk naik ${f(100 * g1, 0)}% dari 2024 ke 2025, lalu ${f(100 * g2, 0)}% lagi ke 2026. Puncak 2024 dan 2025 jatuh di awal September dan musim selesai pada awal November. Pada 2026 puncaknya belum terlihat: pada 14 Oktober rata-rata enam kota mencapai <b>${f(P.beltPm[P.i14], 0)} µg/m³</b>, kategori ${ISPU.find(x => P.beltPm[P.i14] <= x.max).l.toLowerCase()}.`) +
      `<div class="grid">
      ${card({ id: 'prpm', span: 's12', h: 'h380', title: 'PM2.5 rata-rata enam kota sabuk asap, Juli–Desember', sub: 'Tiga musim ditumpuk menurut tanggal. Garis vertikal = hari terakhir data (14 Okt 2026).',
        legend: `<span><i class="line" style="background:var(--div-mid)"></i>2024</span><span><i class="line" style="background:var(--k-kota)"></i>2025</span><span><i class="line" style="background:var(--bad)"></i>2026</span>`,
        table: () => { const r = []; for (let i = dayIdx('2026-07-01'); i <= dayIdx('2026-' + PR_END); i++) { const d = dayDate(i), md = '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0'); r.push({ t: sgD(i), a: P.beltPm[dayIdx('2024' + md)], b: P.beltPm[dayIdx('2025' + md)], c: i < ND ? P.beltPm[i] : null }); }
          return { cols: [{ k: 't', l: 'Tanggal' }, { k: 'a', l: '2024', num: 1, fmt: v => f(v, 0) }, { k: 'b', l: '2025', num: 1, fmt: v => f(v, 0) }, { k: 'c', l: '2026', num: 1, fmt: v => f(v, 0) }], rows: r }; },
        info: { rumus: 'Rata-rata PM2.5 harian keenam stasiun sabuk asap.', data: 'pm25 harian', filter: false, cat: `Kototabang (KTB-01), stasiun latar yang jauh dari sumber asap, baru melewati 55 µg/m³ pada musim ${P.firstKtb}.` } })}
      </div>` +

      secH('proyeksi', '2 · Proyeksi sisa musim', `Hingga ${f(100 * all[2].add.resp / (P.exc.resp + all[2].add.resp), 0)}% beban musim 2026 bisa jadi masih di depan`,
        `Pada 2024 dan 2025, ${(() => { const a = f(100 * (1 - Y[2024].toDate / P.past[2024].season), 0), b = f(100 * (1 - Y[2025].toDate / P.past[2025].season), 0); return a === b ? 'sekitar ' + a + '%' : a + '% dan ' + b + '%'; })()} kasus berlebih satu musim jatuh setelah 14 Oktober. Pada 2026 titik awalnya jauh lebih tinggi dan hujan diperkirakan datang lebih lambat. Pilih skenario untuk melihat berapa kasus yang masih akan datang.`) +
      `<div class="grid">
      ${card({ id: 'prj', span: 's8', h: 'h440', title: 'Kasus pernapasan berlebih per hari, 6 RS sabuk asap', sub: 'Garis tebal = data 2026. Garis putus = proyeksi tiga skenario; skenario terpilih ditebalkan. Garis tipis abu = 2024 dan 2025. Titik awal "rata-rata 1–14 Okt" sengaja hati-hati: lonjakan enam hari terakhir dianggap tidak bertahan.',
        ctrl: `<span class="ctrl"><span>Titik awal</span>${seg('prlv', Object.entries(PR_LV), this._lv)}</span><span class="ctrl"><span>Skenario</span>${seg('prsc', Object.entries(PR_SC).map(([k, v]) => [k, v[1]]), this._sc)}</span>`,
        legend: `<span><i class="line" style="background:var(--bad)"></i>2026 (data)</span>${Object.values(PR_SC).map(v => `<span><i class="line" style="background:var(${v[2]})"></i>${v[1]}</span>`).join('')}<span><i class="line" style="background:var(--div-mid)"></i>2024 / 2025</span>`,
        table: () => { const sc = Object.keys(PR_SC).map(k => prScen(k, this._lv)), r = []; for (let i = dayIdx('2026-08-01'); i <= dayIdx('2026-' + PR_END); i++) { const k = i - P.i14 - 1; r.push({ t: sgD(i), d: i <= P.i14 ? P.E.resp[i] : null, a: k >= 0 ? sc[0].resp[k] : null, b: k >= 0 ? sc[1].resp[k] : null, c: k >= 0 ? sc[2].resp[k] : null }); }
          return { cols: [{ k: 't', l: 'Tanggal' }, { k: 'd', l: 'Data 2026', num: 1, fmt: fi }].concat(Object.values(PR_SC).map((v, j) => ({ k: 'abc'[j], l: v[1], num: 1, fmt: fi }))), rows: r }; },
        info: { t: 'Cara memproyeksi', rumus: 'Pola = kasus berlebih harian setelah 14 Okt ÷ rata-rata 1–14 Okt tahun yang sama, dirata-rata 2024 dan 2025, dihaluskan 7 hari. Proyeksi = titik awal × pola. Hujan mundur D hari: pola ditahan di level awal selama D hari, baru kemudian turun.', data: 'HLT-01, enam RS sabuk asap', filter: false,
          cat: `Titik awal "rata-rata 1–14 Okt" = ${fi(P.lv.rata)} kasus/hari (hati-hati); "level 14 Okt" = ${fi(P.lv.akhir)} kasus/hari (bila lonjakan terakhir bertahan). 20–30 hari = prakiraan kemunduran musim hujan dari BMKG.` } })}
      ${card({ id: 'prtot', span: 's4', h: 'h440', title: 'Total kasus berlebih satu musim', sub: 'Agustus–Desember. Bagian gelap = sudah terjadi hingga 14 Okt; bagian terang = proyeksi.',
        legend: '<span><i style="background:var(--bad)"></i>Sudah terjadi</span><span><i style="background:color-mix(in srgb,var(--bad) 35%,transparent)"></i>Proyeksi</span><span><i style="background:var(--div-mid)"></i>Musim lalu</span>',
        table: () => ({ cols: [{ k: 'l', l: 'Musim' }, { k: 'a', l: 'Sudah terjadi', num: 1, fmt: fi }, { k: 'b', l: 'Proyeksi', num: 1, fmt: fi }, { k: 't', l: 'Total', num: 1, fmt: fi }],
          rows: [{ l: '2024', a: P.past[2024].season, b: 0, t: P.past[2024].season }, { l: '2025', a: P.past[2025].season, b: 0, t: P.past[2025].season }].concat(Object.keys(PR_SC).map(k => { const s = prScen(k, this._lv); return { l: '2026 · ' + PR_SC[k][1], a: P.exc.resp, b: s.add.resp, t: P.exc.resp + s.add.resp }; })) }),
        info: { rumus: 'Musim lalu: Σ kasus berlebih 1 Agu sampai akhir musim. 2026: kasus berlebih 1 Agu–14 Okt (data) + proyeksi sampai akhir musim.', data: 'HLT-01', filter: false } })}
      </div>
      <div class="grid">
      ${card({ id: 'prsum', span: 's12', title: `Skenario terpilih: ${PR_SC[this._sc][1].toLowerCase()} (titik awal ${PR_LV[this._lv].toLowerCase()})`,
        body: `<div class="sg-stat"><span><b class="big cu">${fi(S0.add.resp)}</b> kasus pernapasan berlebih lagi</span><span><b>${fi(S0.add.u5)}</b> di antaranya balita</span><span><b>${fi(S0.add.death)}</b> kematian berlebih</span><span>musim berakhir sekitar <b>${sgD(S0.end)} 2026</b></span><span>beban RS di awal proyeksi <b>${f(S0.load[0], 1)}×</b> hari normal</span></div>
          <p class="muted-s" style="margin:6px 0 0">Untuk perbandingan, seluruh musim 2025 menghasilkan ${fi(P.past[2025].season)} kasus berlebih, dan musim 2026 sampai 14 Okt sudah ${fi(P.exc.resp)}. Setiap hari pada titik awal ini, kasus pernapasan baru di enam RS setara ${f(100 * (P.b0 + P.lv[this._lv]) / P.beds, 0)}% dari total ${fi(P.beds)} tempat tidur mereka.</p>` })}
      </div>
      <div class="note"><b>Artinya bagi kita:</b> status siaga dan bantuan RS kembaran tidak boleh dicabut menurut kalender (awal November seperti tahun lalu). Cabut hanya setelah hujan benar-benar kembali dan PM2.5 bertahan di bawah 55 µg/m³ selama seminggu.</div>` +

      secH('konteks', '3 · Mengapa skenario mundur masuk akal', 'Data dan kondisi iklim nyata menunjuk ke arah yang sama', '') +
      `<div class="grid">
      ${card({ id: 'prctx', span: 's12', title: 'Dasar ilmiah dan prakiraan resmi', body: `<ol class="sg-rules">
        <li><b>Gambut terus terbakar sampai hujan kembali.</b> Field dkk. (2016, <i>PNAS</i>) menunjukkan kebakaran dan asap Indonesia sangat peka terhadap kemarau akibat El Niño. Gambut yang rusak membara di bawah permukaan sampai hujan musiman datang, dan pada tahun El Niño hujan itu datang lebih lambat.</li>
        <li><b>El Niño 2026 sangat kuat.</b> Prakiraan NOAA (Oktober 2026) menyebut El Niño memuncak pada Oktober–Desember 2026. BMKG memperkirakan awal musim hujan 2026/2027 mundur rata-rata 20–30 hari dari normalnya, akibat El Niño dan IOD positif yang terjadi bersamaan. Dua angka itu yang kami pakai sebagai skenario.</li>
        <li><b>Musim kebakaran bisa diramal jauh hari.</b> Spessa dkk. (2015) dan Shawki dkk. (2017) menunjukkan prakiraan curah hujan musiman memberi peringatan beberapa bulan sebelumnya untuk Kalimantan dan Sumatera. Usulan kami: pemicu siaga dan pencabutannya mengikuti prakiraan hujan, bukan tanggal kalender.</li>
        <li><b>Data panitia searah.</b> Tiap musim lebih parah dari sebelumnya, dan Kototabang, stasiun latar yang jauh dari sumber asap, baru tembus pada ${P.firstKtb}.</li></ol>
        <p class="muted-s" style="margin:12px 0 0">Data panitia sintetis. Konteks dunia nyata hanya dipakai untuk memilih panjang skenario (20 dan 30 hari), bukan untuk mengubah angka data. Rujukan lengkap ada di <a href="#/metodologi">Metodologi</a>.</p>` })}
      </div>` +

      secH('jamaman', '4 · Jam aman beraktivitas', `Di luar musim asap, menggeser jam sudah cukup. Selama musim asap, tidak ada jam yang aman`,
        `PM2.5 memuncak pukul ${hh(allJ.hHi)} dan paling rendah pukul ${hh(allJ.hLo)}. Pada Juni 2026, pagi hari di ${junBad.map(r => SG_PROV[r.c]).join(' dan ')} sudah melewati 55 µg/m³ sementara siangnya masih "sedang", jadi menggeser jam kegiatan benar-benar menolong. Selama musim asap, menggeser jam hanya mengurangi paparan sekitar ${f(100 * allA.cut, 0)}%, dan pada Oktober 2026 <b>${okNone} dari 6 kota</b> tidak punya satu jam pun (06:00–18:00) di bawah 55 µg/m³.`) +
      `<div class="grid">
      ${card({ id: 'jam', span: 's7', h: 'h380', title: 'PM2.5 per jam dalam sehari', sub: 'Rata-rata tiap jam pada bulan terpilih. Pita warna = kategori ISPU; di bawah garis 55 masih "sedang".',
        ctrl: `<span class="ctrl"><span>Bulan</span>${seg('prm', PR_MON, this._m)}</span><span class="ctrl"><span>Kota</span>${seg('prc', cityOpts, this._c)}</span>`,
        table: () => { const p = P.jam[this._m][this._c]; return { cols: [{ k: 'h', l: 'Jam' }, { k: 'v', l: 'PM2.5 µg/m³', num: 1, fmt: v => f(v, 0) }, { k: 'k', l: 'Kategori ISPU' }], rows: p.map((v, h) => ({ h: hh(h), v, k: ISPU.find(x => v <= x.max).l })) }; },
        info: { rumus: 'Rata-rata PM2.5 pada jam ke-h selama bulan itu (data per jam setelah pembersihan).', data: 'Data per jam 6 stasiun sabuk asap', filter: false, cat: 'Pola jam yang sama juga terlihat di semua tipe lokasi (Langkah 2).' } })}
      ${card({ id: 'jamt', span: 's5', h: 'h380', title: 'Jam terbaik vs terburuk, Okt 2026', sub: 'Hanya jam aktivitas 06:00–18:00. Selisih = paparan yang bisa dihindari dengan menggeser jam kegiatan luar ruang.',
        body: `<div class="tbl-wrap" style="max-height:none">${tableHTML({ cols: [{ k: 'p', l: 'Kota' }, { k: 'lo', l: 'Terbaik', fmt: (v, r) => `${hh(r.hLo)} · ${f(v, 0)}` }, { k: 'hi', l: 'Terburuk', fmt: (v, r) => `${hh(r.hHi)} · ${f(v, 0)}` }, { k: 'cut', l: 'Selisih', num: 1, fmt: v => f(100 * v, 0) + '%' }, { k: 'ok', l: 'Jam ≤ 55', num: 1, fmt: (v, r) => v + '/' + r.n }],
          rows: okt.map(r => ({ ...r, _st: r.c, p: SG_PROV[r.c] })) }, true)}</div><p class="muted-s" style="margin:8px 0 0">Juni 2026 (di luar musim): ${jun.filter(r => r.ok === r.n).length} dari 6 kota punya semua jam aktivitas di bawah 55; di ${junBad.map(r => SG_PROV[r.c]).join(' dan ')} hanya jam pagi yang melewatinya.</p>`,
        table: () => ({ cols: [{ k: 'p', l: 'Kota' }, { k: 'bulan', l: 'Bulan' }, { k: 'hLo', l: 'Jam terbaik', num: 1 }, { k: 'lo', l: 'PM2.5 terbaik', num: 1, fmt: v => f(v, 1) }, { k: 'hHi', l: 'Jam terburuk', num: 1 }, { k: 'hi', l: 'PM2.5 terburuk', num: 1, fmt: v => f(v, 1) }, { k: 'ok', l: 'Jam ≤ 55', num: 1 }],
          rows: okt.map(r => ({ ...r, p: SG_PROV[r.c], bulan: 'Okt 2026' })).concat(jun.map(r => ({ ...r, p: SG_PROV[r.c], bulan: 'Jun 2026' }))) }),
        info: { rumus: 'Selisih = 1 − PM2.5 jam terbaik ÷ PM2.5 jam terburuk di antara jam 06:00–18:00, profil bulan itu.', data: 'Data per jam', filter: false } })}
      </div>
      <div class="note"><b>Artinya bagi kita:</b> imbauan "hindari pukul 06–09 dan 17–19" cukup untuk hari biasa, sedangkan saat ISPU tidak sehat sepanjang hari, yang dibutuhkan adalah <b>ruang aman</b>: kelas dan ruang tunggu tertutup dengan penyaring udara, terutama untuk balita dan lansia. Rata-rata enam kota pada Juni 2026 ${f(allJ.lo, 0)}–${f(allJ.hi, 0)} µg/m³, pada Oktober 2026 ${f(allO.lo, 0)}–${f(allO.hi, 0)} µg/m³.</div>` +

      secH('langkah', '5 · Solusi', 'Dua langkah yang kami rekomendasikan', '') +
      `<div class="grid">
      ${card({ id: 'prrec', span: 's12', title: 'Rekomendasi', body: `<ol class="sg-rules">
        <li><b>Perpanjang status siaga mengikuti hujan, bukan kalender.</b> Pertahankan siaga, patroli, dan bantuan RS kembaran sampai PM2.5 enam kota bertahan di bawah 55 µg/m³ tujuh hari berturut-turut. Pada skenario terpilih itu berarti sekitar ${sgD(S0.end)}, bukan awal November seperti 2024–2025. Siapkan stok untuk ${fi(S0.add.resp)} kasus pernapasan tambahan.</li>
        <li><b>Ganti "jam aman" dengan "ruang aman" saat ISPU tidak sehat sepanjang hari.</b> Di luar musim asap, pindahkan olahraga dan upacara sekolah dari pagi ke pukul ${hh(allJ.hLo - 1)}–${hh(allJ.hLo + 2)}. Selama musim asap, saat tidak ada jam di bawah 55, sediakan kelas dan ruang tunggu Puskesmas tertutup dengan penyaring udara.</li></ol>
        <div class="acts" style="margin-top:12px"><a class="btn" href="#/rekomendasi">Lihat semua rekomendasi ${IC.arrow}</a><a class="btn" href="#/strategi">Strategi bersama ${IC.arrow}</a></div>` })}
      </div>
      <p class="sg-foot">Data sintetis: proyeksi berlaku untuk data ini dan dibangun dari pola dua musim sebelumnya, bukan ramalan dunia nyata. Rumus lengkap ada di <a href="#/metodologi">Metodologi</a>.</p>`;
  },
  mount(C0) {
    const P = prCalc();
    bindSeg(C0, 'prsc', v => { this._sc = v; render(false); });
    bindSeg(C0, 'prlv', v => { this._lv = v; render(false); });
    bindSeg(C0, 'prm', v => { this._m = v; this.drawJam(); });
    bindSeg(C0, 'prc', v => { this._c = v; this.drawJam(); });
    const md = i => { const d = dayDate(i); return '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0'); };
    // 1. PM2.5 tiga musim
    const xs = []; for (let i = dayIdx('2026-07-01'); i <= dayIdx('2026-' + PR_END); i++) xs.push(i);
    const L = (name, data, col, w, dash) => ({ name, type: 'line', showSymbol: false, connectNulls: false, data, lineStyle: { width: w, color: cv(col), type: dash || 'solid' }, itemStyle: { color: cv(col) } });
    const vline = { silent: true, symbol: 'none', lineStyle: { color: cv('--muted'), type: [3, 3] }, label: { formatter: 'data terakhir', color: cv('--muted'), fontSize: 10.5, position: 'end', distance: 4 }, data: [{ xAxis: sgD(P.i14) }] };
    const ispuBand = mx => ({ silent: true, data: ISPU.slice(1, 4).map((x, j) => [{ yAxis: ISPU[j].max, itemStyle: { color: cv(x.v), opacity: .07 } }, { yAxis: Math.min(x.max, mx) }]) });
    mk('prpm', { grid: { left: 8, right: 16, top: 26, bottom: 24, containLabel: true }, tooltip: { trigger: 'axis', formatter: ps => `<b>${ps[0].name}</b><br>` + ps.map(p => `${p.marker}${p.seriesName}: <b>${f(p.value, 0)}</b> µg/m³`).join('<br>') },
      xAxis: ax({ type: 'category', data: xs.map(sgD), boundaryGap: false, splitLine: { show: false }, axisLabel: { color: cv('--muted'), fontSize: 11 } }), yAxis: ax({ type: 'value', name: 'PM2.5 µg/m³', min: 0 }),
      series: [L('2024', xs.map(i => P.beltPm[dayIdx('2024' + md(i))]), '--div-mid', 1.6), L('2025', xs.map(i => P.beltPm[dayIdx('2025' + md(i))]), '--k-kota', 1.8),
        Object.assign(L('2026', xs.map(i => i < ND ? P.beltPm[i] : null), '--bad', 2.6), { markLine: vline, markArea: ispuBand(300) })] });
    // 2. proyeksi kasus berlebih
    const xp = []; for (let i = dayIdx('2026-08-01'); i <= dayIdx('2026-' + PR_END); i++) xp.push(i);
    const sc = Object.keys(PR_SC).map(k => [k, prScen(k, this._lv)]);
    const ser = [L('2024', xp.map(i => P.E.resp[dayIdx('2024' + md(i))]), '--div-mid', 1.2), L('2025', xp.map(i => P.E.resp[dayIdx('2025' + md(i))]), '--div-mid', 1.2, [2, 2]),
      Object.assign(L('2026 (data)', xp.map(i => i <= P.i14 ? P.E.resp[i] : null), '--bad', 2.6), { markLine: vline })];
    for (const [k, s] of sc) ser.push(L(PR_SC[k][1], xp.map(i => { const j = i - P.i14 - 1; return i === P.i14 ? s.resp[0] : j >= 0 && i <= s.end ? s.resp[j] : null; }), PR_SC[k][2], k === this._sc ? 2.6 : 1.4, [5, 4]));
    mk('prj', { grid: { left: 8, right: 16, top: 26, bottom: 24, containLabel: true }, tooltip: { trigger: 'axis', formatter: ps => `<b>${ps[0].name}</b><br>` + ps.filter(p => p.value != null).map(p => `${p.marker}${esc(p.seriesName)}: <b>${fi(p.value)}</b>`).join('<br>') },
      xAxis: ax({ type: 'category', data: xp.map(sgD), boundaryGap: false, splitLine: { show: false }, axisLabel: { color: cv('--muted'), fontSize: 11 } }), yAxis: ax({ type: 'value', name: 'kasus berlebih/hari' }), series: ser });
    // 3. total satu musim
    const rows = [['2024', P.past[2024].season, 0, '--div-mid'], ['2025', P.past[2025].season, 0, '--div-mid']].concat(sc.map(([k, s]) => ['2026 · ' + PR_SC[k][1].replace('Hujan ', ''), P.exc.resp, s.add.resp, '--bad'])).reverse();
    mk('prtot', { grid: { left: 8, right: 52, top: 6, bottom: 16, containLabel: true }, tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: ps => { const r = rows[ps[0].dataIndex]; return `<b>${esc(r[0])}</b><br>Sudah terjadi: <b>${fi(r[1])}</b>${r[2] ? `<br>Proyeksi: <b>${fi(r[2])}</b><br>Total: <b>${fi(r[1] + r[2])}</b>` : ''}`; } },
      xAxis: ax({ type: 'value', name: 'kasus', nameLocation: 'end' }), yAxis: ax({ type: 'category', data: rows.map(r => r[0]), splitLine: { show: false }, axisLabel: { color: cv('--ink-2'), fontSize: 11, interval: 0 } }),
      series: [{ name: 'Sudah terjadi', type: 'bar', stack: 'a', barWidth: '58%', data: rows.map(r => ({ value: r[1], itemStyle: { color: cv(r[3]) } })) },
        { name: 'Proyeksi', type: 'bar', stack: 'a', data: rows.map(r => ({ value: r[2], itemStyle: { color: cv('--bad'), opacity: .35 } })),
          label: { show: true, position: 'right', formatter: p => fi(rows[p.dataIndex][1] + rows[p.dataIndex][2]), color: cv('--ink'), fontWeight: 700, fontSize: 11 } }] });
    this.drawJam();
    const sec = new URLSearchParams((location.hash.split('?')[1]) || '').get('sec');
    if (sec) { history.replaceState(null, '', '#/proyeksi'); setTimeout(() => { const el = document.getElementById(sec); if (el) el.scrollIntoView({ block: 'start' }); }, 80); }
  },
  drawJam() {
    const P = prCalc(), p = P.jam[this._m][this._c], mx = Math.max(160, Math.ceil(Math.max(...p) / 50) * 50);
    const col = this._c === 'all' ? '--brand' : SG_COL[this._c];
    mk('jam', { grid: { left: 8, right: 26, top: 26, bottom: 24, containLabel: true }, tooltip: { trigger: 'axis', formatter: ps => `<b>${ps[0].name}</b><br>PM2.5 <b>${f(ps[0].value, 0)}</b> µg/m³ · ${ISPU.find(x => ps[0].value <= x.max).l}` },
      xAxis: ax({ type: 'category', data: p.map((_, h) => String(h).padStart(2, '0') + ':00'), boundaryGap: false, splitLine: { show: false }, axisLabel: { color: cv('--muted'), fontSize: 11, interval: 2 } }),
      yAxis: ax({ type: 'value', name: 'PM2.5 µg/m³', min: 0, max: mx }),
      series: [{ name: 'PM2.5', type: 'line', smooth: .25, showSymbol: false, data: p, lineStyle: { width: 2.6, color: cv(col) }, itemStyle: { color: cv(col) }, areaStyle: { color: cv(col), opacity: .08 },
        markArea: { silent: true, data: ISPU.slice(0, 5).map((x, j) => [{ yAxis: j ? ISPU[j - 1].max : 0, itemStyle: { color: cv(x.v), opacity: .1 }, name: x.l, label: { show: x.max < mx || j === 4, position: 'insideTopLeft', color: cv('--muted'), fontSize: 10 } }, { yAxis: Math.min(x.max, mx) }]).filter((_, j) => (j ? ISPU[j - 1].max : 0) < mx) },
        markLine: { silent: true, symbol: 'none', lineStyle: { color: cv('--ink-2'), type: [4, 3] }, label: { formatter: '55', color: cv('--ink-2'), fontSize: 10.5, position: 'end' }, data: [{ yAxis: 55.4 }] } }] });
  },
};

/* teks untuk halaman Metodologi */
function prMethodHTML() {
  const P = prCalc(), sc = Object.keys(PR_SC).map(k => [k, prScen(k, 'rata'), prScen(k, 'akhir')]);
  return `<dl class="deflist">
    <dt>Kasus berlebih</dt><dd>Definisi sama dengan Strategi bersama: kasus harian RS − kasus normal RS itu, dijumlah untuk enam RS sabuk asap. Sampai 14 Okt 2026: ${fi(P.exc.resp)} kasus pernapasan.</dd>
    <dt>Pola penurunan</dt><dd>Sisa T = rata-rata kasus berlebih 1–31 Des (di luar musim; ${f(P.T, 1)}/hari), dikurangkan agar yang diproyeksikan hanya bagian akibat asap. r(k) = (kasus berlebih hari ke-k setelah 14 Okt − T) ÷ (rata-rata 1–14 Okt − T) tahun yang sama, dirata-rata 2024 dan 2025, lalu rata-rata bergerak 7 hari. Akhir musim = hari pertama r &lt; 0,15; proyeksi dijumlah sampai hari itu. Musim 2024 berakhir ${sgD(P.past[2024].end)}, 2025 ${sgD(P.past[2025].end)}.</dd>
    <dt>Proyeksi</dt><dd>Kasus berlebih hari ke-k = L × r(max(0, k − D)). L = titik awal dikurangi T: rata-rata 1–14 Okt 2026 (${fi(P.lv.rata)}/hari) atau nilai 14 Okt 2026 (${fi(P.lv.akhir)}/hari). D = hari hujan mundur: 0, 20, 30 (BMKG, 2026). Balita dan kematian = proyeksi pernapasan × perbandingannya pada 1–14 Okt 2026 (${f(P.share.u5, 2)} dan ${f(P.share.death, 3)}).</dd>
    <dt>Hasil</dt><dd>Tambahan kasus pernapasan dari 15 Okt sampai akhir musim: ${sc.map(([k, a, b]) => `${PR_SC[k][1].toLowerCase()} ${fi(a.add.resp)} (titik awal 14 Okt: ${fi(b.add.resp)})`).join('; ')}.</dd>
    <dt>Jam aman</dt><dd>Profil 24 jam per bulan dari data per jam (rata-rata jam ke-h); yang dinilai hanya jam aktivitas 06:00–18:00. Selisih = 1 − jam terbaik ÷ jam terburuk. Jam aman = jam dengan rata-rata ≤ 55,4 µg/m³ (batas atas ISPU "sedang").</dd>
    <dt>Rujukan</dt><dd>Field, R. D., dkk. (2016). Indonesian fire activity and smoke pollution in 2015 show persistent nonlinear sensitivity to El Niño-induced drought. <i>PNAS, 113</i>(33), 9204–9209. Spessa, A. C., dkk. (2015). Seasonal forecasting of fire over Kalimantan, Indonesia. <i>NHESS, 15</i>(3), 429–442. Shawki, D., dkk. (2017). Long-lead prediction of the 2015 fire and haze episode in Indonesia. <i>GRL, 44</i>. NOAA Climate Prediction Center (2026), prakiraan ENSO Oktober 2026. BMKG (2026), prakiraan musim hujan 2026/2027. Cholianawati, N., dkk. (2024). Diurnal and daily variations of PM2.5 and its multiple-wavelet coherence with meteorological variables in Indonesia. <i>AAQR</i>.</dd>
    <dt>Keterbatasan</dt><dd>Hanya dua musim pembanding. Pola 2024–2025 dianggap berlaku untuk musim yang jauh lebih parah. Hubungan dengan El Niño tidak ada di data; konteks dunia nyata hanya menentukan panjang skenario. Profil jam adalah rata-rata bulanan, bukan prakiraan per hari. Data sintetis.</dd>
    <dt>Reproduksi</dt><dd><code>js/proyeksi.js</code>: <code>prCalc()</code>, <code>prScen(skenario, titikAwal)</code>, <code>prMethodHTML()</code>.</dd></dl>`;
}
