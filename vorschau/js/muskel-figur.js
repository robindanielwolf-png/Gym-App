// Muskelfigur vorne/hinten (dunkle Variante, Design 11.11.2026): Tab „Start“ (letzte 7 Tage),
// Verlauf → Tag und Übersicht nach „Training beenden“.
import * as db from './db.js';
import { h, icon, oeffneSheet, sheetKopf, griff } from './ui.js';
import { oeffneSicherung } from './sicherung-sheet.js';
import { registerTabUpdater } from './tab-events.js';
import { registerTabVerlassen } from './tabs.js';
import { erstelleFigur } from './figur-3d.js';
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
  const auswahl = svg('g', { class: 'figur-auswahl' });
  for (const [id, d] of figur.teile) {
    const istMuskel = MUSKELN_NACH.has(id);
    const klasse = id === 'head' ? 'figur-gesicht' : `figur-m s${istMuskel ? muskelStufe(punkte[id], zeitraum) : 0}`;
    muskeln.append(svg('path', istMuskel ? { d, class: klasse, 'data-m': id } : { d, class: klasse }));
  }
  bild.append(svg('path', { d: figur.umriss, class: 'figur-umriss' }), muskeln, auswahl);

  // Muskel antippen: Rand in Akzentfarbe und kleines Label „Brust · 3 Sätze“ (Design, Muskel-Karte).
  const blase = h('div', { class: 'figur-blase', hidden: true });
  const wahl = (ev) => {
    const id = ev.target.closest?.('[data-m]')?.getAttribute('data-m');
    auswahl.replaceChildren();
    if (!id) { blase.hidden = true; return; }
    for (const p of muskeln.querySelectorAll(`[data-m="${id}"]`)) auswahl.append(svg('path', { d: p.getAttribute('d'), class: 'figur-rand' }));
    const wert = punkte[id] || 0;
    blase.textContent = `${MUSKELN_NACH.get(id).label} · ${wert > 0 ? `${zahl(wert)} ${wert === 1 ? 'Satz' : 'Sätze'}` : 'nicht trainiert'}`;
    // Label mittig über dem Finger, aber mindestens 16 px vom Bildschirmrand (Design A4).
    const r = rahmen.getBoundingClientRect();
    blase.hidden = false;
    const halb = blase.offsetWidth / 2;
    const bildschirm = document.documentElement.clientWidth;
    const mitte = Math.min(Math.max(ev.clientX, halb + 16), bildschirm - halb - 16);
    blase.style.left = `${mitte - r.left}px`;
    blase.style.top = `${Math.max(ev.clientY - r.top - 44, 0)}px`;
  };
  bild.addEventListener('click', wahl);
  const rahmen = h('div', { class: 'figur-seite' }, bild, blase);
  return rahmen;
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
  const max = Math.max(...zeilen.map((m) => punkte[m.id]));
  const balken = (m) => {
    const innen = h('div', { class: `s${muskelStufe(punkte[m.id], zeitraum)}` });
    innen.style.width = `${(punkte[m.id] / max) * 100}%`;
    return h('div', { class: 'muskel-balken' }, innen);
  };
  return h('div', { class: 'list auf-weiss kein-rand oben-12' }, zeilen.map((m) =>
    h('div', { class: 'row muskel-zeile' },
      h('span', { class: `figur-kaestchen s${muskelStufe(punkte[m.id], zeitraum)}` }),
      h('div', { class: 'main' }, h('div', { class: 't', text: m.label }), balken(m)),
      h('div', { class: 'val', text: `${zahl(punkte[m.id])} ${punkte[m.id] === 1 ? 'Satz' : 'Sätze'}` }))));
}

function sheetInhalt(punkte, zeitraum) {
  return h('div', { class: 'figur-sheet-inhalt' },
    baueMuskelFigur(punkte, zeitraum),
    muskelListe(punkte, zeitraum),
    h('p', { class: 'foot-links', text: 'Hauptmuskel zählt 1, mitarbeitender Muskel 0,5 je Arbeitssatz. Aufwärmsätze und Cardio zählen nicht.' }));
}

