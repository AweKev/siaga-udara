/* =====================================================================
   Landing page sebelum dashboard (#/ atau #/mulai).
   Pola diambil dari landing PlantPulse: hero + jendela pratinjau miring,
   label "stempel", deret KPI, corong titik yang digerakkan gulir,
   alur kerja, satu bahasa warna, kejujuran data, marquee, CTA bercahaya.
   Semua angka dihitung dari window.DATA, sama dengan halaman Overview.
   ===================================================================== */
PAGES.mulai = { title: 'Beranda', landing: true, html: () => '' };
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

const LPX = { off: null, d: null };
const lpReduce = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const BLN3 = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const mLab = m => BLN3[+m.slice(5) - 1] + ' ' + m.slice(0, 4);

function lpData() {
  if (LPX.d) return LPX.d;
  const act = ST.filter(s => s.use !== 'rusak');
  let s = 0, n = 0, ex = 0, above = 0;
  const cats = [0, 0, 0, 0, 0];
  for (const st of act) {
    let a = 0, b = 0;
    for (const x of D.pm25[st.code]) { if (x == null) continue; s += x; n++; a += x; b++; if (x > 55) ex++; cats[ISPU.findIndex(c => x <= c.max)]++; }
    if (b && a / b > 15) above++;
  }
  const nAndal = ST.filter(x => x.use === 'andal').length, nPar = ST.filter(x => x.use === 'parsial').length, nRus = ST.filter(x => x.use === 'rusak').length;
  let rs = null; try { rs = typeof ljRS === 'function' ? ljRS() : null; } catch (e) { rs = null; }
  /* corong: satu titik = satu stasiun dalam satu bulan */
  const rows = [...ST].sort((x, y) => PULAU.indexOf(x.pulau) - PULAU.indexOf(y.pulau) || x.no - y.no);
  const cells = [];
  rows.forEach((st, r) => D.mon[st.code].pm25.forEach((v, c) => cells.push({ r, c, v, st, ok: st.use === 'andal' && v != null })));
  const okC = cells.filter(c => c.ok), c15 = okC.filter(c => c.v > 15), c55 = okC.filter(c => c.v > 55), cHaz = okC.filter(c => c.v > ISPU[3].max);
  const worst = okC.reduce((b, c) => (!b || c.v > b.v ? c : b), null);
  /* rata-rata bulanan stasiun andal untuk pratinjau hero */
  const monMean = MONTHS.map((m, i) => { let a = 0, b = 0; ST.forEach(st => { const v = D.mon[st.code].pm25[i]; if (st.use === 'andal' && v != null) { a += v; b++; } }); return b ? a / b : null; });
  return (LPX.d = { mean: s / n, n, ex, pct: ex / n * 100, above, nAct: act.length, cats, catN: n, nAndal, nPar, nRus, rs, rows, cells, okC, c15, c55, cHaz, worst, monMean });
}

/* ---------- potongan tampilan */
const lpArrow = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
const lpMark = '<svg class="lp-mark" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" fill="var(--brand)"/><circle cx="20" cy="12" r="5" fill="#f2b544"/><path d="M5 18h18M8 22h18M5 26h14" stroke="#e9eef3" stroke-width="2.4" stroke-linecap="round" fill="none"/></svg>';

function lpSpark(vals) {
  const W = 920, H = 170, P = 6, mx = Math.max(...vals.filter(v => v != null)) * 1.08;
  const x = i => P + i * (W - 2 * P) / (vals.length - 1), y = v => H - P - v / mx * (H - 2 * P);
  const pts = vals.map((v, i) => v == null ? null : [x(i), y(v)]).filter(Boolean);
  const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('');
  const area = line + `L${pts[pts.length - 1][0].toFixed(1)} ${H - P}L${pts[0][0].toFixed(1)} ${H - P}Z`;
  const yr = MONTHS.map((m, i) => m.endsWith('-01') ? `<text x="${x(i).toFixed(1)}" y="${H + 14}">${m.slice(0, 4)}</text>` : '').join('');
  return `<svg class="lp-spark" viewBox="0 0 ${W} ${H + 18}" aria-hidden="true">
    <defs><linearGradient id="lpg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="var(--warm, #c9772f)" stop-opacity=".38"/><stop offset="1" stop-color="var(--warm, #c9772f)" stop-opacity="0"/></linearGradient></defs>
    <line class="thr" x1="${P}" x2="${W - P}" y1="${y(55).toFixed(1)}" y2="${y(55).toFixed(1)}"/><text class="thr-t" x="${W - P}" y="${(y(55) - 5).toFixed(1)}">baku harian 55</text>
    <line class="thr soft" x1="${P}" x2="${W - P}" y1="${y(15).toFixed(1)}" y2="${y(15).toFixed(1)}"/>
    <path class="ar" d="${area}"/><path class="ln" d="${line}" pathLength="1"/>${yr}</svg>`;
}

