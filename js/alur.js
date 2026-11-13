/* ================= ALUR ANALISIS (v2) =================
   Empat bab berurutan, satu pertanyaan per bab: 1 Kondisi -> 2 Waktu kritis -> 3 Faktor -> 4 Kesehatan.
   Tiap bab = deretan grafik (satu insight singkat per grafik) lalu kotak "Jawaban" yang menaut ke Aksi pemerintah.
   Grafik yang dipertahankan (peta, ambang, beda 2024-2026, RS) dipinjam dari halaman lamanya; sisanya digambar di sini.
   Dimuat setelah analisis.js dan menimpa PAGES.bab1..bab4. */
'use strict';

/* judul singkat Aksi pemerintah (urutan sama dengan halaman rekomendasi) */
const AL_AKSI = { 1: 'Siaga otomatis Agu–Okt, dicabut menurut data', 2: 'Cegah kebakaran gambut sebelum musim', 3: 'Kendalikan emisi industri Marunda',
  4: 'Siapkan kapasitas RS sebelum musim', 5: 'Peringatan hari itu juga, mulai 35 µg/m³', 6: 'Masker dan ruang udara bersih' };
/* rute lama sub-bab -> kartu tujuan di bab barunya */
window.AN_ANCHOR = { ambang: 'card-amb', kalender: 'card-kalender', cuaca: 'card-cuaca', rs: 'card-rsd' };
Object.assign(window.AN_PAGE, { ambang: 'bab4', kalender: 'bab2', cuaca: 'bab3', rs: 'bab4' });   // ambang (kesehatan) pindah dari bab 1 ke bab 4
window.AN_LABEL = Object.assign(window.AN_LABEL || {}, { t1: 'Kondisi', t2: 'Waktu kritis', t3: 'Faktor', t4: 'Kesehatan' });

/* ambil kartu tertentu dari halaman lama (html halaman lama dijalankan supaya state mount-nya siap) */
function alPinjam(page, ids) {
  const P = PAGES[page], tmp = document.createElement('div'); tmp.innerHTML = P.html.call(P);
  return Object.fromEntries(ids.map(id => { const el = tmp.querySelector('#card-' + id); return [id, el ? el.outerHTML : '']; }));
}
/* kotak penutup bab: pertanyaan, jawaban, tautan ke aksi */
function alJawab(q, a, ids) {
  return `<section class="an-ans s12"><div class="an-ans-k">${IC.bulb}Jawaban bab ini</div><p class="an-ans-q">${q}</p><p class="an-ans-a">${a}</p>
    <div class="an-ans-l"><span>Ditindaklanjuti oleh</span>${ids.map(n => `<a href="#/rekomendasi" onclick="window.SCROLL_TO='rec${n}';if(PAGES.rekomendasi)PAGES.rekomendasi._aud='semua'"><b>#${n}</b>${AL_AKSI[n]}${IC.arrow}</a>`).join('')}</div></section>`;
}
const alHead = (n, t, h, lede) => ph({ k: `Langkah ${n} · ${t}`, h, lede });
const alDoy = (m, d) => Math.round((Date.UTC(2026, m, d) - Date.UTC(2026, 0, 1)) / 864e5);
const alDoyTxt = x => { const d = new Date(Date.UTC(2026, 0, 1) + x * 864e5); return d.getUTCDate() + ' ' + BULAN[d.getUTCMonth()]; };
const alSeason = mo => mo >= 7 && mo <= 9;   // Agustus–Oktober (indeks bulan 0-11)

