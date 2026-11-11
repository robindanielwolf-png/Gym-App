// Bausteine der Oberfläche: DOM-Helfer, Sheets, Alerts, Hinweis oben.
// Texte aus Daten nur über textContent einsetzen, nie als HTML.

const SVG_NS = 'http://www.w3.org/2000/svg';
const DAUER_SCHLIESSEN = 320;

export function h(tag, attrs = {}, ...kinder) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === false || v === null || v === undefined) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  el.append(...kinder.flat().filter(Boolean));
  return el;
}

export function icon(name, klasse = '') {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', `i ${klasse}`.trim());
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS(SVG_NS, 'use');
  use.setAttribute('href', `#${name}`);
  svg.append(use);
  return svg;
}

export function kachel(name) {
  return h('div', { class: 'ico' }, icon(name));
}

/** Leer-Hinweis, eine Komponente für alle Tabs. */
export function leerHinweis({ iconName, headline, subhead }) {
  return h('div', { class: 'empty' },
    iconName && icon(iconName, 's48'),
    h('div', { class: 'empty-h', text: headline }),
    subhead && h('div', { class: 'empty-s', text: subhead }));
}

/** Ignoriert weitere Aufrufe, solange der vorige noch läuft (Doppeltipp). */
export function einmalig(fn) {
  let laeuft = false;
  return async (...args) => {
    if (laeuft) return;
    laeuft = true;
    try {
      await fn(...args);
    } finally {
      laeuft = false;
    }
  };
}

const stapel = [];

function aktualisiereInert() {
  document.getElementById('app').inert = stapel.length > 0;
  stapel.forEach((ebene, i) => { ebene.inert = i !== stapel.length - 1; });
}

function neueEbene(el) {
  document.getElementById('ebenen').append(el);
  stapel.push(el);
  aktualisiereInert();
  el.getBoundingClientRect();
  el.classList.add('offen');
}

function entferneEbene(el) {
  const i = stapel.indexOf(el);
  if (i >= 0) stapel.splice(i, 1);
  aktualisiereInert();
  el.classList.remove('offen');
  setTimeout(() => el.remove(), DAUER_SCHLIESSEN);
}

/** Ziehen an `griff` verschiebt `ziel`; richtung 1 = nach unten, -1 = nach oben. */
function wischen(griff, ziel, richtung, beiWeg) {
  let start = null;
  let strecke = 0;

  griff.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button, input')) return;
    start = e.clientY;
    strecke = 0;
    griff.setPointerCapture(e.pointerId);
    ziel.classList.add('zieht');
  });
  griff.addEventListener('pointermove', (e) => {
    if (start === null) return;
    strecke = Math.max(0, (e.clientY - start) * richtung);
    ziel.style.transform = `translateY(${strecke * richtung}px)`;
  });
  const ende = () => {
    if (start === null) return;
    start = null;
    ziel.classList.remove('zieht');
    if (strecke > 60) beiWeg(); else ziel.style.transform = '';
  };
  griff.addEventListener('pointerup', ende);
  griff.addEventListener('pointercancel', ende);
}

/**
 * Sheet von unten. `baue(schliessen)` liefert den Inhalt.
 * Griff und Kopfzeile ziehen das Sheet nach unten weg.
 */
export function oeffneSheet({ klasse = '', baue, beiZu, zuruecktreten = false, fokusBleibt = false }) {
  const ebene = h('div', { class: 'ebene' });
  const darunter = zuruecktreten ? stapel.at(-1) : null;
  let offen = true;

  const schliessen = () => {
    if (!offen) return;
    offen = false;
    if (!fokusBleibt) document.activeElement?.blur?.();
    sheet.style.transform = '';
    darunter?.classList.remove('zurueck');
    entferneEbene(ebene);
    beiZu?.();
  };

  const sheet = h('section', { class: `sheet ${klasse}`.trim(), role: 'dialog', 'aria-modal': 'true' });
  const dim = h('div', { class: 'dim', onclick: schliessen });
  sheet.append(...[baue(schliessen)].flat().filter(Boolean));
  ebene.append(dim, sheet);
  ebene.zu = schliessen;
  darunter?.classList.add('zurueck');
  neueEbene(ebene);

  sheet.querySelectorAll('.grabber, .sheet-head, .sheet-nav').forEach((g) => wischen(g, sheet, 1, schliessen));
  return { schliessen, el: sheet };
}