function lpTag(d, cls = '') {
  const w = d.worst;
  return `<div class="lp-tag ${cls}" aria-hidden="true">
    <div class="lp-tag-hole"></div>
    <div class="lp-stamp">Berbahaya</div>
    <div class="lp-tag-k">Bulan terburuk</div>
    <div class="lp-tag-t">${esc(w.st.code)} · ${esc(w.st.kota)}</div>
    <div class="lp-tag-s">${mLab(MONTHS[w.c])} · rata-rata <b>${fi(w.v)}</b> µg/m³</div>
    <div class="lp-tag-chips"><span>${esc(w.st.kel)}</span><span>${fi(w.v / 15)}× baku tahunan</span></div>
  </div>`;
}

function lpGrid(d) {
  const CS = 15, L = 54, T = 6, R = d.rows.length, C = MONTHS.length, W = L + C * CS + 4, H = T + R * CS + 22;
  const dots = d.cells.map((c, i) => `<circle data-i="${i}" cx="${(L + c.c * CS + CS / 2).toFixed(1)}" cy="${(T + c.r * CS + CS / 2).toFixed(1)}" r="4.6"/>`).join('');
  const rings = d.cHaz.map(c => `<circle class="ring" cx="${(L + c.c * CS + CS / 2).toFixed(1)}" cy="${(T + c.r * CS + CS / 2).toFixed(1)}" r="7"/>`).join('');
  const lab = d.rows.map((st, r) => `<text class="gl-r${st.use !== 'andal' ? ' off' : ''}" x="${L - 8}" y="${(T + r * CS + CS / 2 + 3.5).toFixed(1)}">${st.code}</text>`).join('');
  const yr = MONTHS.map((m, i) => m.endsWith('-01') ? `<text class="gl-c" x="${(L + i * CS + 2).toFixed(1)}" y="${H - 4}">${m.slice(0, 4)}</text><line class="cg" x1="${(L + i * CS).toFixed(1)}" x2="${(L + i * CS).toFixed(1)}" y1="${T}" y2="${H - 16}"/>` : '').join('');
  return `<svg class="lp-grid" viewBox="0 0 ${W} ${H}" role="img" aria-label="Kisi ${d.cells.length} titik: ${R} stasiun kali ${C} bulan">${yr}${lab}<g class="dots">${dots}</g><g class="rings">${rings}</g></svg>`;
}

function lpStages(d) {
  const pc = (a, b) => fi(a / b * 100);
  const gam = d.c55.filter(c => c.st.kel === 'Gambut').length;
  const by = {}; d.cHaz.forEach(c => { (by[c.st.code] = by[c.st.code] || []).push(BLN3[+MONTHS[c.c].slice(5) - 1]); });
  const pul = [...new Set(d.cHaz.map(c => c.st.pulau))], yrs = [...new Set(d.cHaz.map(c => MONTHS[c.c].slice(0, 4)))];
  const list = Object.entries(by).map(([k, v]) => `${k} (${v.join(', ')})`).join(', ');
  return [
    { n: d.cells.length, l: 'bulan-stasiun tercatat', s: `${d.rows.length} stasiun kali ${MONTHS.length} bulan, Jan 2024 sampai Okt 2026. Satu titik adalah satu stasiun dalam satu bulan.`, f: () => true },
    { n: d.okC.length, l: `dari ${d.nAndal} stasiun andal`, s: `${d.nPar} stasiun berdata parsial dan ${d.nRus} rusak disisihkan supaya tren tidak menipu. Barisnya tetap terlihat, hanya diredupkan.`, f: c => c.ok },
    { n: d.c15.length, l: 'di atas baku tahunan 15 µg/m³', s: `${pc(d.c15.length, d.okC.length)}% bulan-stasiun andal sudah melewati batas aman setahun. Warna titik mengikuti kategori ISPU.`, f: c => c.ok && c.v > 15, col: true },
    { n: d.c55.length, l: 'bahkan di atas baku harian 55', s: `Rata-rata sebulan penuh pun melewati batas satu hari. ${pc(gam, d.c55.length)}% di antaranya berasal dari stasiun gambut.`, f: c => c.ok && c.v > 55, col: true },
    { n: d.cHaz.length, l: 'bulan Berbahaya', s: `${list}. Semuanya di ${pul.join(', ')}, kemarau ${yrs.join(', ')}. Di sinilah siaga harus dimulai lebih awal.`, f: c => c.ok && c.v > ISPU[3].max, col: true, hot: true },
  ];
}

