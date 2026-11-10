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
export function oeffneSheet({ klasse = '', baue, beiZu }) {
  const ebene = h('div', { class: 'ebene' });
  let offen = true;

  const schliessen = () => {
    if (!offen) return;
    offen = false;
    document.activeElement?.blur?.();
    sheet.style.transform = '';
    entferneEbene(ebene);
    beiZu?.();
  };

  const sheet = h('section', { class: `sheet ${klasse}`.trim(), role: 'dialog', 'aria-modal': 'true' });
  const dim = h('div', { class: 'dim', onclick: schliessen });
  sheet.append(...[baue(schliessen)].flat().filter(Boolean));
  ebene.append(dim, sheet);
  ebene.zu = schliessen;
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

/** Hinweis oben: nach ca. 4 s weg, nach oben wegwischbar, ohne Ton und Vibration. */
export function zeigeHinweis({ titel, text }) {
  aktuellerHinweis?.();
  const el = h('div', { class: 'banner', role: 'status' },
    h('div', { class: 'ico' }, icon('i-check')),
    h('div', { class: 'banner-text' }, h('b', { text: titel }), h('span', { text })));

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
