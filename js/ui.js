// Bausteine der Oberfläche: DOM-Helfer, Sheets, Alerts, Hinweis oben.
// Texte aus Daten nur über textContent einsetzen, nie als HTML.
import { protokolliere } from './fehlerprotokoll.js';

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

// 0.5.2 (F2): Wächter. Keine Sperre gegen Doppeltipp bleibt länger als WAECHTER_MS stehen.
// Die Datenbank gibt nach spätestens 2 × ZEITLIMIT_MS (db.js) auf, der Wächter liegt darüber.
export const WAECHTER_MS = 10000;

/**
 * Sperre gegen Doppeltipp, die sich nach WAECHTER_MS selbst löst (mit Eintrag im Fehlerprotokoll).
 * was: kurzer Name für das Protokoll. beiHaenger(): optional, räumt beim Lösen durch den Wächter auf.
 */
export function neueSperre(was, beiHaenger = null) {
  let aktiv = false;
  let timer = null;
  let lauf = 0;
  return {
    get aktiv() { return aktiv; },
    setze() {
      aktiv = true;
      const mein = ++lauf;
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (!aktiv || mein !== lauf) return;
        aktiv = false;
        protokolliere('Sperre gelöst', `${was}: nach ${Math.round(WAECHTER_MS / 1000)} s ohne Antwort freigegeben.`);
        try { beiHaenger?.(); } catch { /* Aufräumen darf nie selbst hängen */ }
      }, WAECHTER_MS);
    },
    loese() {
      aktiv = false;
      lauf++;
      clearTimeout(timer);
    }
  };
}

/**
 * Ignoriert weitere Aufrufe, solange der vorige noch läuft (Doppeltipp). Die Sperre löst sich
 * immer: am Ende (auch bei Fehler) oder spätestens durch den Wächter. Hängt die Aktion, schließt
 * der Wächter auch Fenster, die währenddessen geöffnet wurden (nicht bei Hintergrund-Laden).
 */
export function einmalig(fn, was = 'Aktion', { fensterSchliessen = true } = {}) {
  let ebenenVorher = [];
  const sperre = neueSperre(was, () => {
    if (!fensterSchliessen) return;
    [...stapel].reverse().filter((e) => !ebenenVorher.includes(e)).forEach((e) => e.zu?.());
  });
  return async (...args) => {
    if (sperre.aktiv) return;
    ebenenVorher = [...stapel];
    sperre.setze();
    try {
      await fn(...args);
    } finally {
      sperre.loese();
    }
  };
}

const stapel = [];

// Laufendes Training oder Trainingsvorschau liegt über den Tabs (training.js meldet das).
let ueberdeckt = false;
const ueberdecktHoerer = new Set();

export function setzeUeberdeckt(wert) {
  if (wert === ueberdeckt) return;
  ueberdeckt = wert;
  ueberdecktHoerer.forEach((f) => { try { f(wert); } catch (e) { console.error(e); } });
}
export const istUeberdeckt = () => ueberdeckt;
export function beiUeberdeckt(f) { ueberdecktHoerer.add(f); }

/**
 * Wächter für die Ebenen (F2): Eine Ebene, die nicht mehr im Dokument hängt, sperrt nie die App;
 * ohne offene Ebene ist die App nie `inert`. Läuft alle 2 s und beim Zurückkommen in die App.
 */
export function starteWaechter() {
  const pruefe = () => {
    let repariert = false;
    for (let i = stapel.length - 1; i >= 0; i--) {
      if (!stapel[i].isConnected) { stapel.splice(i, 1); repariert = true; }
    }
    const app = document.getElementById('app');
    if (repariert || (app.inert && stapel.length === 0)) {
      aktualisiereInert();
      protokolliere('Sperre gelöst', 'Oberfläche war ohne offenes Fenster gesperrt.');
    }
  };
  setInterval(pruefe, 2000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) pruefe(); });
}

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
 * Alert im iOS-Stil. knoepfe: [{ id, label, fett, rot, beiTipp }]. `beiTipp` läuft synchron im Tipp,
 * nötig für das Teilen-Menü, das eine frische Nutzeraktion verlangt. aussenNein: Antippen der
 * Abdunklung schließt den Alert (Ergebnis null, wie „Nein“). textGrau: Text in --text-2 (Design 0.5.2).
 */
export function zeigeAlert({ titel, text, knoepfe, aussenNein = false, textGrau = false }) {
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
      h('div', { class: 'dim', onclick: aussenNein ? () => ebene.zu() : null }),
      h('div', { class: 'alert', role: 'alertdialog', 'aria-modal': 'true' },
        h('div', { class: 'alert-text' }, h('h3', { text: titel }), h('p', { text, class: textGrau ? 'grau' : null })),
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
 * Hinweis oben über allem: nach `dauer` ms (Standard ca. 4 s) weg, nach oben wegwischbar, Antippen
 * schließt ihn; ohne Ton und Vibration. Ein neuer Hinweis ersetzt den alten (nie zwei übereinander).
 */
export function zeigeHinweis({ titel, text = '', iconName = 'i-check', einzeilig = false, dauer = 4000 }) {
  aktuellerHinweis?.();
  const el = h('div', { class: `banner ${einzeilig ? 'einzeilig' : ''}`.trim(), role: 'status' },
    h('div', { class: 'ico' }, icon(iconName)),
    h('div', { class: 'banner-text' }, h('b', { text: titel }), text && h('span', { text })));
  // 0.5.3-2: Antippen schließt den Banner; liegt darunter ein Knopf der Kopfzeile (Zurück, Art ändern,
  // Sicherung, ✕), wird er im selben Tipp ausgelöst. So blockiert der Banner nie die Navigation.
  el.addEventListener('click', (ev) => { weg(); leiteAnKopfzeileWeiter(el, ev.clientX, ev.clientY); });

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
  timer = setTimeout(weg, dauer);
}

function leiteAnKopfzeileWeiter(banner, x, y) {
  banner.style.pointerEvents = 'none';
  const darunter = document.elementFromPoint(x, y);
  banner.style.pointerEvents = '';
  const knopf = darunter?.closest('.navbar button, .title-row button, .sheet-head button');
  if (knopf && !knopf.disabled && !banner.contains(knopf)) knopf.click();
}

/** Meldung, wenn Speichern nach Zeitlimit und Wiederholung nicht geklappt hat (Design 0.5.2, Punkt 2). */
export function zeigeSpeicherFehler() {
  zeigeHinweis({ titel: 'Speichern hat nicht geklappt – nochmal tippen', iconName: 'i-x', dauer: 8000 });
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