function lpHTML() {
  const d = lpData(), S5 = lpStages(d), last = MONTHS[MONTHS.length - 1];
  const kpi = (l, v, u, s, go, c) => `<a class="lp-kpi lp-rv" href="${go}" style="--kc:${c}"><span class="lp-kpi-l">${l}</span><span class="lp-kpi-v"><span class="cu">${v}</span><small>${u}</small></span><span class="lp-kpi-s">${s}</span></a>`;
  const steps = [
    ['t1', 'Seberapa buruk udara kita?', 'Rata-rata, hari tidak sehat, dan stasiun terburuk tiap wilayah.', 'air'],
    ['t2', 'Kapan dan di mana harus siaga?', 'Jam puncak, bulan puncak, dan sabuk asap yang berulang.', 'clock'],
    ['t3', 'Apa yang menentukan naik turunnya?', 'Waktu, cuaca, dan tipe lokasi dibandingkan dalam satu ukuran.', 'gauge'],
    ['t4', 'Siapa yang paling terdampak?', 'Tambahan pasien ISPA balita, lansia, dan kematian di RS rujukan.', 'heart'],
    ['rekomendasi', 'Apa yang harus dilakukan?', 'Langkah per pihak. Tiap rekomendasi tertaut ke grafik buktinya.', 'bulb'],
  ];
  const tot = d.cats.reduce((a, b) => a + b, 0);
  const segs = ISPU.map((c, i) => ({ ...c, n: d.cats[i], p: d.cats[i] / tot * 100 }));
  const st = [...ST].sort((x, y) => PULAU.indexOf(x.pulau) - PULAU.indexOf(y.pulau) || x.no - y.no);
  const chips = st.map(s => `<span class="lp-chip ${s.use}"><i></i><b>${s.code}</b>${esc(s.kota)}<em>${s.use}</em></span>`).join('');
  const meta = D.meta;
  return `
  <div class="lp-prog" aria-hidden="true"><i></i></div>
  <header class="lp-top"><nav class="lp-nav" aria-label="Navigasi beranda">
    <a class="lp-brand" href="#/mulai">${lpMark}<span>Siaga Udara</span></a>
    <div class="lp-links"><a href="#lp-masalah" data-sec="lp-masalah">Masalah</a><a href="#lp-corong" data-sec="lp-corong">Corong data</a><a href="#lp-alur" data-sec="lp-alur">Alur</a><a href="#lp-warna" data-sec="lp-warna">Warna ISPU</a><a href="#lp-jujur" data-sec="lp-jujur">Kejujuran data</a></div>
    <button class="lp-theme" type="button" aria-label="Ganti tema terang/gelap"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4.5"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/></svg></button>
    <a class="lp-btn dark sm" href="#/overview">Buka dashboard ${lpArrow}</a>
  </nav></header>

  <section class="lp-hero" id="lp-hero">
    <div class="lp-blob a"></div><div class="lp-blob b"></div><div class="lp-gridbg"></div>
    <div class="lp-wrap lp-hero-in">
      <a class="lp-pill lp-rv" href="#lp-corong"><i></i>Dashboard Analysis · Gelar Rasa 2026<span>Lihat temuan ${lpArrow}</span></a>
      <h1 class="lp-h1 lp-rv">Asap datang tiap kemarau. <span class="lp-grad">Datanya memberi tanda lebih dulu.</span></h1>
      <p class="lp-lede lp-rv">Siaga Udara membaca ${ST.length} stasiun pemantau udara bersama ${ST.length} rumah sakit rujukan, Januari 2024 sampai Oktober 2026, supaya pemerintah daerah tahu kapan, di mana, dan untuk siapa harus siaga.</p>
      <div class="lp-cta lp-rv"><a class="lp-btn dark beam" href="#/overview"><span>Buka dashboard ${lpArrow}</span></a><a class="lp-btn ghost" href="#lp-masalah">Lihat temuan utama</a></div>
    </div>
    <div class="lp-wrap lp-stage">
      <a class="lp-win" href="#/overview" aria-label="Buka Overview dashboard">
        <div class="lp-win-bar"><i></i><i></i><i></i><span>siaga-udara · Overview · data s.d. 14 Okt 2026</span></div>
        <div class="lp-win-body">
          <div class="lp-win-kpis">
            <div><small>Rata-rata PM2.5</small><b>${f(d.mean)}</b><em>µg/m³</em></div>
            <div><small>Hari tidak sehat</small><b>${f(d.pct, 1)}%</b><em>${fi(d.ex)} hari-stasiun</em></div>
            <div><small>Stasiun di atas baku</small><b>${d.above}/${d.nAct}</b><em>baku tahunan 15</em></div>
          </div>
          <div class="lp-win-chart"><div class="lp-win-k">Rata-rata PM2.5 bulanan, ${d.nAndal} stasiun andal</div>${lpSpark(d.monMean)}</div>
        </div>
      </a>
      <div class="lp-float l" aria-hidden="true"><small>Hari tidak sehat</small><b>${f(d.pct, 1)}%</b><div class="lp-float-bar"><i style="width:${d.pct.toFixed(1)}%"></i></div><em>${fi(d.ex)} dari ${fi(d.n)} hari-stasiun</em></div>
      ${lpTag(d, 'at-hero')}
    </div>
  </section>

  <section class="lp-sec" id="lp-masalah">
    <div class="lp-wrap">
      <div class="lp-split">
        <h2 class="lp-h2 lp-rv">Angkanya sudah tercatat. Yang sering terlambat adalah siaganya.</h2>
        <div class="lp-rv"><p class="lp-p">Setiap kemarau PM2.5 di sabuk gambut naik berlipat, dan pasien pernapasan di RS rujukan cenderung ikut bertambah. Datanya ada di stasiun, tetapi jarang dibaca bersama data rumah sakit sebelum asap tiba.</p>
        <p class="lp-p muted">Angka di bawah dihitung dari dataset panitia apa adanya, sama persis dengan halaman Overview.</p></div>
      </div>
      <div class="lp-kpis">
        ${kpi('Rata-rata PM2.5', f(d.mean), 'µg/m³', `${f(d.mean / 15, 1)}× baku tahunan 15 µg/m³`, '#/t1', 'var(--ispu-2)')}
        ${kpi('Hari tidak sehat', f(d.pct, 1), '%', `${fi(d.ex)} hari-stasiun di atas baku harian 55`, '#/t2', 'var(--ispu-3)')}
        ${kpi('Stasiun di atas baku', String(d.above), `/ ${d.nAct}`, 'rata-rata setahun melewati 15 µg/m³', '#/t1', 'var(--ispu-4)')}
        ${d.rs ? kpi('Kematian di atas normal', fi(d.rs.tot), 'jiwa', `${ST.length} RS rujukan, 1 Agu–14 Okt 2026`, '#/rs', 'var(--ispu-5)') : ''}
        ${kpi('Stasiun andal', String(d.nAndal), `/ ${ST.length}`, `${d.nPar} parsial, ${d.nRus} rusak, ditandai`, '#/metodologi', 'var(--muted)')}
      </div>
    </div>
  </section>

  <section class="lp-scrolly" id="lp-corong" style="--n:${S5.length}">
    <div class="lp-sticky">
      <div class="lp-wrap lp-sticky-in">
        <div class="lp-funnel-txt">
          <div class="lp-kick">Dari ${fi(d.cells.length)} catatan ke ${d.cHaz.length} bulan berbahaya</div>
          <div class="lp-big"><span id="lpBig">${fi(S5[0].n)}</span></div>
          <div class="lp-big-l" id="lpBigL">${S5[0].l}</div>
          <p class="lp-big-s" id="lpBigS">${S5[0].s}</p>
          <ol class="lp-steps">${S5.map((s, i) => `<li data-s="${i}" class="${i ? '' : 'on'}"><button type="button"><b>${fi(s.n)}</b><span>${s.l}</span></button></li>`).join('')}</ol>
          <p class="lp-note">Gulir untuk menyaring. Okt 2026 baru berisi data s.d. 14 Okt.</p>
        </div>
        <div class="lp-funnel-viz">${lpGrid(d)}</div>
      </div>
    </div>
  </section>

  <section class="lp-sec band" id="lp-alur">
    <div class="lp-wrap">
      <div class="lp-head lp-rv"><h2 class="lp-h2">Empat pertanyaan, satu alur, satu jawaban.</h2><p class="lp-p">Dashboard mengikuti cara kerja tim siaga: lihat kondisi, cari waktu kritis, pahami penyebab, ukur dampak, lalu bertindak. Filter wilayah dan periode ikut terbawa di setiap langkah.</p></div>
      <div class="lp-flow">${steps.map(([id, q, s, ic], i) => `<a class="lp-card lp-rv" href="#/${id}" style="--d:${i * 70}ms"><span class="lp-card-n">${i < 4 ? i + 1 : IC.arrow}</span><span class="lp-card-ic">${IC[ic] || ''}</span><span class="lp-card-k">${i < 4 ? 'Langkah ' + (i + 1) + ' · ' : ''}${PAGES[id] ? PAGES[id].nav : ''}</span><h3>${q}</h3><p>${s}</p><span class="lp-card-go">Buka ${lpArrow}</span></a>`).join('')}</div>
      <div class="lp-more lp-rv"><span>Analisis lanjutan</span>${(typeof LANJUT !== 'undefined' ? LANJUT : []).map(id => `<a href="#/${id}">${IC[LJ_NAV[id][0]] || ''}${LJ_NAV[id][1]}</a>`).join('')}${PAGES.papan ? `<a href="#/papan">${IC.table}Perbandingan wilayah</a>` : ''}<a href="#/stasiun">${IC.pin}Profil stasiun</a></div>
    </div>
  </section>

  <section class="lp-sec" id="lp-warna">
    <div class="lp-wrap">
      <div class="lp-split">
        <h2 class="lp-h2 lp-rv">Satu bahasa warna di setiap halaman.</h2>
        <p class="lp-p lp-rv">Lima kategori ISPU dipakai sama di peta, grafik, dan kartu, jadi status terbaca sekilas tanpa membaca angka. Abu-abu selalu berarti belum terpantau, bukan berarti bersih.</p>
      </div>
      <div class="lp-ispu lp-rv">
        <div class="lp-ispu-k">Pembagian ${fi(tot)} hari-stasiun menurut kategori ISPU PM2.5</div>
        <div class="lp-ispu-bar">${segs.map((c, i) => `<span data-k="${i}" style="--w:${c.p.toFixed(2)}%;--c:var(${c.v})" title="${c.l}: ${f(c.p, 1)}%"></span>`).join('')}</div>
        <div class="lp-ispu-cards">${segs.map((c, i) => `<div class="lp-ic" data-k="${i}" style="--c:var(${c.v})"><div class="lp-ic-h"><i></i>${c.l}</div><div class="lp-ic-v">${f(c.p, 1)}<small>%</small></div><div class="lp-ic-r">${i ? '&gt; ' + f(ISPU[i - 1].max, 1) : '0'}${isFinite(c.max) ? ' – ' + f(c.max, 1) : ''} µg/m³ · ${fi(c.n)} hari</div><p>${c.s}</p></div>`).join('')}</div>
      </div>
    </div>
  </section>

  <section class="lp-sec dark" id="lp-jujur">
    <div class="lp-wrap">
      <div class="lp-split">
        <h2 class="lp-h2 lp-rv">Jujur soal batas datanya.</h2>
        <p class="lp-p lp-rv">Dinas dan warga akan menguji setiap klaim. Karena itu setiap angka bisa ditelusuri ke rumusnya, dan setiap keterbatasan ditulis, bukan disembunyikan.</p>
      </div>
      <div class="lp-trust">
        <div class="lp-tc lp-rv"><span class="lp-tc-k">Hanya data panitia</span><b>${fi(meta.rows_total)}</b><p>baris mentah dari 33 file, disaring menjadi ${fi(meta.clean_hours)} jam bersih. Tanpa data tambahan dari luar.</p></div>
        <div class="lp-tc lp-rv"><span class="lp-tc-k">Stasiun bermasalah ditandai</span><b>${d.nPar + d.nRus}</b><p>stasiun parsial atau rusak tetap tampil dengan penanda, tidak dibuang diam-diam. Alasannya ada di halaman Metodologi.</p></div>
        <div class="lp-tc lp-rv"><span class="lp-tc-k">Hubungan, bukan sebab-akibat</span><b>Poisson</b><p>tambahan pasien adalah perkiraan model dengan kontrol cuaca, hari, dan musim. Dashboard tidak mengklaim sebab-akibat.</p></div>
        <div class="lp-tc lp-rv"><span class="lp-tc-k">Data sintetis</span><b>${mLab(last)}</b><p>dataset panitia berakhir 14 Okt 2026. Bulan terakhir hanya setengah, jadi selalu diberi catatan.</p></div>
      </div>
    </div>
    <div class="lp-marq" aria-label="Daftar ${ST.length} stasiun dan statusnya"><div class="lp-marq-in">${chips}${chips}</div></div>
  </section>

  <section class="lp-end" id="lp-mulai">
    <div class="lp-blob a"></div><div class="lp-blob b"></div>
    <div class="lp-wrap lp-end-in">
      <div>
        <h2 class="lp-h2 big lp-rv">Mulai dari ringkasan. Berakhir di rekomendasi.</h2>
        <p class="lp-p lp-rv">Dashboard dibuka pada snapshot yang sama dengan halaman ini. Tanpa login, bisa dibuka di HP.</p>
        <div class="lp-cta lp-rv"><a class="lp-btn dark beam" href="#/overview"><span>Buka dashboard ${lpArrow}</span></a><a class="lp-btn ghost" href="#/rekomendasi">Langsung ke rekomendasi</a></div>
      </div>
      ${lpTag(d, 'at-end')}
    </div>
  </section>
  <footer class="lp-foot"><div class="lp-wrap"><span>${lpMark}Siaga Udara · Dashboard Analysis Gelar Rasa 2026</span><span>Data: <em>Synthetic Metropolitan AQMS</em> dari panitia, s.d. 14 Okt 2026.</span></div></footer>`;
}