/* ---------- BAB 1 · KONDISI ---------- */
function alKondisi(codes) {
  const [d0, d1] = range();
  return codes.map(c => { const a = D.pm25[c]; let nm = 0, em = 0, nl = 0, el = 0;
    for (let i = d0; i <= d1; i++) { const v = a[i]; if (v == null) continue; if (alSeason(dayDate(i).getUTCMonth())) { nm++; if (v > BAKU) em++; } else { nl++; if (v > BAKU) el++; } }
    return { code: c, m: nm ? 100 * em / nm : null, l: nl ? 100 * el / nl : null, nm, nl }; }).filter(r => r.m != null && r.l != null)
    .sort((a, b) => (b.m + b.l) - (a.m + a.l));
}
const AL1 = {
  html() {
    const codes = active().map(s => s.code); if (!codes.length) return alHead(1, 'Kondisi', 'Seberapa buruk udara kita?', '') + emptyMsg;
    const B = alPinjam('t1', ['tmap']), K = alKondisi(codes);
    const chron = K.filter(r => r.l >= 50), seas = K.filter(r => r.m >= 50 && r.l < 10), thn = codes.filter(c => (sstat(c).mean || 0) > BAKU_THN).length;
    this._k = K;
    return alHead(1, 'Kondisi', 'Seberapa buruk udara kita?', 'Mengukur seberapa tinggi PM2.5 di tiap stasiun dan kapan udara tidak sehat.') +
      `<div class="grid">
      <div class="an-strip s12"><span><b>WHO</b>5 µg/m³ setahun</span><span><b>Baku tahunan</b>15 µg/m³</span><span><b>Baku harian</b>55 µg/m³</span><span><b>ISPU</b>Baik · Sedang · Tidak sehat · Sangat tidak sehat · Berbahaya</span><em>Data panitia, 25 dari 27 stasiun andal, Jan 2024 – 14 Okt 2026.</em></div>
      ${B.tmap}
      ${card({ id: 'kondisi', span: 's12', title: 'Kronis atau musiman?', sub: 'Satu baris per stasiun. Titik oranye = persen hari Agustus–Oktober dengan PM2.5 harian di atas 55 µg/m³; lingkaran biru = persen hari pada bulan lain. Garis di antaranya = selisih kedua musim.',
        legend: '<span><i style="background:var(--k-gambut);border-radius:50%"></i>Agustus–Oktober</span><span><i style="background:transparent;border:2.5px solid var(--c1);border-radius:50%"></i>Bulan lain</span>',
        lead: `${chron.length ? `<b>${chron.map(r => r.code).join(', ')}</b> tidak sehat hampir sepanjang tahun, sedangkan ` : ''}<b>${seas.length}</b> stasiun hanya memburuk pada Agustus–Oktober.`,
        note: nt(`${thn} dari ${codes.length} stasiun rata-ratanya di atas baku tahunan 15 µg/m³. Kronis (≥ 50% hari bulan lain tidak sehat): ${chron.length ? chron.map(r => `${r.code} ${f(r.l, 0)}%`).join(', ') : 'tidak ada'}. Musiman (≥ 50% hari Agu–Okt, < 10% bulan lain): ${seas.map(r => r.code).join(', ') || 'tidak ada'}.`,
          'Agustus–Oktober dipakai sebagai musim asap karena bulan itulah PM2.5 stasiun gambut melonjak (lihat Langkah 2).'),
        table: () => ({ cols: [{ k: 'code', l: 'Kode' }, { k: 'kel', l: 'Tipe' }, { k: 'm', l: '% hari > 55, Agu–Okt', num: 1, fmt: v => f(v, 0) }, { k: 'l', l: '% hari > 55, bulan lain', num: 1, fmt: v => f(v, 0) }], rows: K.map(r => ({ _st: r.code, code: r.code, kel: BY[r.code].kel, m: r.m, l: r.l })) }),
        info: { rumus: 'Per stasiun: hari sah dengan PM2.5 harian > 55 µg/m³ ÷ seluruh hari sah, dihitung terpisah untuk Agustus–Oktober dan bulan lain.', data: 'pm25 harian' } })}
      ${alJawab('Seberapa buruk udara kita?', `${thn} dari ${codes.length} stasiun melampaui baku tahunan, dengan dua pola berbeda: ${chron.length ? `<b>kronis</b> sepanjang tahun di ${chron.map(r => esc(stName(r.code))).join(', ')}, dan ` : ''}<b>musiman</b> Agustus–Oktober di ${seas.length} stasiun. Pola kronis butuh pengendalian sumber, pola musiman butuh perlindungan warga saat musim.`, [3, 6])}
      </div>`;
  },
  mount(C) {
    PAGES.t1.mount.call(PAGES.t1, C);
    const K = (this._k || []).slice(), el = document.getElementById('kondisi'); if (!el || !K.length) return;
    el.style.height = Math.max(260, K.length * 24 + 56) + 'px';
    const cO = cv('--k-gambut'), cB = cv('--c1'), cat = K.map(r => r.code);
    mk('kondisi', { grid: { left: 8, right: 54, top: 8, bottom: 26, containLabel: true },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: ps => { const r = K[ps[0].dataIndex]; return `<b>${r.code}</b> ${esc(BY[r.code].kota)} · ${BY[r.code].kel}<br>Agustus–Oktober: <b>${f(r.m, 0)}%</b> hari tidak sehat<br>Bulan lain: <b>${f(r.l, 0)}%</b>`; } },
      xAxis: ax({ type: 'value', min: 0, max: 100, axisLabel: { formatter: '{value}%', color: cv('--muted'), fontSize: 11 } }),
      yAxis: ax({ type: 'category', data: cat, inverse: true, splitLine: { show: true, lineStyle: { color: cv('--line'), opacity: .5 } }, axisLine: { show: false },
        axisLabel: { interval: 0, formatter: v => `{n|${v}}  {c|${BY[v].kel}}`, rich: { n: { color: cv('--ink'), fontSize: 11.5, fontWeight: 700 }, c: { color: cv('--muted'), fontSize: 10 } } } }),
      series: [{ type: 'custom', silent: true, z: 1, data: K.map((r, i) => [r.l, r.m, i]), encode: { x: [0, 1], y: 2 },
          renderItem: (p, api) => { const a = api.coord([api.value(0), api.value(2)]), b = api.coord([api.value(1), api.value(2)]);
            return { type: 'line', shape: { x1: a[0], y1: a[1], x2: b[0], y2: b[1] }, style: { stroke: hexA(cO, .35), lineWidth: 5, lineCap: 'round' } }; } },
        { name: 'Bulan lain', type: 'scatter', z: 3, symbolSize: 11, data: K.map(r => [r.l, r.code]), itemStyle: { color: cv('--surface'), borderColor: cB, borderWidth: 2.5 } },
        { name: 'Agustus–Oktober', type: 'scatter', z: 4, symbolSize: 12, data: K.map(r => [r.m, r.code]), itemStyle: { color: cO, borderColor: cv('--surface'), borderWidth: 1.5 },
          label: { show: true, position: 'right', distance: 8, formatter: p => { const r = K[p.dataIndex]; return r.l >= 50 ? '{k|kronis}' : r.m >= 50 && r.l < 10 ? '' : ''; }, rich: { k: { color: cv('--bad'), fontWeight: 700, fontSize: 10.5 } } } }] },
      p => go('stasiun', { st: cat[p.dataIndex] }));
  },
};

