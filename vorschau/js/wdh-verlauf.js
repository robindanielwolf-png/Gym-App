// Wiederholungen je Kalendertag der letzten 14 Tage (Vorschau 0.5.1) für Liegestütze und Klimmzüge.
// Gemeinsam genutzt von Rekorde (Hauptübungs-Karte) und Übungsdetail. Nur Arbeitssätze, keine Datenänderung.
import { h } from './ui.js';

/** Nur diese beiden Übungen zeigen den Wdh.-Verlauf. */
export const WDH_UEBUNGEN = ['s-liegestuetze', 's-klimmzuege'];

const TAGE = 14;
const SVG_NS = 'http://www.w3.org/2000/svg';
const MONATE = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
const WOCHE = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const B = 315, H = 120, OBEN = 8, BASIS = 96, BREITE = 14;

const zahl = (x) => String(Math.round(x * 10) / 10).replace('.', ',');
const datumKurzText = (d) => `${d.getDate()}. ${MONATE[d.getMonth()]}`;

function svg(tag, attrs = {}) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

/**
 * Summe der Wdh. je lokalem Kalendertag für die letzten 14 Tage inkl. heute (älteste zuerst).
 * Tage ohne Arbeitssatz zählen 0. Aufwärmsätze zählen nicht; Zusatzgewicht und ohne Zusatz zusammen.
 */
export function wdhLetzte14(daten, uebungId, jetzt = new Date()) {
  const trainings = new Map(daten.trainings.map((t) => [t.id, t]));
  const schluessel = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const summen = new Map();
  for (const s of daten.saetze) {
    if (s.uebungId !== uebungId || s.aufwaermen === true || typeof s.wdh !== 'number') continue;
    const t = trainings.get(s.trainingId);
    if (!t?.startedAt) continue;
    const k = schluessel(new Date(t.startedAt));
    summen.set(k, (summen.get(k) || 0) + s.wdh);
  }
  return Array.from({ length: TAGE }, (_, i) => {
    const tag = new Date(jetzt.getFullYear(), jetzt.getMonth(), jetzt.getDate() - (TAGE - 1 - i));
    return { tag, wdh: summen.get(schluessel(tag)) || 0 };
  });
}

/**
 * Kleines Balkendiagramm (14 Balken) mit Summe/Ø. Tippen auf einen Balken zeigt Datum und Wdh.
 * Tage ohne Wert erscheinen als flache graue Linie.
 */
export function wdhKarte(werte) {
  const max = Math.max(1, ...werte.map((w) => w.wdh));
  const slot = B / TAGE;
  const info = h('div', { class: 'wdh-info' });
  const bild = svg('svg', { viewBox: `0 0 ${B} ${H}`, class: 'wdh-chart', role: 'img', 'aria-label': 'Wiederholungen je Tag, letzte 14 Tage' });
  const balken = werte.map((w, i) => {
    const hoehe = w.wdh > 0 ? Math.max(3, (w.wdh / max) * (BASIS - OBEN)) : 2;
    return svg('rect', {
      x: i * slot + (slot - BREITE) / 2,
      y: BASIS - hoehe,
      width: BREITE,
      height: hoehe,
      rx: 3,
      class: w.wdh > 0 ? 'wdh-balken' : 'wdh-leer'
    });
  });
  const markiere = (i) => {
    balken.forEach((b, j) => b.classList.toggle('gewaehlt', j === i));
    const w = werte[i];
    info.textContent = `${WOCHE[w.tag.getDay()]} ${datumKurzText(w.tag)} · ${w.wdh} Wdh.`;
  };
  bild.append(...balken);
  werte.forEach((_, i) => {
    const treffer = svg('rect', { x: i * slot, y: 0, width: slot, height: H, class: 'wdh-treffer' });
    treffer.addEventListener('click', () => markiere(i));
    bild.append(treffer);
  });
  [[0, 'start', 0], [TAGE >> 1, 'middle', B / 2], [TAGE - 1, 'end', B]].forEach(([i, anker, x]) => {
    const text = svg('text', { x, y: 118, 'text-anchor': anker, class: 'wdh-achse' });
    text.textContent = datumKurzText(werte[i].tag);
    bild.append(text);
  });

  const summe = werte.reduce((a, w) => a + w.wdh, 0);
  return h('div', { class: 'wdh-karte' },
    h('div', { class: 'wdh-kopf', text: 'Wiederholungen · letzte 14 Tage' }),
    info,
    bild,
    h('div', { class: 'wdh-fuss', text: `Summe ${summe} · Ø ${zahl(summe / TAGE)} pro Tag` }));
}