/** Schließt alle offenen Sheets und Alerts (z. B. beim Auto-Ende). */
export function schliesseAlles() {
  [...stapel].reverse().forEach((ebene) => ebene.zu?.());
}

export const offeneEbenen = () => stapel.length;

/** Tippen auf diesen Knopf nimmt einem Eingabefeld nicht den Fokus (Tastatur bleibt). */
export function behaeltFokus(knopf) {
  knopf.addEventListener('pointerdown', (e) => e.preventDefault());
  knopf.addEventListener('mousedown', (e) => e.preventDefault());
  return knopf;
}

export function sheetKopf(titel, schliessen, klasse = '') {
  return h('div', { class: `sheet-head ${klasse}`.trim() },
    h('h2', { text: titel }),
    h('button', { class: 'xbtn', type: 'button', 'aria-label': 'Schließen', onclick: schliessen }, icon('i-x', 's16')));
}

export const griff = () => h('div', { class: 'grabber' });

/**
 * Alert im iOS-Stil. knoepfe: [{ id, label, fett, beiTipp }]. `beiTipp` läuft synchron im Tipp,
 * nötig für das Teilen-Menü, das eine frische Nutzeraktion verlangt.
 */
export function zeigeAlert({ titel, text, knoepfe }) {
  return new Promise((fertig) => {
    const ebene = h('div', { class: 'ebene ebene-alert' });
    let gewaehlt = false;
    ebene.zu = () => { if (!gewaehlt) { gewaehlt = true; entferneEbene(ebene); fertig(null); } };
    const waehle = (k) => {
      if (gewaehlt) return;
      gewaehlt = true;
      k.beiTipp?.();
      entferneEbene(ebene);
      fertig(k.id);
    };
    ebene.append(
      h('div', { class: 'dim' }),
      h('div', { class: 'alert', role: 'alertdialog', 'aria-modal': 'true' },
        h('div', { class: 'alert-text' }, h('h3', { text: titel }), h('p', { text })),
        h('div', { class: `acts ${knoepfe.length === 3 ? 'gestapelt' : ''}`.trim() },
          knoepfe.map((k) => h('button', {
            type: 'button',
            class: [k.fett && 'fett', k.rot && 'rot'].filter(Boolean).join(' '),
            text: k.label,
            onclick: () => waehle(k)
          })))));
    neueEbene(ebene);
  });
}

let aktuellerHinweis = null;

/**
 * Hinweis oben über allem: nach ca. 4 s weg, nach oben wegwischbar, Antippen schließt ihn;
 * ohne Ton und Vibration. Ein neuer Hinweis ersetzt den alten (nie zwei übereinander).
 */
export function zeigeHinweis({ titel, text, iconName = 'i-check', einzeilig = false }) {
  aktuellerHinweis?.();
  const el = h('div', { class: `banner ${einzeilig ? 'einzeilig' : ''}`.trim(), role: 'status' },
    h('div', { class: 'ico' }, icon(iconName)),
    h('div', { class: 'banner-text' }, h('b', { text: titel }), h('span', { text })));
  el.addEventListener('click', () => weg());

  let timer;
  const weg = () => {
    clearTimeout(timer);
    if (aktuellerHinweis === weg) aktuellerHinweis = null;
    el.style.transform = '';
    el.classList.remove('offen');
    setTimeout(() => el.remove(), DAUER_SCHLIESSEN);
  };
  aktuellerHinweis = weg;

  document.getElementById('hinweise').append(el);
  el.getBoundingClientRect();
  el.classList.add('offen');
  wischen(el, el, -1, weg);
  timer = setTimeout(weg, 4000);
}

/** Hält Sheets über der iOS-Tastatur, die den Layout-Viewport nicht verkleinert. */
export function folgeTastatur() {
  const vv = window.visualViewport;
  if (!vv) return;
  const aktualisiere = () => {
    const verdeckt = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    document.documentElement.style.setProperty('--tastatur', `${Math.round(verdeckt)}px`);
  };
  vv.addEventListener('resize', aktualisiere);
  vv.addEventListener('scroll', aktualisiere);
  aktualisiere();
}

const RAND_PX = 20;
const reduziert = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Zurück per Wischen vom linken Rand (Screen 14): Start nur in den linken 20 px, erst ab
 * |dx| > |dy| und dx > 10 px. Abschluss ab 35 % Breite oder > 0,5 px/ms (250 ms), sonst
 * zurückfedern (200 ms). Gesperrt bei offenem Sheet/Alert und offener Tastatur.
 * darunter(): Elemente, die unter der Seite hervorschauen (Parallaxe ab −30 %).
 */