/* ---------- BAB 2 · WAKTU KRITIS ---------- */
function alJam(codes) {   // profil jam: sabuk asap Agu–Okt, sabuk asap bulan lain, stasiun lain
  const sab = ljSabuk().filter(c => codes.includes(c)), oth = codes.filter(c => !sab.includes(c));
  const prof = (cs, inS) => Array.from({ length: 24 }, (_, h) => mean(cs.flatMap(c => { const a = []; for (let m = S.from; m <= S.to; m++) { const mo = +MONTHS[m].slice(5) - 1; if (inS == null || alSeason(mo) === inS) a.push(D.hm[c][m][h]); } return a; })));
  return { sab, oth, s1: sab.length ? prof(sab, true) : null, s0: sab.length ? prof(sab, false) : null, o: oth.length ? prof(oth, null) : null };
}
const AL2 = {
  html() {
    const codes = active().map(s => s.code); if (!codes.length) return alHead(2, 'Waktu kritis', 'Kapan harus siaga?', '') + emptyMsg;
    const kelIn = KEL.filter(k => codes.some(c => BY[c].kel === k)), moyK = Object.fromEntries(kelIn.map(k => [k, moyProfile(codes.filter(c => BY[c].kel === k))]));
    const g = moyK.Gambut, rest = codes.filter(c => BY[c].kel !== 'Gambut'), mr = rest.length ? moyProfile(rest) : null;
    const gS = g ? mean(g.slice(7, 10)) : null, rS = mr ? mean(mr.slice(7, 10)) : null, gJ = g ? mean(g.slice(0, 7)) : null, rJ = mr ? mean(mr.slice(0, 7)) : null;
    const J = alJam(codes), hh = h => String(h).padStart(2, '0') + ':00';
    const sMin = J.s1 ? Math.min(...J.s1.filter(v => v != null)) : null, oPk = J.o ? J.o.indexOf(Math.max(...J.o.filter(v => v != null))) : null;
    const KL = ljKalender(), stable = KL.rows.filter(r => r.spread <= 7 && r.yrs[2026]).map(r => KL.doy(r.yrs[2026].on)).sort((a, b) => a - b);
    const early = KL.rows.filter(r => r.shift != null && r.shift <= -21).sort((a, b) => a.shift - b.shift), e0 = early[0];
    const offs = KL.rows.flatMap(r => [2024, 2025].map(y => r.yrs[y] && !r.yrs[y].open ? KL.doy(r.yrs[y].off) : null)).filter(v => v != null).sort((a, b) => a - b);
    const onMed = stable.length ? stable[Math.floor(stable.length / 2)] : null, offMed = offs.length ? offs[Math.floor(offs.length / 2)] : null;
    this._d = { kelIn, moyK, J };
    return alHead(2, 'Waktu kritis', 'Kapan harus siaga?', 'Mencari bulan, jam, dan tanggal ketika udara paling berbahaya.') +
      `<div class="grid">
      ${card({ id: 'musim', span: 's12', h: 'h380', title: 'Bulan apa udara memburuk?', sub: 'Rata-rata PM2.5 tiap bulan kalender per tipe lokasi. Pita oranye = Agustus–Oktober; garis titik hitam = baku harian 55 µg/m³.', legend: legendKel(kelIn),
        lead: g && mr ? `Gambut ${Math.abs(gJ / rJ - 1) < .2 ? 'setara' : gJ > rJ ? 'sudah lebih kotor dari' : 'lebih bersih dari'} tipe lain sampai Juli, lalu melonjak <b>${f(gS / rS, 1)}×</b> tipe lain pada Agustus–Oktober.` : 'PM2.5 tertinggi jatuh pada Agustus–Oktober.',
        note: g && mr ? nt(`Januari–Juli: gambut ${f(gJ, 0)} µg/m³, tipe lain ${f(rJ, 0)}. Agustus–Oktober: gambut <b>${f(gS, 0)}</b>, tipe lain ${f(rS, 0)}.`) : '',
        table: () => ({ cols: [{ k: 'k', l: 'Tipe' }].concat(BULAN.map((b, i) => ({ k: 'm' + i, l: b, num: 1, fmt: v => f(v, 0) }))), rows: kelIn.map(k => { const o = { k }; moyK[k].forEach((v, i) => o['m' + i] = v); return o; }) }),
        info: { rumus: 'Rata-rata hari sah per bulan kalender untuk stasiun bertipe sama, seluruh tahun dalam filter.', data: 'pm25 harian' } })}
      ${card({ id: 'jam', span: 's6', h: 'h380', title: 'Jam berapa paling berbahaya?', sub: 'Rata-rata PM2.5 per jam. Oranye = stasiun sabuk asap saat Agustus–Oktober; oranye pucat = stasiun yang sama di bulan lain; biru = stasiun lain sepanjang tahun.',
        legend: '<span><i class="line" style="background:var(--k-gambut)"></i>Sabuk asap, Agu–Okt</span><span><i class="line" style="background:color-mix(in srgb, var(--k-gambut) 40%, var(--surface))"></i>Sabuk asap, bulan lain</span><span><i class="line" style="background:var(--c1)"></i>Stasiun lain</span>',
        lead: J.s1 ? (sMin > BAKU ? 'Saat musim asap tidak ada satu jam pun di bawah baku, jadi menggeser jam kegiatan tidak cukup.' : `Saat musim asap jam terbersih pun hampir menyentuh baku, sedangkan di luar musim pagi hari paling kotor.`) : `Udara paling kotor sekitar pukul ${hh(oPk)}.`,
        note: J.s1 ? nt(`Sabuk asap (${J.sab.join(', ')}), Agu–Okt: jam terbersih ${f(sMin, 0)} µg/m³, tertinggi ${f(Math.max(...J.s1.filter(v => v != null)), 0)}.${J.o ? ` Stasiun lain memuncak sekitar pukul ${hh(oPk)}.` : ''}`, 'Rata-rata per jam dari data per jam yang sudah dibersihkan; tidak ada data lalu lintas per jam.') : '',
        info: { rumus: 'Rata-rata jam ke-h dari tabel bulan × jam tiap stasiun, dipisah menurut bulan kalender (Agu–Okt vs lainnya). Sabuk asap = stasiun yang PM2.5 Agu–Okt-nya ≥ 2× bulan lain.', data: 'Data per jam' } })}
      ${card({ id: 'kalender', span: 's6', h: 'h380', title: 'Kapan musim asap mulai dan selesai?', sub: `Satu batang per tahun untuk tiap stasiun sabuk asap: dari hari pertama sampai hari terakhir rata-rata 7 hari PM2.5 di atas ${BAKU} µg/m³. Batang 2026 memudar di ujung karena data berhenti 14 Oktober.`,
        legend: [2024, 2025, 2026].map((y, i) => `<span><i style="background:color-mix(in srgb, var(--ispu-4) ${[30, 60, 100][i]}%, var(--surface))"></i>${y}</span>`).join(''),
        lead: onMed != null ? `Musim asap umumnya mulai sekitar <b>${alDoyTxt(onMed)}</b> dan selesai <b>${offMed != null ? alDoyTxt(offMed) : 'awal November'}</b>${e0 ? `, tetapi di ${esc(stShort(e0.c))} 2026 maju ${-e0.shift} hari` : ''}.` : null,
        note: nt(`${early.length ? `Maju lebih dari 3 minggu dibanding 2024: ${early.map(r => `${esc(stShort(r.c))} (${-r.shift} hari)`).join(', ')}.` : 'Tidak ada stasiun yang awal musimnya maju lebih dari 3 minggu.'} Musim 2026 masih berlangsung saat data berhenti.`,
          'Tanpa data curah hujan atau titik api; tanggal dihitung dari PM2.5 saja. Stasiun yang sudah di atas 55 pada Januari–Mei (kronis) tidak dihitung.'),
        table: () => ({ cols: [{ k: 'c', l: 'Stasiun' }].concat([2024, 2025, 2026].map(y => ({ k: 'y' + y, l: String(y) }))).concat([{ k: 'sh', l: 'Geser 2024→2026 (hari)', num: 1, fmt: v => v == null ? '–' : (v > 0 ? '+' : '') + v }]),
          rows: KL.rows.map(r => Object.assign({ _st: r.c, c: r.c, sh: r.shift }, Object.fromEntries([2024, 2025, 2026].map(y => ['y' + y, r.yrs[y] ? `${ljD(r.yrs[y].on)} – ${r.yrs[y].open ? 'berlanjut' : ljD(r.yrs[y].off)}` : '–'])))) }),
        info: { rumus: 'Rata-rata bergerak 7 hari (minimal 4 hari sah). Mulai = hari pertama sejak 1 Juni di atas 55; selesai = hari terakhir di atas 55 sampai 31 Desember.', data: 'pm25 harian', filter: false } })}
      ${alJawab('Kapan harus siaga?', `Siaga perlu menyala sejak <b>${onMed != null ? alDoyTxt(onMed) : 'awal Agustus'}</b>${e0 ? ` (di ${esc(stShort(e0.c))} jauh lebih awal)` : ''} dan bertahan sampai <b>${offMed != null ? alDoyTxt(offMed) : 'awal November'}</b>. ${g && mr && Math.abs(gJ / rJ - 1) < .2 ? 'Sebelum itu gambut masih setara wilayah lain, jadi pencegahan harus berjalan sebelum Agustus.' : 'Pencegahan harus berjalan sebelum Agustus.'} ${J.s1 && sMin > BAKU ? 'Selama musim, tidak ada jam yang aman untuk beraktivitas di luar ruang.' : ''}`, [1, 2, 6])}
      </div>`;
  },
  mount() {
    const d = this._d; if (!d) return;
    const gc = cv('--k-gambut');
    mk('musim', { grid: { left: 8, right: 92, top: 22, bottom: 8, containLabel: true }, tooltip: { trigger: 'axis', valueFormatter: v => f(v, 0) + ' µg/m³' },
      xAxis: ax({ type: 'category', data: BULAN, boundaryGap: false }), yAxis: ax({ type: 'value', name: 'PM2.5 µg/m³', nameGap: 8 }),
      series: d.kelIn.map(k => { const G = k === 'Gambut';
        return { name: k, type: 'line', data: d.moyK[k], symbol: G ? 'circle' : 'none', symbolSize: 6, smooth: .25, z: G ? 5 : 2,
          lineStyle: { width: G ? 3.4 : 1.6, color: kelCol(k), opacity: G ? 1 : .75 }, itemStyle: { color: kelCol(k) },
          areaStyle: G ? { color: gc, opacity: .18 } : undefined,
          endLabel: { show: true, formatter: k, fontSize: 11, fontWeight: G ? 700 : 500, color: G ? gc : cv('--ink-2') }, labelLayout: { moveOverlap: 'shiftY' },
          markArea: G ? { silent: true, itemStyle: { color: hexA(gc, .08) }, label: { show: true, position: 'insideTop', formatter: 'musim asap', color: gc, fontSize: 11, fontWeight: 700 }, data: [[{ xAxis: 'Agu' }, { xAxis: 'Okt' }]] } : undefined,
          markLine: G ? mlBaku() : undefined }; }) });
    const J = d.J, hrs = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
    const ln = (name, data, color, w, extra = {}) => data ? Object.assign({ name, type: 'line', data, symbol: 'none', smooth: .3, lineStyle: { width: w, color }, itemStyle: { color } }, extra) : null;
    mk('jam', { grid: { left: 8, right: 16, top: 24, bottom: 8, containLabel: true }, tooltip: { trigger: 'axis', valueFormatter: v => f(v, 0) + ' µg/m³' },
      xAxis: ax({ type: 'category', data: hrs, boundaryGap: false, name: 'jam', nameGap: 4, axisPointer: { label: { formatter: p => p.value + ':00' } } }), yAxis: ax({ type: 'value', min: 0, name: 'µg/m³', nameGap: 8 }),
      series: [ln('Sabuk asap, Agu–Okt', J.s1, gc, 3, { areaStyle: { color: gc, opacity: .16 }, markLine: mlBaku(), z: 4 }),
        ln('Sabuk asap, bulan lain', J.s0, hexA(gc, .45), 2, { lineStyle: { width: 2, color: hexA(gc, .45), type: [6, 4] } }),
        ln('Stasiun lain', J.o, cv('--c1'), 2.2)].filter(Boolean) });
    const KL = ljKalender(), rows = KL.rows, YC = [.3, .6, 1], ic = cv('--ispu-4'), bars = [];
    rows.forEach((r, ri) => [2024, 2025, 2026].forEach((y, yi) => { const v = r.yrs[y]; if (v) bars.push([KL.doy(v.on), KL.doy(v.open ? ND - 1 : v.off), ri, yi, v.open ? 1 : 0, r.c, y, v.off - v.on + 1]); }));
    const el = document.getElementById('kalender'); if (el) el.style.height = Math.max(300, rows.length * 46 + 70) + 'px';
    const months = [[6, 'Jul'], [7, 'Agu'], [8, 'Sep'], [9, 'Okt'], [10, 'Nov'], [11, 'Des']];
    mk('kalender', { grid: { left: 8, right: 18, top: 26, bottom: 10, containLabel: true },
      tooltip: { trigger: 'item', formatter: p => { const b = p.data; return `<b>${esc(stShort(b[5]))}</b> · ${b[6]}<br>Mulai <b>${alDoyTxt(b[0])}</b>, ${b[4] ? 'masih berlangsung saat data berhenti 14 Okt' : `selesai <b>${alDoyTxt(b[1])}</b> (${b[7]} hari)`}`; } },
      xAxis: ax({ type: 'value', min: alDoy(5, 15), max: alDoy(11, 15), axisLabel: { show: false }, splitLine: { show: false } }),
      yAxis: ax({ type: 'category', data: rows.map(r => r.c), inverse: true, splitLine: { show: true, lineStyle: { color: cv('--line'), opacity: .5 } }, axisLine: { show: false },
        axisLabel: { interval: 0, formatter: v => { const r = rows.find(x => x.c === v); return `{n|${stShort(v)}}` + (r.shift != null && r.shift <= -14 ? `\n{e|2026 maju ${-r.shift} hari}` : ''); },
          rich: { n: { color: cv('--ink'), fontSize: 11.5, fontWeight: 700, lineHeight: 15 }, e: { color: cv('--bad'), fontSize: 10, fontWeight: 650, lineHeight: 13 } } } }),
      series: [{ type: 'custom', data: bars, encode: { x: [0, 1], y: 2 },
        renderItem: (p, api) => { const s = api.coord([api.value(0), api.value(2)]), e = api.coord([api.value(1), api.value(2)]), band = api.size([0, 1])[1], yi = api.value(3), h = Math.max(4, band * .19);
          const y = s[1] + (yi - 1) * band * .25 - h / 2, open = api.value(4) === 1, c = hexA(ic, YC[yi]);
          const rc = echarts.graphic.clipRectByRect({ x: s[0], y, width: Math.max(3, e[0] - s[0]), height: h }, { x: p.coordSys.x, y: p.coordSys.y, width: p.coordSys.width, height: p.coordSys.height });
          return rc && { type: 'rect', shape: Object.assign(rc, { r: h / 2 }), style: { fill: open ? new echarts.graphic.LinearGradient(0, 0, 1, 0, [{ offset: 0, color: c }, { offset: .8, color: c }, { offset: 1, color: hexA(ic, .08) }]) : c } }; },
        markLine: { silent: true, symbol: 'none', animation: false, lineStyle: { color: cv('--line-2'), type: [3, 4], width: 1 },
          label: { position: 'end', color: cv('--muted'), fontSize: 11, fontWeight: 600, formatter: p => p.data.t },
          data: months.map(([m, t]) => ({ xAxis: alDoy(m, 1), t })).concat([{ xAxis: KL.doy(ND - 1), t: '14 Okt', lineStyle: { color: cv('--ink'), type: 'dotted', width: 1.5 }, label: { color: cv('--ink'), position: 'start', formatter: 'data berhenti' } }]) } }] },
      p => go('stasiun', { st: p.data[5] }));
  },
};