/** 2D-Ersatz für die 3D-Figur (kein WebGL oder Ladefehler): vorne und hinten nebeneinander. */
function zweiD(punkte) {
  return h('div', { class: 'figur-paar figur-fallback' },
    seite(FIGUR_VORNE, punkte, 'tage7', 'Muskeln vorne'),
    seite(FIGUR_HINTEN, punkte, 'tage7', 'Muskeln hinten'));
}

/**
 * Tab „Start“ (0.5.0): Karte „Trainierte Muskeln · letzte 7 Tage“ mit der drehbaren 3D-Figur,
 * darunter Legende und Liste wie bisher. Lädt beim Öffnen und nach Datenänderungen; liefert die
 * Aktualisierung für den App-Start.
 */
export function initStartseite() {
  const ansicht = document.getElementById('start-ansicht');
  const stage = h('div', { class: 'figur3d' });
  const inhalt = h('div');
  const figur = erstelleFigur(stage);
  ansicht.replaceChildren(
    h('div', { class: 'title-row' }, h('h1', { class: 'largetitle', text: 'Start' }),
      h('button', { class: 'glass', id: 'glas-knopf', type: 'button', 'aria-label': 'Sicherung', onclick: oeffneSicherung },
        icon('i-sync', 's24'))),
    inhalt);
  const aktualisiere = async () => {
    try {
      const daten = await db.leseDaten();
      const punkte = muskelPunkte(daten, trainingsDerLetztenTage(daten, 7));
      const stufen = Object.fromEntries(MUSKELN.map((m) => [m.id, muskelStufe(punkte[m.id], 'tage7')]));
      inhalt.replaceChildren(
        h('div', { class: 'figur-karte' },
          h('div', { class: 'card-head' },
            h('span', { class: 'k', text: 'Trainierte Muskeln' }),
            h('span', { class: 'sub', text: 'letzte 7 Tage' })),
          stage,
          legende()),
        h('div', { class: 'section-h oben-16', text: 'Sätze pro Muskelgruppe' }),
        h('div', { class: 'start-liste' }, muskelListe(punkte, 'tage7')),
        h('p', { class: 'foot-links', text: 'Hauptmuskel zählt 1, mitarbeitender Muskel 0,5 je Arbeitssatz. Aufwärmsätze und Cardio zählen nicht.' }),
        h('div', { class: 'abstand-16' }));
      figur.setzeInhalt({ stufen, zweiD: () => zweiD(punkte) });
      figur.setzeTabAktiv(!ansicht.hidden);
    } catch (e) {
      console.error('Startseite konnte nicht geladen werden:', e);
    }
  };
  registerTabVerlassen('start', () => figur.setzeTabAktiv(false));
  registerTabUpdater('start', aktualisiere);
  return aktualisiere;
}

/** Figur für ein einzelnes Training (Verlauf → Tag). */
export function baueTrainingsFigur(daten, trainingId) {
  const punkte = muskelPunkte(daten, [trainingId]);
  if (Object.keys(punkte).length === 0) return null;
  return h('div', { class: 'figur-im-sheet' }, baueMuskelFigur(punkte, 'training'));
}

/** Übersicht nach „Training beenden“ (nur bei Kraft-Sätzen); erfüllt sich, wenn sie geschlossen ist. */
export function zeigeTrainingsUebersicht(daten, trainingId) {
  const punkte = muskelPunkte(daten, [trainingId]);
  if (Object.keys(punkte).length === 0) return Promise.resolve();
  return new Promise((fertig) => oeffneSheet({
    klasse: 'figur-sheet',
    beiZu: fertig,
    baue: (zu) => [griff(), sheetKopf('Dieses Training', zu), sheetInhalt(punkte, 'training'),
      h('div', { class: 'sheet-unten' }, h('button', { class: 'btn primary', type: 'button', text: 'Fertig', onclick: zu }))]
  }));
}
