/* Analisis lanjutan: dari temuan ke tindakan.
   Empat halaman (ambang, kalender, rs, beban) + T5 Jaringan sebagai penutup. Semua angka dihitung saat runtime dari window.DATA;
   filter global tidak berlaku (jendela tetap, ditulis di tiap halaman). */
const LANJUT = ['ambang', 'kalender', 'rs', 't5'];   // 'beban' disembunyikan sementara (kode halamannya tetap ada)
const LJ_NAV = { ambang: ['gauge', 'Ambang nyata'], kalender: ['cal', 'Kalender siaga'], rs: ['heart', 'RS kewalahan'], beban: ['warn', 'Beban tersembunyi'], t5: ['pin', 'Jaringan pemantau'] };
const ljD = i => { const d = dayDate(i); return d.getUTCDate() + ' ' + BULAN[d.getUTCMonth()]; };
const ljMD = i => { const d = dayDate(i); return d.getUTCDate() + ' ' + BULAN[d.getUTCMonth()] + ' ' + d.getUTCFullYear(); };
const ljQ25 = a => { const s = a.filter(v => v != null).sort((x, y) => x - y); return s[Math.floor(.25 * (s.length - 1))]; };
const ljUse = () => ST.filter(s => s.use !== 'rusak');

/* penutup tiap halaman lanjutan: tabel tindakan (siapa · apa · kapan), batasan, tombol ke halaman berikutnya */
function ljTutup() { return ''; }   // kartu "Jadi, apa yang harus dilakukan?" dihapus; tindakan ada di halaman Aksi pemerintah
const ljKick = (n, t) => `Langkah ${n} · ${t}`;

/* ---------- sabuk asap = stasiun yang PM2.5 Agu–Okt ≥ 2× bulan lain (ditentukan data, bukan daftar tetap) */
let LJS = null;
function ljSabuk() {
  if (LJS) return LJS;
  LJS = ljUse().map(s => { const pm = D.pm25[s.code], a = [], b = [];
    pm.forEach((v, i) => { if (v == null) return; const m = dayDate(i).getUTCMonth(); (m >= 7 && m <= 9 ? a : b).push(v); });
    return { c: s.code, x: mean(a) / mean(b) }; }).filter(r => r.x >= 2).map(r => r.c);
  return LJS;
}

/* ================= 1. AMBANG NYATA ================= */
const LJ_BIN = [[15.5, '≤ 15', '--ispu-1'], [35, '15–35', '--ispu-2'], [55.4, '35–55', '--ispu-2'], [100, '55–100', '--ispu-3'], [150.4, '100–150', '--ispu-3'], [250.4, '150–250', '--ispu-4'], [Infinity, '> 250', '--ispu-5']];
const LJ_OUT = { resp: 'Pernapasan umum', u5: 'ISPA balita', o60: 'ISPA lansia', asma: 'Darurat asma', death: 'Kematian' };
let LJA = null;
function ljAmbang() {
  if (LJA) return LJA;
  const acc = {}; for (const o in LJ_OUT) acc[o] = LJ_BIN.map(() => ({ s: 0, n: 0 }));
  const nDay = LJ_BIN.map(() => 0), band = {};
  for (const s of ljUse()) {
    const pm = D.pm25[s.code], h = D.health[s.rs]; if (!h) continue;
    const q = ljQ25(pm), cl = []; pm.forEach((v, i) => { if (v != null && v <= q) cl.push(i); });
    const base = {}; for (const o in LJ_OUT) base[o] = mean(cl.map(i => h[o][i]));
    band[s.code] = 0;
    pm.forEach((v, i) => {
      if (v == null) return; const b = LJ_BIN.findIndex(x => v <= x[0]); nDay[b]++; if (b === 2) band[s.code]++;
      for (const o in LJ_OUT) if (base[o] > 0 && h[o][i] != null) { acc[o][b].s += h[o][i] / base[o]; acc[o][b].n++; }
    });
  }
  const r = {}; for (const o in LJ_OUT) r[o] = acc[o].map(x => x.n ? x.s / x.n : null);
  LJA = { r, nDay, band };
  return LJA;
}
PAGES.ambang = {
  title: 'Ambang nyata', nav: 'Ambang nyata', group: 'Analisis lanjutan',
  html() {
    const A = ljAmbang(), o = this._o || 'resp', R = A.r[o], rr = A.r.resp, rd = A.r.death;
    const nB = A.nDay[2], top = Object.entries(A.band).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const pc = v => fp(100 * (v - 1));
    const fu = R.findIndex((v, i) => i > 0 && v != null && v >= 1.1);   // pita pertama dengan kasus naik jelas (>= 1,1 kali)
    const ambLead = fu < 0 ? `${LJ_OUT[o]} tidak naik jelas pada kadar PM2.5 mana pun yang diuji.` : fu <= 2 ? `${LJ_OUT[o]} sudah naik jelas di pita <b>${LJ_BIN[fu][1]} µg/m³</b>, sebelum baku harian terlampaui.` : `${LJ_OUT[o]} baru naik jelas di pita <b>${LJ_BIN[fu][1]} µg/m³</b>, setelah baku harian terlampaui.`;
    return '';   // bagian ini dikosongkan (grafik ambang dihapus)
  },
  mount(C) {
  },
};