/* ---------- BAB 3 · FAKTOR ---------- */
const AL3 = {
  html() {
    const codes = active().map(s => s.code); if (!codes.length) return alHead(3, 'Faktor', 'Apa yang menentukan polusi?', '') + emptyMsg;
    const T = t3Shares(codes), R = T.R, F = D.factors, bTop = T.between.slice().sort((a, b) => b[1] - a[1])[0], wTop = T.within.slice().sort((a, b) => b[1] - a[1])[0];
    const wxMax = Math.max(...T.within.slice(3).map(x => x[1] || 0));
    const rRoad = R.length >= 4 ? spearman(R.map(r => r.mean), R.map(r => r.s.road)) : null, rTr = R.length >= 4 ? spearman(R.map(r => r.mean), R.map(r => r.s.traffic)) : null;
    const kg = KEL.map(k => { const g = R.filter(r => r.s.kel === k); return g.length ? { k, avg: mean(g.map(r => r.mean)) } : null; }).filter(Boolean).sort((a, b) => b.avg - a.avg);
    const wxSig = codes.filter(c => Math.abs(F[c].temp) >= .1 || Math.abs(F[c].rh) >= .1 || Math.abs(F[c].ws) >= .1), nz = codes.length - wxSig.length;
    const rose = codes.map(c => roseStats(F[c])).filter(Boolean), rMax = rose.length ? Math.max(...rose.map(q => q.adj)) : null;
    const nm = s => s.split(' (')[0].toLowerCase();
    this._d = { codes, T, R };
    return alHead(3, 'Faktor', 'Apa yang menentukan polusi?', 'Menguji faktor yang membuat PM2.5 berbeda antarstasiun dan naik turun antarhari.') +
      `<div class="grid">
      ${card({ id: 'faktor', span: 's12', h: 'h380', title: 'Faktor mana yang paling menentukan?', sub: `Panjang tangkai = persen ${term('variasi')} PM2.5 yang dijelaskan tiap faktor. Atas: kenapa stasiun berbeda. Bawah: kenapa hari berbeda di stasiun yang sama.`,
        lead: `Naik turun harian paling ditentukan <b>${nm(wTop[0])}</b>${bTop ? ` dan beda antarstasiun oleh <b>${nm(bTop[0])}</b>` : ''}; cuaca harian hampir tidak berperan.`,
        note: nt(`${wTop[0]} ${f(100 * wTop[1], 0)}%${bTop ? `, ${bTop[0].toLowerCase()} ${f(100 * bTop[1], 0)}%` : ''}; suhu, kelembapan, dan angin masing-masing paling banyak ${f(100 * wxMax, 1)}%.`, 'Kedua panel memakai ukuran berbeda, jadi persennya tidak dijumlahkan. Hubungan statistik, bukan sebab-akibat.'),
        table: () => ({ cols: [{ k: 'f', l: 'Faktor' }, { k: 't', l: 'Level' }, { k: 'v', l: '% variasi', num: 1, fmt: v => f(100 * v) }], rows: T.between.map(([a, v]) => ({ f: a, t: 'antarstasiun', v })).concat(T.within.map(([a, v]) => ({ f: a, t: 'dalam stasiun', v }))) }),
        info: { rumus: 'Tipe lokasi, musim, jam, hari: η² (ANOVA satu arah). Jarak, lalu lintas: ρ² Spearman antar rata-rata stasiun. Suhu, kelembapan, angin: ρ² Spearman antara anomali harian (PM2.5 dikurangi rata-rata bulan stasiun itu) dan cuaca, median antarstasiun.', data: 'pm25 harian/jam + sites.csv' } })}
      ${card({ id: 'lokasi', span: 's6', h: 'h400', title: 'Lokasi seperti apa yang paling kotor?', sub: 'Satu titik per stasiun. Mendatar = jarak ke jalan raya, tegak = rata-rata PM2.5, warna = tipe lokasi, besar titik = kendaraan per jam.', legend: legendKel(kg.map(x => x.k)),
        lead: kg.length > 1 ? `<b>${kg[0].k}</b>${kg.length > 2 && kg[0].avg - kg[1].avg < 3 ? ` dan <b>${kg[1].k.toLowerCase()}</b>` : ''} serta stasiun dekat jalan ramai paling kotor, sedangkan <b>${kg[kg.length - 1].k.toLowerCase()}</b> yang jauh dari jalan paling bersih.` : null,
        note: nt(`Rata-rata per tipe: ${kg.map(x => `${x.k.toLowerCase()} ${f(x.avg, 0)}`).join(', ')} µg/m³.${rRoad != null ? ` Hubungan dengan jarak ke jalan ρ = ${f(rRoad, 2)}, dengan lalu lintas ρ = ${f(rTr, 2)}.` : ''}`, `Hanya ${R.length} titik; tipe lokasi, jarak, dan lalu lintas saling berkaitan, jadi porsinya tumpang tindih.`),
        table: () => ({ cols: [{ k: 'code', l: 'Kode' }, { k: 'kel', l: 'Tipe' }, { k: 'road', l: 'Jarak jalan (m)', num: 1, fmt: fi }, { k: 'traffic', l: 'Kendaraan/jam', num: 1, fmt: fi }, { k: 'mean', l: 'PM2.5', num: 1, fmt: v => f(v) }], rows: R.map(r => ({ _st: r.code, code: r.code, kel: r.s.kel, road: r.s.road, traffic: r.s.traffic, mean: r.mean })) }),
        info: { rumus: 'Rata-rata PM2.5 harian (hari sah) per stasiun terhadap atribut lokasi di sites.csv; ρ = korelasi Spearman.', data: 'pm25 harian + sites.csv' } })}
      ${card({ id: 'cuaca', span: 's6', h: 'h400', title: 'Apakah cuaca ikut menentukan?', sub: 'Kiri: kekuatan hubungan cuaca harian dengan PM2.5 per stasiun (pengaruh musim dibuang); pita abu = tidak berarti. Kanan: PM2.5 menurut arah datang angin, 100 = rata-rata biasa; bentuk bulat berarti arah angin tidak berpengaruh.',
        lead: `Di <b>${nz} dari ${codes.length}</b> stasiun cuaca harian tidak berhubungan dengan polusi${rMax ? `, dan arah angin hanya menggeser PM2.5 ${f(100 * (rMax - 1), 0)}%` : ''}.`,
        note: nt(`${!wxSig.length ? 'Tidak ada pengecualian.' : wxSig.every(c => c === 'MDN-01' || c === 'PLB-01') ? `Pengecualian ${wxSig.join(' dan ')} ternyata efek jam data yang hilang; setelah dikoreksi hubungannya hampir nol.` : `Pengecualian: ${wxSig.join(', ')}.`}`, 'Arah dibagi delapan mata angin; arah dengan kurang dari 1% jam tidak dihitung.'),
        table: () => ({ cols: [{ k: 'code', l: 'Kode' }, { k: 'temp', l: 'ρ suhu', num: 1, fmt: v => f(v, 2) }, { k: 'rh', l: 'ρ kelembapan', num: 1, fmt: v => f(v, 2) }, { k: 'ws', l: 'ρ angin', num: 1, fmt: v => f(v, 2) }], rows: codes.map(c => ({ _st: c, code: c, temp: F[c].temp, rh: F[c].rh, ws: F[c].ws })) }),
        info: { rumus: 'Kiri: anomali = PM2.5 harian − rata-rata bulan-tahun stasiun, lalu korelasi Spearman dengan suhu, kelembapan, kecepatan angin harian. Kanan: rata-rata anomali per arah angin (8 sektor) dibagi rata-rata stasiun × 100, dirata-ratakan antarstasiun.', data: 'Data per jam', filter: false } })}
      ${alJawab('Apa yang menentukan polusi?', `<b>Musim dan lokasi</b>, bukan cuaca harian. ${wTop[0].split(' (')[0]} menjelaskan ${f(100 * wTop[1], 0)}% naik turun harian${bTop ? `, ${bTop[0].toLowerCase()} ${f(100 * bTop[1], 0)}% beda antarstasiun` : ''}. Karena cuaca tidak bisa dijadikan tanda, siaga harus dipicu data PM2.5 langsung, dan pencegahan diarahkan ke sumber di lahan gambut dan kawasan industri.`, [2, 3, 1])}
      </div>`;
  },
  mount() {
    const d = this._d; if (!d) return; const T = d.T;
    { const P = [['Kenapa stasiun berbeda?', T.between.slice().sort((a, b) => a[1] - b[1]), cv('--k-gambut')], ['Kenapa hari berbeda?', T.within.slice().sort((a, b) => a[1] - b[1]), cv('--c1')]].filter(x => x[1].length);
      const RH = 30, tops = []; let y = 26; P.forEach(x => { tops.push(y); y += x[1].length * RH + 46; });
      const el = document.getElementById('faktor'); if (el) el.style.height = (y - 20) + 'px';
      mk('faktor', { title: P.map((x, i) => ({ text: x[0], left: 4, top: tops[i] - 24, textStyle: { fontSize: 12.5, fontWeight: 700, color: x[2], fontFamily: FONT } })),
        grid: P.map((x, i) => ({ left: 8, right: 60, top: tops[i], height: x[1].length * RH, containLabel: true })),
        tooltip: { formatter: p => `${p.name}: <b>${f(p.value[0] ?? p.value, 1)}%</b> variasi` },
        xAxis: P.map((_, i) => ax({ gridIndex: i, type: 'value', min: 0, max: 100, axisLabel: { show: i === P.length - 1, formatter: '{value}%', color: cv('--muted'), fontSize: 11 } })),
        yAxis: P.map((x, i) => ax({ gridIndex: i, type: 'category', data: x[1].map(y => y[0]), splitLine: { show: false }, axisLine: { show: false }, axisLabel: { color: cv('--ink-2'), fontSize: 12, width: 150, overflow: 'truncate' } })),
        series: P.flatMap((x, i) => { const top = x[1].length - 1;
          return [{ type: 'bar', xAxisIndex: i, yAxisIndex: i, barWidth: 3, silent: true, data: x[1].map((y, k) => ({ value: 100 * y[1], itemStyle: { color: k === top ? x[2] : hexA(x[2], .35), borderRadius: 2 } })) },
            { type: 'scatter', xAxisIndex: i, yAxisIndex: i, symbolSize: (v, p) => p.dataIndex === top ? 16 : 11, data: x[1].map((y, k) => ({ value: [100 * y[1], y[0]], name: y[0], itemStyle: { color: k === top ? x[2] : cv('--surface'), borderColor: x[2], borderWidth: 2 } })),
              label: { show: true, position: 'right', distance: 8, formatter: p => f(p.value[0], p.value[0] < 1 ? 1 : 0) + '%', fontSize: 11.5, fontWeight: 650, color: cv('--ink') } }]; }) }); }
    { const R = d.R.filter(r => r.s.road != null), rd = R.map(r => Math.max(1, r.s.road)), lg = Math.max(...rd) / Math.min(...rd) > 15, tMax = Math.max(...R.map(r => r.s.traffic || 0)) || 1;
      mk('lokasi', { grid: { left: 8, right: 22, top: 26, bottom: 30, containLabel: true },
        tooltip: { formatter: p => { const r = R[p.dataIndex]; return `<b>${r.code}</b> ${esc(r.s.kota)} · ${r.s.kel}<br>PM2.5 rata-rata <b>${f(r.mean)}</b> µg/m³<br>${fi(r.s.road)} m dari jalan raya · ${fi(r.s.traffic)} kendaraan/jam`; } },
        xAxis: ax({ type: lg ? 'log' : 'value', min: lg ? 5 : 0, max: lg ? v => Math.max(300, v.max * 1.15) : undefined, name: 'jarak ke jalan raya (m)', nameLocation: 'middle', nameGap: 26, splitLine: { show: false } }), yAxis: ax({ type: 'value', min: 0, name: 'PM2.5 µg/m³', nameGap: 8 }),
        series: [{ type: 'scatter', data: R.map((r, i) => ({ value: [rd[i], r.mean], code: r.code, symbolSize: 9 + 20 * Math.sqrt((r.s.traffic || 0) / tMax), itemStyle: { color: hexA(kelCol(r.s.kel), .85), borderColor: cv('--surface'), borderWidth: 1.5 } })),
          label: { show: true, position: 'right', distance: 4, formatter: p => p.data.code, fontSize: 9.5, color: cv('--ink-2') }, labelLayout: { hideOverlap: true }, emphasis: { scale: 1.25 },
          markLine: mlBaku() }] }, toStation); }
    { const F = D.factors, codes = d.codes, el = document.getElementById('cuaca'), W = el ? el.clientWidth : 600, nar = W < 520, vars = [['temp', 'Suhu'], ['rh', 'Kelembapan'], ['ws', 'Angin']];
      if (el && nar) el.style.height = '560px';
      const pts = []; vars.forEach(([k], j) => codes.forEach((c, i) => pts.push({ value: [F[c][k], j + ((i * 29) % 7 - 3) * .06], code: c, k, itemStyle: { color: Math.abs(F[c][k]) >= .1 ? cv('--k-gambut') : hexA(cv('--c1'), .7) } })));
      const idx = ROSE_SEC.map(() => []);
      codes.forEach(c => { const fw = F[c], q = roseStats(fw); if (!q) return; const v = q.ok.map((o, i) => o ? fw.wind_adj[i] : null), mu = mean(v.filter(x => x != null)); v.forEach((x, i) => { if (x != null) idx[i].push(100 * x / mu); }); });
      const iv = idx.map(a => a.length ? mean(a) : null);
      const ttl = (text, left, top) => ({ text, left, top, textStyle: { fontSize: 12.5, fontWeight: 700, color: cv('--ink'), fontFamily: FONT } });
      mk('cuaca', { title: nar ? [ttl('Cuaca harian (ρ)', 4, 0), ttl('Arah angin', 4, 300)] : [ttl('Cuaca harian (ρ)', 4, 0), ttl('Arah angin', '64%', 0)],
        grid: nar ? { left: 8, right: 12, top: 28, height: 220, containLabel: true } : { left: 8, right: '40%', top: 28, bottom: 26, containLabel: true },
        polar: nar ? { radius: ['6%', '30%'], center: ['50%', 430] } : { radius: ['6%', '62%'], center: ['80%', '55%'] },
        tooltip: { formatter: p => p.seriesType === 'bar' ? `Angin dari <b>${ROSE_SEC[p.dataIndex].toLowerCase()}</b><br>PM2.5 = <b>${f(p.value, 1)}</b> (100 = biasa)` : `<b>${p.data.code}</b> ${esc(BY[p.data.code].kota)}<br>ρ ${vars.find(v => v[0] === p.data.k)[1].toLowerCase()}: <b>${f(p.data.value[0], 2)}</b>` },
        xAxis: ax({ type: 'value', min: -.6, max: .6, axisLine: { show: false }, axisLabel: { formatter: v => f(v, 1), color: cv('--muted'), fontSize: 10.5 } }),
        yAxis: ax({ type: 'value', min: -.5, max: 2.5, interval: .5, splitLine: { show: false }, axisLabel: { formatter: v => Number.isInteger(v) ? (vars[v] || [])[1] || '' : '', color: cv('--ink-2'), fontSize: 12, hideOverlap: false } }),
        angleAxis: { type: 'category', data: ['U', 'TL', 'T', 'Tg', 'S', 'BD', 'B', 'BL'], startAngle: 112.5, axisLine: { lineStyle: { color: cv('--line-2') } }, axisTick: { show: false }, axisLabel: { color: cv('--ink-2'), fontSize: 11, fontWeight: 600 }, splitLine: { show: true, lineStyle: { color: cv('--line') } } },
        radiusAxis: { min: 0, max: 110, interval: 50, axisLabel: { show: false }, axisLine: { show: false }, splitLine: { lineStyle: { color: cv('--line'), type: 'dashed' } } },
        series: [{ type: 'scatter', data: pts, symbolSize: 9, itemStyle: { borderColor: cv('--surface'), borderWidth: 1 },
            markArea: { silent: true, itemStyle: { color: cv('--surface-3'), opacity: .8 }, label: { show: true, position: 'insideTop', formatter: 'tidak berarti', color: cv('--muted'), fontSize: 10 }, data: [[{ xAxis: -.1 }, { xAxis: .1 }]] } },
          { type: 'bar', coordinateSystem: 'polar', data: iv, barWidth: '80%', itemStyle: { color: hexA(cv('--c1'), .75), borderColor: cv('--surface'), borderWidth: 1 } }] }, p => { if (p.data && p.data.code) go('stasiun', { st: p.data.code }); }); }
  },
};

