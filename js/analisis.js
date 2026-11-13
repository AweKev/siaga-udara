/* ================= ALUR ANALISIS: empat halaman (bab) berurutan =================
   Tiap bab = satu halaman yang memuat langkah analisis dan sub-babnya: 1 Kondisi + Ambang nyata, 2 Waktu kritis + Kalender siaga,
   3 Faktor + Cuaca dan angin, 4 Kesehatan + RS kewalahan. Menu kiri tetap; sub-bab menyala saat digulir ke sana.
   Tiap bagian memakai html() dan mount() halaman aslinya. Faktor dibelah dua di tanda "Cuaca". */
window.AN_CH = [['t1', 'ambang'], ['t2', 'kalender'], ['t3', 'cuaca'], ['t4', 'rs']];
window.AN_SEC = window.AN_CH.flat();
window.AN_LABEL = { t1: 'Kondisi', ambang: 'Ambang nyata', t2: 'Waktu kritis', kalender: 'Kalender siaga', t3: 'Faktor', cuaca: 'Cuaca dan angin', t4: 'Kesehatan', rs: 'RS kewalahan' };
window.AN_PAGE = {};
AN_CH.forEach(([m, s], i) => { AN_PAGE[m] = AN_PAGE[s] = 'bab' + (i + 1); });
const anIsBab = p => /^bab\d$/.test(p);

/* isi satu bab: dua bagian berurutan */
function anBuild(m, s) {
  const sec = (id, body) => body ? `<section class="an-sec" id="sec-${id}" data-sec="${id}">${body}</section>` : '';
  if (m === 't3') {
    const T3 = PAGES.t3, h3 = T3.html.call(T3), mkr = '<h2 class="t-sec">Cuaca</h2>', cut = h3.indexOf(mkr);
    const a = cut > 0 ? h3.slice(0, cut) + '</div>' : h3;
    const b = cut > 0 ? ph({ k: 'Langkah 3 · Cuaca', h: 'Apakah cuaca ikut menentukan?', lede: 'Menguji apakah suhu, kelembapan, dan arah angin ikut memengaruhi polusi harian.' }) + '<div class="grid">' + h3.slice(cut) : '';
    return sec(m, a) + sec(s, b);
  }
  return [m, s].map(id => { const P = PAGES[id]; return sec(id, P.html.call(P)); }).join('');
}

/* tombol sebelumnya / berikutnya di ujung bab */
function anNav(i) {
  const prev = AN_CH[i - 1], next = AN_CH[i + 1];
  return `<div class="an-next">${prev ? `<a class="btn" href="${hashOf(prev[0])}">← ${AN_LABEL[prev[0]]}</a>` : '<span></span>'}`
    + `<a class="btn primary" href="${hashOf(next ? next[0] : 'rekomendasi')}">Lanjut ke ${next ? AN_LABEL[next[0]] : 'Aksi pemerintah'} ${IC.arrow}</a></div>`;
}

AN_CH.forEach(([m, s], i) => {
  PAGES['bab' + (i + 1)] = {
    title: AN_LABEL[m], nav: AN_LABEL[m], group: 'Alur analisis',
    html() { return `<div class="an-wrap">${anBuild(m, s)}${anNav(i)}</div>`; },
    mount(C) {
      [m, s].forEach(id => {
        const P = PAGES[id], el = C.querySelector('#sec-' + id);
        if (P && id !== 'cuaca' && P.mount) P.mount.call(P, C);
        if (el) autoTerms(el);
      });
      window.AN_CUR = null; anSpy();
    },
  };
});
PAGES.cuaca = { title: 'Cuaca dan angin', html: () => '', mount() {} };   // penampung nama saja; isinya dirakit di bab 3

/* bagian yang sedang terlihat: nyalakan menu kiri dan perbarui remah roti */
function anSpy() {
  if (!anIsBab(S.page)) return;
  const secs = [...document.querySelectorAll('.an-sec')]; if (!secs.length) return;
  let cur = secs[0].dataset.sec;
  for (const s of secs) if (s.getBoundingClientRect().top <= 190) cur = s.dataset.sec;
  if (cur === window.AN_CUR) return; window.AN_CUR = cur;
  document.querySelectorAll('#nav [data-sec]').forEach(a => {
    const id = a.dataset.sec, on = a.classList.contains('an-sub') ? id === cur : AN_PAGE[id] === S.page;
    a.classList.toggle('on', on); if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
  });
  const cr = document.getElementById('crumb'); if (cr) cr.innerHTML = `Alur analisis / <b>${AN_LABEL[cur]}</b>`;
}
window.addEventListener('scroll', () => { if (anIsBab(S.page)) anSpy(); }, { passive: true });
setInterval(() => { if (anIsBab(S.page) && !document.hidden) anSpy(); }, 300);   // cadangan bila peristiwa gulir tidak terkirim

/* klik menu: bila bagiannya ada di halaman ini, gulir halus ke sana; bila di bab lain, pindah halaman seperti biasa */
document.getElementById('nav').addEventListener('click', e => {
  const a = e.target.closest('a[data-sec]'); if (!a) return;
  const el = document.getElementById('sec-' + a.dataset.sec); if (!el) return;
  e.preventDefault();
  el.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  history.replaceState(null, '', a.getAttribute('href'));
  document.getElementById('app').classList.remove('menu');
});