/* ================= 2. KALENDER SIAGA ================= */
let LJK = null;
function ljKalender() {
  if (LJK) return LJK;
  const rows = [];
  const sab = ljSabuk();
  for (const s of ljUse().filter(s => sab.includes(s.code))) {
    const pm = D.pm25[s.code], roll = pm.map((_, i) => { const w = pm.slice(Math.max(0, i - 6), i + 1).filter(v => v != null); return w.length >= 4 ? mean(w) : null; });
    const yrs = {};
    for (const y of [2024, 2025, 2026]) {
      const j0 = dayIdx(`${y}-01-01`), j1 = dayIdx(`${y}-05-31`), d0 = dayIdx(`${y}-06-01`), d1 = Math.min(dayIdx(`${y}-12-31`), ND - 1);
      if (roll.slice(j0, j1 + 1).some(v => v != null && v > BAKU)) continue;        // sudah tinggi sebelum Juni = kronis, bukan musiman
      let on = null, off = null; for (let i = d0; i <= d1; i++) if (roll[i] != null && roll[i] > BAKU) { if (on == null) on = i; off = i; }
      if (on != null) yrs[y] = { on, off, open: y === 2026 && off >= ND - 3 };
    }
    if (Object.keys(yrs).length >= 2) rows.push({ c: s.code, yrs });
  }
  const doy = i => { const d = dayDate(i); return Math.round((Date.UTC(2026, d.getUTCMonth(), d.getUTCDate()) - Date.UTC(2026, 0, 1)) / 864e5); };
  rows.forEach(r => { const o = Object.values(r.yrs).map(x => doy(x.on)); r.spread = Math.max(...o) - Math.min(...o); r.first = Math.min(...o);
    const y = r.yrs; r.shift = y[2024] && y[2026] ? doy(y[2026].on) - doy(y[2024].on) : null; });
  rows.sort((a, b) => a.first - b.first);
  LJK = { rows, doy };
  return LJK;
}
const ljRoll = (() => { const C = {}; return c => C[c] || (C[c] = D.pm25[c].map((_, i) => { const w = D.pm25[c].slice(Math.max(0, i - 6), i + 1).filter(v => v != null); return w.length >= 4 ? mean(w) : null; })); })();
const LJ_BLN = ['', 'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'], ljPad = n => String(n).padStart(2, '0');
function ljKalBody(self, rows, K) {
  const ord = rows.slice().sort((a, b) => (a.yrs[2026] ? K.doy(a.yrs[2026].on) : 9e3) - (b.yrs[2026] ? K.doy(b.yrs[2026].on) : 9e3));
  const sel = self._ks && ord.find(r => r.c === self._ks);
  if (!sel) {
    const all = ord.flatMap(r => [2024, 2025, 2026].map(y => r.yrs[y] ? K.doy(r.yrs[y].on) : null)).filter(v => v != null), lo = Math.min(...all), hi = Math.max(...all);
    const cell = r => y => { const v = r.yrs[y]; if (!v) return '<td class="kal-n">–</td>'; const t = (K.doy(v.on) - lo) / Math.max(1, hi - lo); return `<td class="kal-c" style="background:color-mix(in srgb, var(--ispu-3) ${Math.round(48 - 40 * t)}%, var(--surface))">${ljD(v.on)}</td>`; };
    const gap = r => r.shift == null ? '–' : r.shift <= -14 ? `<b class="kal-e">${-r.shift} hari lebih awal</b>` : r.shift >= 14 ? `${r.shift} hari lebih lambat` : 'pekan yang sama';
    return `<div class="tbl-wrap" style="max-height:none"><table class="t kal-t kal-pick"><thead><tr><th>Stasiun</th><th>Mulai 2024</th><th>Mulai 2025</th><th>Mulai 2026</th><th>2026 dibanding 2024</th><th></th></tr></thead><tbody>${ord.map(r => `<tr data-ks="${r.c}" tabindex="0"><td>${esc(stShort(r.c))}${BY[r.c].use === 'parsial' ? '*' : ''}</td>${[2024, 2025, 2026].map(cell(r)).join('')}<td>${gap(r)}</td><td class="kal-go">Lihat kalender →</td></tr>`).join('')}</tbody></table></div>`;
  }
  const y = self._ky || 2026, r = sel.yrs[y], roll = ljRoll(sel.c);
  const months = [6, 7, 8, 9, 10, 11].map(m => {
    const lead = (new Date(Date.UTC(y, m - 1, 1)).getUTCDay() + 6) % 7, nd = new Date(Date.UTC(y, m, 0)).getUTCDate();
    let cells = '<span class="cd e"></span>'.repeat(lead);
    for (let dd = 1; dd <= nd; dd++) {
      const i = dayIdx(`${y}-${ljPad(m)}-${ljPad(dd)}`), v = i < ND ? roll[i] : null, inS = r && i >= r.on && i <= r.off; let cl = 'cd';
      if (i >= ND) cl += ' x'; else if (inS) cl += v != null && v > 150.4 ? ' ks4' : ' ks3'; else cl += v == null ? ' z nd' : ' z';
      if (r && i === r.on) cl += ' cs'; if (r && !r.open && i === r.off) cl += ' ce';
      const st = i >= ND ? 'Belum ada data' : v == null && !inS ? 'Data tidak cukup (stasiun parsial), status tidak bisa dipastikan' : v == null ? 'Dalam musim asap (data hari ini kosong)' : r && i === r.on ? 'Hari mulai musim asap' : r && !r.open && i === r.off ? 'Hari selesai musim asap' : inS ? 'Dalam musim asap' : 'Di luar musim asap';
      const tip = `<b>${dd} ${BULAN[m - 1]} ${y}</b> ${v != null ? ispuBadge(v) : ''}<br>${v != null ? `PM2.5 <b>${f(v)}</b> µg/m³ (rata-rata 7 hari)<br>` : ''}${st}`;
      cells += `<span class="${cl}" data-kt="${esc(tip)}">${dd}</span>`;
    }
    return `<div class="kc-m"><div class="kc-h">${LJ_BLN[m]}</div><div class="kc-w">${['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map(x => `<span>${x}</span>`).join('')}</div><div class="kc-d">${cells}</div></div>`;
  }).join('');
  const sum = r ? `Musim asap ${y} mulai <b>${ljD(r.on)}</b>${r.open ? ', masih berlangsung saat data berhenti (14 Okt).' : `, selesai <b>${ljD(r.off)}</b> (${r.off - r.on + 1} hari).`}` : `Tidak ada musim asap terdeteksi di ${esc(stShort(sel.c))} pada ${y}.`;
  return `<div class="kc-top"><button type="button" class="btn sm" data-kback>← Semua stasiun</button><b class="kc-n">${esc(stShort(sel.c))}${BY[sel.c].use === 'parsial' ? '*' : ''}</b>${seg('kly', [[2024, '2024'], [2025, '2025'], [2026, '2026']], y)}</div>
    <p class="kc-sum">${sum}</p><div class="kc-grid">${months}</div>
    <div class="kc-leg"><span><i class="cd ks3"></i>musim asap</span><span><i class="cd ks4"></i>sangat tidak sehat</span><span><i class="cd cs"></i>hari mulai</span><span><i class="cd ce"></i>hari selesai</span><span><i class="cd z"></i>di luar musim</span><span><i class="cd z nd"></i>data kosong</span></div>`;
}
PAGES.kalender = {
  title: 'Kalender siaga', nav: 'Kalender siaga', group: 'Analisis lanjutan',
  html() {
    const K = ljKalender(), rows = K.rows, stable = rows.filter(r => r.spread <= 7), early = rows.filter(r => r.shift != null && r.shift <= -21).sort((a, b) => a.shift - b.shift);
    const on26 = stable.filter(r => r.yrs[2026]).map(r => K.doy(r.yrs[2026].on)).sort((a, b) => a - b);
    const dTxt = d => { const x = new Date(Date.UTC(2026, 0, 1) + d * 864e5); return x.getUTCDate() + ' ' + BULAN[x.getUTCMonth()]; };
    const e0 = early[0];
    this._t = { stable, early };
    return `<div class="grid">
      <h2 class="t-sec">Kapan musim asap mulai?</h2>
      ${card({ id: 'kal', span: 's12', title: 'Kapan musim asap mulai di tiap stasiun?', sub: `Pilih satu stasiun untuk melihat kalender penuhnya. Tanggal mulai = hari pertama rata-rata 7 hari PM2.5 di atas ${BAKU} µg/m³.`,
        body: ljKalBody(this, rows, K),
                lead: (() => { const a = dTxt(on26[Math.floor(on26.length * .25)]), b = dTxt(on26[Math.ceil(on26.length * .75) - 1]); return `Awal musim asap 2026 umumnya jatuh sekitar <b>${a === b ? a : a + '–' + b}</b>, pekan yang sama dengan 2024 dan 2025.`; })(), note: nt(`Di ${stable.length} stasiun yang stabil, awal musim 2026 umumnya jatuh pada <b>${dTxt(on26[Math.floor(on26.length * .25)])}–${dTxt(on26[Math.ceil(on26.length * .75) - 1])}</b>, pekan yang sama dengan 2024 dan 2025; musim 2024 dan 2025 berakhir awal November.${early.length ? ` Yang maju lebih dari 3 minggu: <b>${early.map(r => `${esc(stShort(r.c))} (${-r.shift} hari)`).join(', ')}</b>.` : ''}`,
          `Tanpa data curah hujan atau titik api; tanggal dihitung dari PM2.5 saja. Stasiun bertanda * berdata parsial, jadi tanggal akhirnya bisa terpotong oleh data hilang.`),
        table: () => ({ cols: [{ k: 'c', l: 'Stasiun' }, { k: 'k', l: 'Kota' }].concat([2024, 2025, 2026].map(y => ({ k: 'y' + y, l: String(y) }))).concat([{ k: 'sh', l: 'Geser 2024→2026 (hari)', num: 1, fmt: v => v == null ? '–' : (v > 0 ? '+' : '') + v }]),
          rows: rows.map(r => Object.assign({ _st: r.c, c: r.c, k: BY[r.c].kota, sh: r.shift }, Object.fromEntries([2024, 2025, 2026].map(y => [ 'y' + y, r.yrs[y] ? `${ljD(r.yrs[y].on)} – ${r.yrs[y].open ? 'berlanjut' : ljD(r.yrs[y].off)}` : '–' ])))) }),
        info: { rumus: 'Rata-rata bergerak 7 hari (minimal 4 hari sah). Awal = hari pertama sejak 1 Juni di atas 55; akhir = hari terakhir di atas 55 sampai 31 Des. Stasiun-tahun yang sudah > 55 pada Jan–Mei tidak dihitung (kronis).', data: 'pm25 harian', filter: false } })}
      ${ljTutup('kalender', `Musim asap rata-rata dimulai awal Agustus dan berakhir awal November (≈ 90 hari).${e0 ? ` Di ${esc(stShort(e0.c))}, awal musim maju ${-e0.shift} hari dalam dua tahun, sehingga jadwal "mulai Agustus" sudah terlambat di sana.` : ''}`,
        [['BPBD dan Dinas Kesehatan sabuk asap', 'Stok masker, oksigen, dan jadwal tenaga RS siap; posko asap dibuka', 'Pekan terakhir Juli'],
         ['BPBD dan Dinkes Kalimantan Tengah', 'Semua persiapan di atas', 'Pertengahan Juni (sebulan lebih awal)'],
         ['Pemda dan BPBD', 'Status siaga dicabut mengikuti data, bukan tanggal', 'Saat rata-rata 7 hari < 55 µg/m³ (biasanya awal November)']],
        'tiga tahun data adalah sejarah yang pendek. Pergeseran di Kalteng perlu dipantau tiap tahun, bukan dianggap pasti berlanjut.')}
      </div>`;
  },
  mount(C) {
    C.querySelectorAll('[data-ks]').forEach(tr => { const go = () => { this._ks = tr.dataset.ks; render(false); }; tr.onclick = go; tr.onkeydown = e => { if (e.key === 'Enter') go(); }; });
    const bk = C.querySelector('[data-kback]'); if (bk) bk.onclick = () => { this._ks = null; render(false); };
    bindSeg(C, 'kly', v => { this._ky = +v; render(false); });
    const tp = document.getElementById('kcTip') || document.body.appendChild(Object.assign(document.createElement('div'), { id: 'kcTip', className: 'kc-tip' }));
    const hide = () => { tp.style.display = 'none'; };
    C.querySelectorAll('.kc-d .cd').forEach(c => {
      c.onmouseenter = () => { tp.innerHTML = c.dataset.kt; tp.style.display = 'block'; const b = c.getBoundingClientRect(), w = tp.offsetWidth, h = tp.offsetHeight;
        tp.style.left = Math.max(8, Math.min(innerWidth - w - 8, b.left + b.width / 2 - w / 2)) + 'px'; tp.style.top = (b.top - h - 8 < 8 ? b.bottom + 8 : b.top - h - 8) + 'px'; };
      c.onmouseleave = hide;
    });
    this._kh = hide; C.addEventListener('mouseleave', hide);
  },
};