/* ---------- BAB 4 · KESEHATAN ---------- */
const AL4 = {
  html() {
    const A = alPinjam('ambang', ['amb']), T = alPinjam('t4', ['allst']), RS = alPinjam('rs', ['rsd', 'rsx']);
    const M = D.model.outcomes, ks = Object.keys(OUTC).filter(k => M[k]), byPct = ks.slice().sort((a, b) => M[b].lags[0].pct - M[a].lags[0].pct);
    const later = k => 100 * ((1 + M[k].cum.pct / 100) / (1 + M[k].lags[0].pct / 100) - 1), lMax = Math.max(...ks.map(k => Math.abs(later(k))));
    const u5 = M.u5.lags[0], o60 = M.o60.lags[0], ovl = u5.lo <= o60.hi && o60.lo <= u5.hi;
    const AM = ljAmbang(), RR = ljRS(), over = RR.rs.filter(r => r.over > 0);
    return alHead(4, 'Kesehatan', 'Apa dampaknya ke kesehatan?', 'Menghubungkan PM2.5 dengan pasien dan kematian di rumah sakit rujukan.') +
      `<div class="grid">
      ${A.amb}
      ${card({ id: 'efek', span: 's12', h: 'h380', title: 'Penyakit apa yang naik, dan kapan?', sub: `Titik = persen kenaikan kasus pada hari yang sama untuk tiap kenaikan PM2.5 10 µg/m³, garis = ${term('IK 95%', 'selang kepercayaan 95%')}. Belah ketupat abu = total tambahan pada 7 hari sesudahnya.`,
        legend: '<span><i style="background:var(--k-gambut);border-radius:50%"></i>ISPA balita</span><span><i style="background:var(--k-industri);border-radius:50%"></i>ISPA lansia</span><span><i style="background:var(--brand);border-radius:50%"></i>Luaran lain</span><span><i style="background:var(--muted);transform:rotate(45deg);border-radius:1px"></i>7 hari sesudahnya</span>',
        lead: `Kasus naik <b>di hari polusi itu juga</b>, terbesar pada ${lcf(OUTC[byPct[0]].l)}, dan ${ovl ? 'balita sama rentannya dengan lansia' : 'balita dan lansia berbeda'}.`,
        note: nt(`Hari yang sama: ${byPct.map(k => `${lcf(OUTC[k].l)} ${fp(M[k].lags[0].pct)}`).join(', ')}. Tambahan 7 hari sesudahnya paling besar ${f(lMax, 1)}%, jadi dampaknya tidak menyusul.`, 'Hubungan statistik pada data panitia (model Poisson dengan kontrol musim, hari, dan suhu), bukan bukti sebab-akibat.'),
        table: () => ({ cols: [{ k: 'o', l: 'Luaran' }, { k: 'p', l: 'Hari yang sama', num: 1, fmt: v => fp(v, 2) }, { k: 'lo', l: 'IK bawah', num: 1, fmt: v => f(v, 2) }, { k: 'hi', l: 'IK atas', num: 1, fmt: v => f(v, 2) }, { k: 'l', l: '7 hari sesudahnya', num: 1, fmt: v => fp(v, 2) }],
          rows: ks.map(k => ({ o: OUTC[k].s, p: M[k].lags[0].pct, lo: M[k].lags[0].lo, hi: M[k].lags[0].hi, l: later(k) })) }),
        info: { rumus: 'Model distributed-lag Poisson: lag 0–7 bersamaan + efek tetap RS × bulan-tahun + hari + suhu. Hari yang sama = koefisien lag 0; 7 hari sesudahnya = kumulatif 0–7 dibagi lag 0.', data: `${fi(D.model.n)} hari-RS dari 25 pasangan stasiun–RS`, filter: false } })}
      ${T.allst}
      ${RS.rsd}${RS.rsx}
      ${alJawab('Apa dampaknya ke kesehatan?', `Kasus RS naik pada hari yang sama dan sudah terasa sejak PM2.5 <b>35 µg/m³</b> (${fp(100 * (AM.r.resp[2] - 1))} kasus pernapasan), sebelum baku harian 55 terlampaui. Saat musim asap 2026, ${fi(RR.tot)} kematian di atas normal tercatat dan ${over.length} RS menerima pasien baru melebihi tempat tidurnya.`, [5, 4, 6])}
      <div class="al-dummy" hidden><div id="case"></div></div>
      </div>`;
  },
  mount(C) {
    PAGES.ambang.mount.call(PAGES.ambang, C);
    PAGES.t4.mount.call(PAGES.t4, C);
    PAGES.rs.mount.call(PAGES.rs, C);
    C.querySelectorAll('.al-dummy').forEach(x => x.remove());
    const M = D.model.outcomes, ko = Object.keys(OUTC).filter(k => M[k]).sort((a, b) => M[a].lags[0].pct - M[b].lags[0].pct);
    const later = k => 100 * ((1 + M[k].cum.pct / 100) / (1 + M[k].lags[0].pct / 100) - 1);
    const col = k => k === 'u5' ? cv('--k-gambut') : k === 'o60' ? cv('--k-industri') : cv('--brand');
    const xMax = Math.ceil(Math.max(...ko.map(k => M[k].lags[0].hi)) + 1), xMin = Math.min(-1, Math.floor(Math.min(...ko.map(later)) - .5));
    mk('efek', { grid: { left: 8, right: 30, top: 26, bottom: 26, containLabel: true },
      tooltip: { formatter: p => { const k = ko[p.dataIndex], e = M[k].lags[0]; return `<b>${OUTC[k].s}</b><br>Hari yang sama: <b>${fp(e.pct, 2)}</b> (IK ${f(e.lo, 2)} s.d. ${f(e.hi, 2)}%)<br>7 hari sesudahnya: ${fp(later(k), 2)}`; } },
      xAxis: ax({ type: 'value', min: xMin, max: xMax, axisLabel: { formatter: '{value}%', color: cv('--muted'), fontSize: 11 } }),
      yAxis: ax({ type: 'category', data: ko.map(k => OUTC[k].l), splitLine: { show: true, lineStyle: { color: cv('--line'), opacity: .5 } }, axisLine: { show: false }, axisLabel: { color: cv('--ink-2'), fontSize: 12 } }),
      series: [{ type: 'custom', data: ko.map((k, i) => [M[k].lags[0].lo, M[k].lags[0].hi, M[k].lags[0].pct, i]), encode: { x: [0, 1, 2], y: 3 }, z: 3,
          renderItem: (p, api) => { const i = api.value(3), k = ko[i], a = api.coord([api.value(0), i]), b = api.coord([api.value(1), i]), c = api.coord([api.value(2), i]), cl = col(k);
            return { type: 'group', children: [{ type: 'line', shape: { x1: a[0], y1: a[1], x2: b[0], y2: b[1] }, style: { stroke: hexA(cl, .55), lineWidth: 4, lineCap: 'round' } },
              { type: 'circle', shape: { cx: c[0], cy: c[1], r: 7 }, style: { fill: cl, stroke: cv('--surface'), lineWidth: 2 } },
              { type: 'text', style: { text: fp(api.value(2)), x: b[0] + 10, y: b[1], verticalAlign: 'middle', fill: cv('--ink'), fontSize: 12, fontWeight: 700, fontFamily: FONT } }] }; } },
        { type: 'scatter', symbol: 'diamond', symbolSize: 11, z: 2, data: ko.map(k => [later(k), OUTC[k].l]), itemStyle: { color: hexA(cv('--muted'), .75), borderColor: cv('--surface'), borderWidth: 1 }, tooltip: { show: false },
          markLine: { silent: true, symbol: 'none', label: { show: true, position: 'end', formatter: 'tanpa efek', color: cv('--muted'), fontSize: 10.5 }, lineStyle: { color: cv('--ink-2'), type: 'dotted', width: 1.5 }, data: [{ xAxis: 0 }] } }] });
  },
};

/* ---------- pasang ke halaman bab ---------- */
[AL1, AL2, AL3, AL4].forEach((B, i) => {
  const id = AN_CH[i][0];
  PAGES['bab' + (i + 1)] = {
    title: AN_LABEL[id], nav: AN_LABEL[id], group: 'Alur analisis',
    html() { return `<div class="an-wrap"><section class="an-sec" id="sec-${id}" data-sec="${id}">${B.html.call(B)}</section>${anNav(i)}</div>`; },
    mount(C) { B.mount.call(B, C); const el = C.querySelector('#sec-' + id); if (el) autoTerms(el); window.AN_CUR = null; anSpy(); },
  };
});