export function randWischen(seite, { darunter, beiZurueck }) {
  const schatten = h('div', { class: 'wisch-dim', hidden: true });
  document.getElementById('app').append(schatten);
  let zug = null;

  const gesperrt = () => stapel.length > 0
    || document.activeElement?.matches?.('input, textarea')
    || parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--tastatur')) > 0;

  const setze = (dx, dauer = 0, ease = 'ease-out') => {
    const breite = seite.offsetWidth || window.innerWidth;
    const anteil = Math.min(1, Math.max(0, dx / breite));
    const uebergang = dauer ? `${dauer}ms ${ease}` : 'none';
    if (reduziert()) {
      seite.style.transition = dauer ? `opacity ${uebergang}` : 'none';
      seite.style.transform = 'none';
      seite.style.opacity = String(1 - anteil);
      return;
    }
    seite.style.transition = dauer ? `transform ${uebergang}` : 'none';
    seite.style.transform = `translateX(${dx}px)`;
    for (const el of zug.unten) {
      el.style.transition = dauer ? `transform ${uebergang}` : 'none';
      el.style.transform = `translateX(${(-30 * (1 - anteil)).toFixed(2)}%)`;
    }
    schatten.style.transition = dauer ? `opacity ${uebergang}` : 'none';
    schatten.style.opacity = String(1 - anteil);
  };

  const aufraeumen = () => {
    for (const el of [seite, ...(zug?.unten || [])]) {
      el.style.transition = '';
      el.style.transform = '';
      el.style.opacity = '';
    }
    seite.classList.remove('wischt');
    schatten.hidden = true;
    zug = null;
  };

  seite.addEventListener('pointerdown', (e) => {
    if (zug?.aktiv || !e.isPrimary || e.clientX > RAND_PX || seite.hidden || !seite.classList.contains('offen') || gesperrt()) return;
    zug = { id: e.pointerId, x: e.clientX, y: e.clientY, aktiv: false, unten: [], punkte: [{ x: e.clientX, t: e.timeStamp }] };
  }, true);

  seite.addEventListener('pointermove', (e) => {
    if (!zug || e.pointerId !== zug.id || zug.fertig) return;
    const dx = e.clientX - zug.x;
    const dy = e.clientY - zug.y;
    if (!zug.aktiv) {
      if (Math.abs(dx) <= 10 && Math.abs(dy) <= 10) return;
      if (!(dx > 10 && Math.abs(dx) > Math.abs(dy))) { zug = null; return; }
      zug.aktiv = true;
      zug.unten = reduziert() ? [] : darunter();
      try { seite.setPointerCapture(e.pointerId); } catch { /* bereits beendet */ }
      seite.classList.add('wischt');
      schatten.hidden = reduziert();
    }
    e.preventDefault();
    zug.punkte.push({ x: e.clientX, t: e.timeStamp });
    if (zug.punkte.length > 5) zug.punkte.shift();
    setze(Math.max(0, dx));
  }, true);

  const ende = (e) => {
    if (!zug || e.pointerId !== zug.id || zug.fertig) return;
    if (!zug.aktiv) { zug = null; return; }
    zug.fertig = true;
    const dx = Math.max(0, e.clientX - zug.x);
    const p = zug.punkte;
    const dt = p.length > 1 ? p.at(-1).t - p[0].t : 0;
    const tempo = dt > 0 ? (p.at(-1).x - p[0].x) / dt : 0;
    const breite = seite.offsetWidth || window.innerWidth;
    // Der folgende Klick darf nichts auslösen.
    const schlucke = (k) => { k.stopPropagation(); k.preventDefault(); };
    window.addEventListener('click', schlucke, { capture: true, once: true });
    setTimeout(() => window.removeEventListener('click', schlucke, { capture: true }), 400);
    if (e.type !== 'pointercancel' && (dx > breite * 0.35 || tempo > 0.5)) {
      const dauer = reduziert() ? 200 : 250;
      setze(breite, dauer);
      setTimeout(() => { aufraeumen(); beiZurueck(); }, dauer);
    } else {
      setze(0, 200);
      setTimeout(aufraeumen, 200);
    }
  };
  seite.addEventListener('pointerup', ende, true);
  seite.addEventListener('pointercancel', ende, true);
}