/* ================= 3. RS KEWALAHAN ================= */
const ljL = k => ({ u5: 'ISPA balita', o60: 'ISPA lansia', asma: 'darurat asma', ppok: 'PPOK', resp: 'pernapasan umum', cvd: 'kardiovaskular', death: 'kematian' })[k];
let LJR = null;
function ljRS() {
  if (LJR) return LJR;
  const b0 = dayIdx('2026-01-01'), b1 = dayIdx('2026-05-31'), w0 = dayIdx('2026-08-01'), w1 = ND - 1, p0 = dayIdx('2024-08-01'), p1 = dayIdx('2024-10-14');
  const rs = ST.filter(s => D.health[s.rs]).map(s => { const h = D.health[s.rs], bd = mean(h.death.slice(b0, b1 + 1)), br = mean(h.resp.slice(b0, b1 + 1));
    let ex = 0, pk = 0, pki = w0, over = 0; for (let i = w0; i <= w1; i++) { ex += h.death[i] - bd; }
    for (let i = dayIdx('2026-06-01'); i <= w1; i++) { if (h.resp[i] > pk) { pk = h.resp[i]; pki = i; } if (s.rs_tt && h.resp[i] > s.rs_tt) over++; }
    return { c: s.code, rs: s.rs, nama: s.rs_nama, tt: s.rs_tt, ex, bd, br, pk, pki, x: pk / br, over }; });
  const sab = ljSabuk(), grp = codes => { const out = {}; for (const o of ['u5', 'o60', 'asma', 'ppok', 'resp', 'cvd', 'death']) {
      let a = 0, b = 0; for (const c of codes) { const h = D.health[BY[c].rs]; for (let i = w0; i <= dayIdx('2026-10-14'); i++) a += h[o][i]; for (let i = p0; i <= p1; i++) b += h[o][i]; } out[o] = 100 * (a / b - 1); } return out; };
  LJR = { rs, tot: sum(rs.map(r => r.ex)), sabTot: sum(rs.filter(r => sab.includes(r.c)).map(r => r.ex)), vS: grp(sab), vL: grp(ljUse().map(s => s.code).filter(c => !sab.includes(c))), sab };
  return LJR;
}
PAGES.rs = {
  title: 'RS kewalahan', nav: 'RS kewalahan', group: 'Analisis lanjutan',
  html() {
    const R = ljRS(), rs = R.rs, byX = rs.slice().sort((a, b) => b.x - a.x), top = byX[0], kt = rs.filter(r => /^KTG/.test(r.c));
    if (!this._c) this._c = top.c;
    const cur = rs.find(r => r.c === this._c) || top, ov = rs.filter(r => r.over > 0).sort((a, b) => b.over - a.over);
    const vk = Object.keys(R.vS).filter(k => k !== 'resp').sort((a, b) => R.vS[b] - R.vS[a]);
    return ph({ k: ljKick(4, 'Apa yang kewalahan'), h: 'Seberapa parah beban RS?',
      lede: 'Membandingkan beban pasien pernapasan dan kematian di rumah sakit rujukan saat musim asap dengan kondisi normal.',
      scope: '1 Agu–14 Okt 2026 dibanding rata-rata Jan–Mei 2026 tiap RS · data RS apa adanya, tanpa model · filter global tidak berlaku' }) +
      `<div class="grid">
      <h2 class="t-sec">Seberapa penuh?</h2>
      ${card({ id: 'rsd', span: 's8', h: 'h400', title: `Kapan pasien melonjak di ${esc(cur.nama)}?`, sub: `Garis = pasien baru per hari, Juni–14 Oktober 2026. Garis titik hitam = kapasitas tempat tidur dan "hari biasa" (rata-rata Januari–Mei RS ini).`,
        ctrl: `<span class="ctrl"><span>RS</span><select class="sel" id="rsSel" aria-label="Pilih RS">${byX.map(r => `<option value="${r.c}" ${r.c === cur.c ? 'selected' : ''}>${esc(r.nama)} (${esc(stShort(r.c))})</option>`).join('')}</select></span>`,
        lead: `Pasien melonjak sampai <b>${fi(cur.pk)}</b> orang sehari, ${f(cur.x, 1)} kali hari biasa.`, note: nt(`Puncak <b>${fi(cur.pk)}</b> pasien pada ${ljMD(cur.pki)}, <b>${f(cur.x, 1)}×</b> hari biasa (${f(cur.br, 1)}).${cur.tt ? ` Kapasitas ${fi(cur.tt)} tempat tidur${cur.over ? `; pasien baru sehari melebihi seluruh tempat tidur pada <b>${cur.over}</b> hari` : ''}.` : ''}`,
          'Pasien baru per hari, bukan jumlah pasien yang sedang dirawat; lama rawat tidak ada di data.'),
        info: { rumus: 'Kolom resp (rawat pernapasan umum) per hari, RS dipasangkan dengan stasiun bernomor sama. Kapasitas = kapasitas_tempat_tidur di hospitals.csv.', data: 'HLT-01 + hospitals.csv', filter: false } })}
      ${card({ id: 'rsx', span: 's4', h: 'h400', title: 'RS mana kematiannya paling di atas normal?', sub: 'Batang = kematian per hari 1 Agu–14 Okt 2026 dibanding rata-rata Jan–Mei 2026 RS itu, untuk 10 RS teratas.',
        note: nt(`${kt.map(r => `<b>${esc(stShort(r.c))}</b>`).join(' dan ')} menyumbang ${f(100 * sum(kt.map(r => r.ex)) / R.tot, 0)}% dari seluruh kelebihan kematian.`, 'Deskriptif: selisih dengan rata-rata awal tahun, tidak memisahkan penyebab.'),
        table: () => ({ cols: [{ k: 'nama', l: 'RS' }, { k: 'c', l: 'Stasiun' }, { k: 'bd', l: 'Normal/hari', num: 1, fmt: v => f(v, 1) }, { k: 'ex', l: 'Di atas normal', num: 1, fmt: fi }, { k: 'pk', l: 'Puncak pasien/hari', num: 1, fmt: fi }, { k: 'tt', l: 'TT', num: 1, fmt: fi }, { k: 'over', l: 'Hari > TT', num: 1, fmt: fi }],
          rows: rs.slice().sort((a, b) => b.ex - a.ex).map(r => Object.assign({ _st: r.c }, r)) }),
        info: { rumus: 'Σ (kematian harian − rata-rata kematian harian 1 Jan–31 Mei 2026), 1 Agu–14 Okt 2026, per RS.', data: 'HLT-01', filter: false } })}
      <h2 class="t-sec">Siapa yang paling tertekan?</h2>
      ${card({ id: 'rsv', span: 's12', h: 'h320', title: 'Seberapa parah asap 2026 vs 2024?', sub: `Batang = kenaikan kasus 1 Agu–14 Okt dibanding musim yang sama 2024. Sabuk asap = ${R.sab.length} stasiun yang PM2.5 Agu–Okt-nya ≥ 2× bulan lain, sisanya pembanding.`,
        legend: `<span><i style="background:var(--k-gambut)"></i>RS sabuk asap</span><span><i style="background:var(--line-2)"></i>RS lain</span>`,
        lead: `Di sabuk asap kasus naik paling banyak di <b>${ljL(vk[0])}</b> (${fp(R.vS[vk[0]])}), jauh di atas RS di luar sabuk.`, note: nt(`Di sabuk asap, kenaikan terbesar: ${vk.slice(0, 3).map(k => `<b>${ljL(k)} ${fp(R.vS[k])}</b>`).join(', ')}; terkecil ${ljL(vk[vk.length - 1])} ${fp(R.vS[vk[vk.length - 1]])}. RS lain hanya ${fp(Math.min(...vk.map(k => R.vL[k])))} sampai ${fp(Math.max(...vk.map(k => R.vL[k])))}.`,
          'Jumlah kasus, bukan angka per penduduk; data populasi tidak tersedia.'),
        info: { rumus: '(Σ kasus 1 Agu–14 Okt 2026 ÷ Σ kasus 1 Agu–14 Okt 2024 − 1) × 100, dijumlah untuk semua RS dalam kelompok.', data: 'HLT-01', filter: false } })}
      ${ljTutup('rs', `${fi(R.tot)} kematian di atas normal dalam 75 hari; ${f(100 * sum(kt.map(r => r.ex)) / R.tot, 0)}% di dua RS Kalteng. ${ov.length ? `${ov.length} RS menerima pasien pernapasan baru melebihi seluruh tempat tidurnya dalam sehari (terbanyak ${esc(stShort(ov[0].c))}, ${ov[0].over} hari).` : ''} Kelompok yang naik paling tajam: ${vk.slice(0, 2).map(k => ljL(k)).join(' dan ')}.`,
        [['Dinkes provinsi Kalteng, Kalbar, Sumsel', `Tambah tempat tidur darurat pernapasan dan ruang ${vk[0] === 'u5' ? 'anak' : 'perawatan'} di ${ov.slice(0, 3).map(r => esc(stShort(r.c))).join(', ')}`, 'Sebelum awal musim (lihat Kalender siaga)'],
         ['Kemenkes dan RS rujukan', 'Pasangkan tiap RS sabuk asap dengan RS di luar sabuk untuk rujukan dan kiriman tenaga', 'Perjanjian ditandatangani sebelum Juli'],
         ['RS sabuk asap', `Prioritaskan ${vk.slice(0, 2).map(k => ljL(k)).join(' dan ')} di triase`, 'Sepanjang musim asap']],
        'kelebihan kematian dihitung terhadap rata-rata awal tahun dan tidak membuktikan bahwa semuanya disebabkan asap. Data RS tidak memuat lama rawat, jadi "melebihi tempat tidur" adalah batas bawah beban sebenarnya.')}
      </div>`;
  },
  mount(C) {
    const R = ljRS(), cur = R.rs.find(r => r.c === this._c) || R.rs[0], h = D.health[cur.rs], i0 = dayIdx('2026-06-01'), i1 = ND - 1, pm = D.pm25[cur.c];
    const sel = C.querySelector('#rsSel'); if (sel) sel.onchange = () => { this._c = sel.value; render(false); };
    const days = []; for (let i = i0; i <= i1; i++) days.push(i);
    mk('rsd', { grid: { left: 8, right: 16, top: 24, bottom: 8, containLabel: true },
      tooltip: { trigger: 'axis', formatter: ps => { const i = days[ps[0].dataIndex]; return `${ljMD(i)}<br>Pasien pernapasan baru: <b>${fi(h.resp[i])}</b><br>PM2.5: ${pm[i] == null ? '–' : f(pm[i])} µg/m³`; } },
      xAxis: ax({ type: 'category', data: days.map(ljD), boundaryGap: false, axisLabel: { color: cv('--muted'), fontSize: 11, interval: 29 } }), yAxis: ax({ type: 'value', min: 0 }),
      series: [{ type: 'line', data: days.map(i => h.resp[i]), symbol: 'none', lineStyle: { width: 2, color: cv('--ispu-4') }, areaStyle: { color: cv('--ispu-4'), opacity: .12 },
        markLine: mlRef([
          cur.tt ? refLine(cur.tt, `kapasitas ${fi(cur.tt)} TT`, { pos: 'insideStartTop', tip: 'Jumlah seluruh tempat tidur RS ini (hospitals.csv). Pasien pernapasan baru per hari yang melewati garis ini berarti satu hari masuk melebihi semua tempat tidur.' }) : null,
          refLine(cur.br, 'hari biasa', { pos: 'insideEndTop', tip: 'Rata-rata pasien pernapasan baru per hari di RS ini pada Januari–Mei 2026, sebelum musim asap.' })].filter(Boolean)) }] });
    const x = R.rs.slice().sort((a, b) => b.ex - a.ex).slice(0, 10).reverse();
    mk('rsx', { grid: { left: 8, right: 34, top: 6, bottom: 8, containLabel: true }, tooltip: { formatter: p => `<b>${esc(x[p.dataIndex].nama)}</b><br>${fi(p.value)} kematian di atas normal` },
      xAxis: ax({ type: 'value' }), yAxis: ax({ type: 'category', data: x.map(r => stShort(r.c)), splitLine: { show: false }, axisLabel: { color: cv('--ink-2'), fontSize: 10.5, interval: 0 } }),
      series: [{ type: 'bar', barWidth: '60%', data: x.map(r => ({ value: Math.round(r.ex), itemStyle: { color: cv(/^KTG/.test(r.c) ? '--ispu-5' : R.sab.includes(r.c) ? '--ispu-4' : '--line-2'), borderRadius: [0, 4, 4, 0] } })) }] }, p => { this._c = x[p.dataIndex].c; render(false); });
    const ks = Object.keys(OUTC);
    mk('rsv', { grid: { left: 8, right: 16, top: 16, bottom: 8, containLabel: true }, tooltip: { trigger: 'axis', valueFormatter: v => fp(v) },
      xAxis: ax({ type: 'category', data: ks.map(k => OUTC[k].l), splitLine: { show: false }, axisLabel: { color: cv('--ink-2'), fontSize: 11, interval: 0 } }), yAxis: ax({ type: 'value', axisLabel: { color: cv('--muted'), fontSize: 11, formatter: v => v + '%' } }),
      series: [['RS sabuk asap', R.vS, '--k-gambut'], ['RS lain', R.vL, '--line-2']].map(([n, v, c]) => ({ name: n, type: 'bar', barGap: '12%', barWidth: '30%', data: ks.map(k => v[k]), itemStyle: { color: cv(c), borderRadius: [4, 4, 0, 0] } })) });
  },
};

