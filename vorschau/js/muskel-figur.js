// Muskelfigur vorne/hinten (dunkle Variante, Design 11.11.2026): Tab „Start“ (letzte 7 Tage),
// Verlauf → Tag und Übersicht nach „Training beenden“.
import * as db from './db.js';
import { h, oeffneSheet, sheetKopf, griff } from './ui.js';
import { registerTabUpdater } from './tab-events.js';
import { FIGUR_VORNE, FIGUR_HINTEN } from './muskel-figur-pfade.js';
import { MUSKELN, MUSKELN_NACH, muskelPunkte, muskelStufe, trainingsDerLetztenTage } from './muskeln.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

const zahl = (x) => String(Math.round(x * 10) / 10).replace('.', ',');

function svg(tag, attrs) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

function seite(figur, punkte, zeitraum, label) {
  const bild = svg('svg', { viewBox: figur.viewBox, class: 'figur-svg', role: 'img', 'aria-label': label });
  // Ein Filter für alle Muskeln statt je Fläche: sieht dank der Lücken gleich aus, rendert viel schneller.
  const muskeln = svg('g', { class: 'figur-muskeln' });
  for (const [id, d] of figur.teile) {
    const klasse = id === 'head' ? 'figur-gesicht' : `figur-m s${MUSKELN_NACH.has(id) ? muskelStufe(punkte[id], zeitraum) : 0}`;
    muskeln.append(svg('path', { d, class: klasse }));
  }
  bild.append(svg('path', { d: figur.umriss, class: 'figur-umriss' }), muskeln);
  return bild;
}

function legende() {
  return h('div', { class: 'figur-legende', 'aria-hidden': 'true' },
    h('span', { text: 'wenig' }),
    [0, 1, 2, 3].map((s) => h('span', { class: `figur-kaestchen s${s}` })),
    h('span', { text: 'viel' }));
}

/** Figur vorne + hinten nebeneinander mit Legende (Sheets). */
function baueMuskelFigur(punkte, zeitraum) {
  return h('div', { class: 'figur' },
    h('div', { class: 'figur-paar' },
      seite(FIGUR_VORNE, punkte, zeitraum, 'Muskeln vorne'),
      seite(FIGUR_HINTEN, punkte, zeitraum, 'Muskeln hinten')),
    legende());
}

/** Liste der trainierten Muskelgruppen mit gewichteter Satzzahl, größte zuerst. */
function muskelListe(punkte, zeitraum) {
  const zeilen = MUSKELN.filter((m) => punkte[m.id] > 0).sort((a, b) => punkte[b.id] - punkte[a.id]);
  if (zeilen.length === 0) return h('p', { class: 'foot-links', text: 'Noch keine Kraft-Sätze in diesem Zeitraum.' });
  return h('div', { class: 'list auf-weiss kein-rand oben-12' }, zeilen.map((m) =>
    h('div', { class: 'row muskel-zeile' },
      h('span', { class: `figur-kaestchen s${muskelStufe(punkte[m.id], zeitraum)}` }),
      h('div', { class: 'main t', text: m.label }),
      h('div', { class: 'val', text: `${zahl(punkte[m.id])} ${punkte[m.id] === 1 ? 'Satz' : 'Sätze'}` }))));
}

function sheetInhalt(punkte, zeitraum) {
  return h('div', { class: 'figur-sheet-inhalt' },
    baueMuskelFigur(punkte, zeitraum),
    muskelListe(punkte, zeitraum),
    h('p', { class: 'foot-links', text: 'Hauptmuskel zählt 1, mitarbeitender Muskel 0,5 je Arbeitssatz. Aufwärmsätze und Cardio zählen nicht.' }));
}

/**
 * Tab „Start“: Figur vorne groß in der Mitte, beim Scrollen die Rückseite, darunter die Liste.
 * Lädt beim Öffnen und nach Datenänderungen; liefert die Aktualisierung für den App-Start.
 */
export function initStartseite() {
  const ansicht = document.getElementById('start-ansicht');
  const inhalt = h('div');
  ansicht.replaceChildren(
    h('div', { class: 'title-row' }, h('h1', { class: 'largetitle', text: 'Muskeln' })),
    h('div', { class: 'start-unterzeile', text: 'Letzte 7 Tage' }),
    inhalt);
  const aktualisiere = async () => {
    try {
      const daten = await db.leseDaten();
      const punkte = muskelPunkte(daten, trainingsDerLetztenTage(daten, 7));
      inhalt.replaceChildren(
        h('div', { class: 'start-figur' }, seite(FIGUR_VORNE, punkte, 'tage7', 'Muskeln vorne'),
          h('div', { class: 'start-seite', text: 'Vorne' })),
        h('div', { class: 'start-figur' }, seite(FIGUR_HINTEN, punkte, 'tage7', 'Muskeln hinten'),
          h('div', { class: 'start-seite', text: 'Hinten' })),
        legende(),
        h('div', { class: 'section-h oben-16', text: 'Sätze pro Muskelgruppe' }),
        h('div', { class: 'start-liste' }, muskelListe(punkte, 'tage7')),
        h('p', { class: 'foot-links', text: 'Hauptmuskel zählt 1, mitarbeitender Muskel 0,5 je Arbeitssatz. Aufwärmsätze und Cardio zählen nicht.' }),
        h('div', { class: 'abstand-16' }));
    } catch (e) {
      console.error('Startseite konnte nicht geladen werden:', e);
    }
  };
  registerTabUpdater('start', aktualisiere);
  return aktualisiere;
}

/** Figur für ein einzelnes Training (Verlauf → Tag). */
export function baueTrainingsFigur(daten, trainingId) {
  const punkte = muskelPunkte(daten, [trainingId]);
  if (Object.keys(punkte).length === 0) return null;
  return h('div', { class: 'figur-im-sheet' }, baueMuskelFigur(punkte, 'training'));
}

/** Übersicht nach „Training beenden“: nur wenn das Training Kraft-Sätze hat. */
export function zeigeTrainingsUebersicht(daten, trainingId) {
  const punkte = muskelPunkte(daten, [trainingId]);
  if (Object.keys(punkte).length === 0) return;
  oeffneSheet({
    klasse: 'figur-sheet',
    baue: (zu) => [griff(), sheetKopf('Dieses Training', zu), sheetInhalt(punkte, 'training'),
      h('div', { class: 'sheet-unten' }, h('button', { class: 'btn primary', type: 'button', text: 'Fertig', onclick: zu }))]
  });
}