/* ---------- interaksi */
function lpMount(L) {
  if (LPX.off) LPX.off();
  L.innerHTML = lpHTML();
  const d = lpData(), S5 = lpStages(d), reduce = lpReduce(), offs = [];
  const on = (t, e, fn, o) => { t.addEventListener(e, fn, o); offs.push(() => t.removeEventListener(e, fn, o)); };

  /* tema */
  L.querySelector('.lp-theme').onclick = () => { const t = curTheme() === 'dark' ? 'light' : 'dark'; applyTheme(t); try { localStorage.setItem('su-theme3', t); } catch (e) { } };

  /* jangkar dalam halaman: gulir halus tanpa mengubah hash rute */
  L.querySelectorAll('a[href^="#lp-"]').forEach(a => a.onclick = e => { e.preventDefault(); const el = document.getElementById(a.getAttribute('href').slice(1)); if (el) window.scrollTo({ top: el.getBoundingClientRect().top + scrollY - 64, behavior: reduce ? 'auto' : 'smooth' }); });

  /* muncul saat terlihat + angka naik */
  const io = new IntersectionObserver(es => es.forEach(e => { if (!e.isIntersecting) return; e.target.classList.add('in'); if (e.target.classList.contains('lp-kpi')) countUp(e.target); io.unobserve(e.target); }), { threshold: .18 });
  L.querySelectorAll('.lp-rv, .lp-ispu').forEach(el => io.observe(el));
  offs.push(() => io.disconnect());
  if (reduce) L.querySelectorAll('.lp-rv').forEach(el => el.classList.add('in'));

  /* sorotan kursor pada kartu */
  L.querySelectorAll('.lp-card, .lp-kpi, .lp-tc').forEach(c => on(c, 'pointermove', e => { const r = c.getBoundingClientRect(); c.style.setProperty('--mx', (e.clientX - r.left) + 'px'); c.style.setProperty('--my', (e.clientY - r.top) + 'px'); }));

  /* ISPU: sorot pasangan batang dan kartu */
  const segs = L.querySelectorAll('.lp-ispu [data-k]');
  segs.forEach(el => { on(el, 'pointerenter', () => segs.forEach(x => x.classList.toggle('dim', x.dataset.k !== el.dataset.k))); on(el, 'pointerleave', () => segs.forEach(x => x.classList.remove('dim'))); });

  /* corong titik */
  const dots = [...L.querySelectorAll('.lp-grid .dots circle')], grid = L.querySelector('.lp-grid');
  const big = L.querySelector('#lpBig'), bigL = L.querySelector('#lpBigL'), bigS = L.querySelector('#lpBigS'), lis = [...L.querySelectorAll('.lp-steps li')];
  const ispuVar = v => ISPU.find(c => v <= c.max).v;
  let cur = -1, numT = 0;
  const setStage = k => {
    if (k === cur) return; const prev = cur; cur = k; const s = S5[k];
    dots.forEach((el, i) => { const c = d.cells[i], keep = s.f(c);
      el.classList.toggle('off', !keep); el.classList.toggle('hot', !!(s.hot && keep));
      el.style.fill = keep && s.col ? `var(${ispuVar(c.v)})` : ''; });
    grid.classList.toggle('final', !!s.hot);
    lis.forEach((li, i) => { li.classList.toggle('on', i === k); li.classList.toggle('done', i < k); });
    bigL.textContent = s.l; bigS.textContent = s.s;
    const from = prev < 0 ? s.n : S5[prev].n, to = s.n, t0 = performance.now(); cancelAnimationFrame(numT);
    if (reduce) big.textContent = fi(to);
    else { const step = t => { const p = Math.min(1, (t - t0) / 600), e = 1 - Math.pow(1 - p, 3); big.textContent = fi(Math.round(from + (to - from) * e)); if (p < 1) numT = requestAnimationFrame(step); }; numT = requestAnimationFrame(step); }
  };
  setStage(0);
  const sec = L.querySelector('#lp-corong');
  lis.forEach((li, i) => li.querySelector('button').onclick = () => { const r = sec.getBoundingClientRect(), span = sec.offsetHeight - innerHeight; window.scrollTo({ top: r.top + scrollY + span * (i + .5) / S5.length, behavior: reduce ? 'auto' : 'smooth' }); });

  /* gulir: progres, kop, jendela miring, tahap corong, menu aktif */
  const prog = L.querySelector('.lp-prog i'), top = L.querySelector('.lp-top'), win = L.querySelector('.lp-win'), hero = L.querySelector('#lp-hero');
  const links = [...L.querySelectorAll('.lp-links a')], secs = links.map(a => document.getElementById(a.dataset.sec));
  let raf = 0;
  const tick = () => {
    raf = 0; const y = scrollY, H = document.documentElement.scrollHeight - innerHeight;
    prog.style.transform = `scaleX(${H > 0 ? Math.min(1, y / H) : 0})`;
    top.classList.toggle('solid', y > 12);
    if (!reduce && win) { const p = Math.min(1, Math.max(0, y / (hero.offsetHeight * .55))); win.style.setProperty('--tilt', (1 - p).toFixed(3)); }
    const r = sec.getBoundingClientRect(), span = sec.offsetHeight - innerHeight, p = Math.min(.999, Math.max(0, -r.top / span));
    setStage(Math.floor(p * S5.length));
    let a = -1; secs.forEach((s, i) => { if (s && s.getBoundingClientRect().top < innerHeight * .4) a = i; });
    links.forEach((l, i) => l.classList.toggle('on', i === a));
  };
  const onScroll = () => { if (!raf) raf = requestAnimationFrame(tick); };
  on(window, 'scroll', onScroll, { passive: true }); on(window, 'resize', onScroll);
  tick();
  LPX.off = () => { offs.forEach(fn => fn()); cancelAnimationFrame(raf); cancelAnimationFrame(numT); LPX.off = null; };
}
PAGES.mulai.mount = lpMount;