/* ================= 4. BEBAN TERSEMBUNYI ================= */
let LJB = null;
function ljBeban() {
  if (LJB) return LJB;
  const rows = ljUse().map(s => { let a = 0, b = 0, nA = 0, nB = 0; D.pm25[s.code].forEach((v, i) => { if (v == null) return; const m = dayDate(i).getUTCMonth(), e = Math.max(0, v - BAKU_THN);
      if (m >= 6 && m <= 9) { a += e; if (v > BAKU) nA++; } else { b += e; if (v > BAKU) nB++; } });
    return { c: s.code, a: a / 1000, b: b / 1000, t: (a + b) / 1000, nA, nB }; }).sort((x, y) => y.t - x.t);
  LJB = { rows };
  return LJB;
}
PAGES.beban = {
  title: 'Beban tersembunyi', nav: 'Beban tersembunyi', group: 'Analisis lanjutan',
  html() {
    const B = ljBeban(), r = B.rows, kr = r.filter(x => x.b > x.a).slice(0, 3), mu = r.filter(x => x.a > 2 * x.b).slice(0, 3);
    const k0 = kr[0], m0 = mu[0];
    return ph({ k: ljKick(4, 'Siapa yang terlupakan'), h: 'Beban polusi: kronis vs musiman',
      lede: 'Menjumlahkan kelebihan PM2.5 di atas baku tahunan untuk membandingkan kota kronis dan kota musiman.',
      scope: 'Seluruh periode Jan 2024–14 Okt 2026 · hari sah · filter global tidak berlaku' }) +
      `<div class="grid">
      <h2 class="t-sec">Siapa menanggung paling banyak?</h2>
      ${card({ id: 'bbn', span: 's7', h: 'h460', title: 'Stasiun mana kelebihan PM2.5-nya terbanyak?', sub: `Batang = jumlah (PM2.5 harian − 15) untuk semua hari sah, dalam ribu µg/m³·hari, dipisah antara kemarau (Jul–Okt) dan bulan lain. 14 stasiun teratas.`,
        legend: `<span><i style="background:var(--k-gambut)"></i>Jul–Okt</span><span><i style="background:var(--k-industri)"></i>Bulan lain</span>`,
        lead: `Sebanyak <b>${kr.length}</b> wilayah tergolong kronis karena bebannya tetap besar di luar kemarau, dan <b>${mu.length}</b> musiman karena bebannya menumpuk di Juli–Oktober.`, note: nt(`Kronis (beban terbesar di luar musim kemarau): <b>${kr.map(x => esc(stShort(x.c))).join(', ')}</b>. Musiman (beban terpusat di Jul–Okt): <b>${mu.map(x => esc(stShort(x.c))).join(', ')}</b>.`,
          'Satuan gabungan kadar × hari, bukan jumlah orang terpapar; data penduduk tidak tersedia.'),
        table: () => ({ cols: [{ k: 'c', l: 'Stasiun' }, { k: 'k', l: 'Kota' }, { k: 'a', l: 'Jul–Okt (ribu)', num: 1, fmt: v => f(v, 1) }, { k: 'b', l: 'Bulan lain (ribu)', num: 1, fmt: v => f(v, 1) }, { k: 't', l: 'Total (ribu)', num: 1, fmt: v => f(v, 1) }, { k: 'n', l: 'Hari > 55', num: 1, fmt: fi }],
          rows: r.map(x => ({ _st: x.c, c: x.c, k: BY[x.c].kota, a: x.a, b: x.b, t: x.t, n: x.nA + x.nB })) }),
        info: { rumus: 'Σ max(0, PM2.5 harian − 15) per stasiun, hari sah saja, dibagi 1.000. Jul–Okt = bulan 7–10 tiap tahun.', data: 'pm25 harian', filter: false } })}
      ${card({ id: 'bbm', span: 's5', h: 'h460', title: 'Kenapa beban sama bisa beda bentuk?', sub: `Garis = PM2.5 rata-rata bulanan${k0 && m0 ? `, ${esc(stShort(k0.c))} vs ${esc(stShort(m0.c))}` : ''}. Garis titik hitam = baku harian 55 µg/m³.`,
        lead: k0 && m0 ? `${esc(stShort(k0.c))} melewati 55 µg/m³ pada <b>${fi(k0.nA + k0.nB)}</b> hari, ${k0.nA + k0.nB >= D.pm25[k0.c].filter(v => v != null).length ? 'yaitu setiap hari yang tercatat' : 'hampir tanpa jeda'}, sedangkan ${esc(stShort(m0.c))} pada <b>${fi(m0.nA + m0.nB)}</b> hari dengan ${f(100 * m0.nA / Math.max(1, m0.nA + m0.nB), 0)}% di antaranya pada Juli–Oktober.` : null, note: k0 && m0 ? nt(`${esc(stShort(k0.c))} melewati 55 pada <b>${fi(k0.nA + k0.nB)}</b> hari${k0.nA + k0.nB >= D.pm25[k0.c].filter(v => v != null).length ? ', yaitu setiap hari yang tercatat' : ', hampir tanpa jeda'}; ${esc(stShort(m0.c))} pada <b>${fi(m0.nA + m0.nB)}</b> hari, ${f(100 * m0.nA / Math.max(1, m0.nA + m0.nB), 0)}% di Jul–Okt.`, 'Rata-rata bulanan meratakan puncak harian.') : '',
        info: { rumus: 'Rata-rata bulanan PM2.5 dari hari sah.', data: 'pm25 bulanan', filter: false } })}
      ${ljTutup('beban', k0 && m0 ? `${esc(stShort(k0.c))} dan ${esc(stShort(m0.c))} menanggung kelebihan PM2.5 yang hampir sama besar. Satu musiman dan terlihat, satu kronis dan dianggap biasa. Keduanya butuh obat yang berbeda.` : '',
        [['DLH DKI dan KLHK', `Batas emisi industri dan pelabuhan di ${k0 ? esc(stShort(k0.c)) : 'kawasan kronis'}, dipantau tiap bulan`, 'Permanen, mulai tahun anggaran berikut'],
         ['Dinkes DKI', 'Skrining pernapasan rutin warga sekitar kawasan industri', 'Tiap tahun, bukan hanya saat darurat'],
         ['BPBD sabuk asap', 'Siaga musiman (lihat Kalender siaga)', 'Akhir Juli–awal November']],
        'satuan beban menggabungkan kadar dan lama paparan; dua stasiun dengan beban sama belum tentu berdampak kesehatan sama karena jumlah penduduk tidak diketahui.')}
      </div>`;
  },
  mount() {
    const B = ljBeban(), r = B.rows.slice(0, 14).reverse();
    mk('bbn', { grid: { left: 8, right: 20, top: 6, bottom: 8, containLabel: true }, tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: ps => { const x = r[ps[0].dataIndex]; return `<b>${x.c}</b> ${esc(BY[x.c].kota)}<br>Jul–Okt: ${f(x.a, 1)} ribu<br>Bulan lain: ${f(x.b, 1)} ribu<br>Total: <b>${f(x.t, 1)}</b> ribu`; } },
      xAxis: ax({ type: 'value' }), yAxis: ax({ type: 'category', data: r.map(x => stShort(x.c)), splitLine: { show: false }, axisLabel: { color: cv('--ink-2'), fontSize: 10.5, interval: 0 } }),
      series: [['Jul–Okt', 'a', '--k-gambut'], ['Bulan lain', 'b', '--k-industri']].map(([n, k, c]) => ({ name: n, type: 'bar', stack: 't', barWidth: '62%', data: r.map(x => x[k]), itemStyle: { color: cv(c) } })) });
    const kr = B.rows.find(x => x.b > x.a), mu = B.rows.find(x => x.a > 2 * x.b); if (!kr || !mu) return;
    const lm = MONTHS.map(m => BULAN[+m.slice(5) - 1] + ' ' + m.slice(2, 4));
    mk('bbm', { grid: { left: 8, right: 70, top: 16, bottom: 8, containLabel: true }, tooltip: { trigger: 'axis', valueFormatter: v => f(v) + ' µg/m³' },
      xAxis: ax({ type: 'category', data: lm, boundaryGap: false, axisLabel: { color: cv('--muted'), fontSize: 11, interval: 11 } }), yAxis: ax({ type: 'value', min: 0 }),
      series: [[kr.c, '--k-industri'], [mu.c, '--k-gambut']].map(([c, v]) => ({ name: stShort(c), type: 'line', data: D.mon[c].pm25, symbol: 'none', lineStyle: { width: 2.2, color: cv(v) },
        endLabel: { show: true, formatter: stShort(c), color: cv('--ink-2'), fontSize: 11 } })).concat([{ type: 'line', data: [], markLine: mlBaku(BAKU, 'baku 24 jam ' + BAKU) }]) });
  },
};
