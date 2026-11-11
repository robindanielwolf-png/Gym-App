// Tab Statistik: gewichtete Sätze je Muskelgruppe, gleiche Rechnung wie die Muskelfigur.
import * as db from './db.js';
import { h, leerHinweis } from './ui.js';
import { MUSKELN, muskelPunkte, muskelStufe, trainingsDerLetztenTage } from './muskeln.js';
import { registerTabUpdater } from './tab-events.js';

const ZEITRAEUME = [
  { id: 'heute', label: 'Heute', tage: 1 },
  { id: 'woche', label: 'Woche', tage: 7 },
  { id: 'monat', label: 'Monat', tage: 30 },
  { id: 'alles', label: 'Alles', tage: null }
];

// Ideal-Bereich je Muskelgruppe und Woche (Trainingsexperte; noch nicht bestätigt).
const IDEAL_MIN = 10;
const IDEAL_MAX = 20;
const WARN_MIN = 5;

const zahl = (x) => String(Math.round(x * 10) / 10).replace('.', ',');

function statusText(proWoche) {
  if (proWoche > IDEAL_MAX) return 'Über dem Ideal';
  if (proWoche >= IDEAL_MIN) return 'Im Plan';
  if (proWoche >= WARN_MIN) return 'Unterschritten';
  return 'Stark unterschritten';
}

/**
 * Ansicht mit Zeitraum-Segment und einer Zeile je trainierter Muskelgruppe. Balken in den
 * Stufenfarben der Muskelfigur (Design: keine Ampelfarben); bei „Alles“ nur die Summe.
 */
export function baueSatistikView(daten, zeitraumId = 'woche', onZeitraumChange = null) {
  const zeitraum = ZEITRAEUME.find((z) => z.id === zeitraumId) || ZEITRAEUME[1];
  const trainingIds = zeitraum.tage ? trainingsDerLetztenTage(daten, zeitraum.tage) : daten.trainings.map((t) => t.id);
  const punkte = muskelPunkte(daten, trainingIds);
  const zeilen = MUSKELN.filter((m) => punkte[m.id] > 0).sort((a, b) => punkte[b.id] - punkte[a.id]);
  const max = Math.max(...zeilen.map((m) => punkte[m.id]), 1);

  const segment = h('div', { class: 'seg statistik-seg' }, ZEITRAEUME.map((z) =>
    h('button', { type: 'button', class: z.id === zeitraum.id ? 'on' : '', text: z.label, onclick: () => onZeitraumChange?.(z.id) })));

  const liste = zeilen.map((m) => {
    const wert = punkte[m.id];
    const proWoche = zeitraum.tage ? wert * (7 / zeitraum.tage) : null;
    const stufe = proWoche === null ? 2 : Math.max(1, muskelStufe(proWoche, 'tage7'));
    const balken = h('div', { class: `stat-bar s${stufe}` });
    balken.style.width = `${(wert / max) * 100}%`;
    return h('div', { class: 'statistik-zeile' },
      h('div', { class: 'stat-label' },
        h('span', { class: 'stat-name', text: m.label }),
        h('span', { class: 'stat-value', text: zahl(wert) })),
      h('div', { class: 'stat-balken' }, balken),
      proWoche !== null && h('div', { class: 'stat-status', text: `${zahl(proWoche)} Sätze/Woche · ${statusText(proWoche)}` }));
  });

  return h('div', { class: 'statistik-container' },
    segment,
    liste.length
      ? h('div', { class: 'statistik-inhalt' }, liste)
      : leerHinweis({ iconName: 'i-chart', headline: 'Noch keine Sätze', subhead: 'In diesem Zeitraum gibt es noch keine Kraft-Sätze.' }),
    h('div', { class: 'statistik-info' },
      h('p', { text: zeitraum.tage
        ? `Ideal-Bereich: ${IDEAL_MIN}–${IDEAL_MAX} Sätze pro Muskelgruppe und Woche. Hauptmuskel zählt 1, mitarbeitender 0,5.`
        : 'Summe aller Trainings. Hauptmuskel zählt 1, mitarbeitender 0,5.' })));
}

/** Füllt die von baueTabs angelegte Ansicht und lädt die Daten beim Öffnen und nach Änderungen. */
export function initStatistik() {
  const ansicht = document.getElementById('statistik-ansicht');
  const inhalt = h('div');
  ansicht.replaceChildren(
    h('div', { class: 'title-row' }, h('h1', { class: 'largetitle', text: 'Statistik' })),
    h('div', { class: 'start-unterzeile', text: 'Sätze pro Muskelgruppe' }),
    inhalt);
  let zeitraum = 'woche';
  let daten = null;
  const zeichne = () => {
    if (daten) inhalt.replaceChildren(baueSatistikView(daten, zeitraum, (z) => { zeitraum = z; zeichne(); }));
  };
  registerTabUpdater('statistik', async () => {
    try {
      daten = await db.leseDaten();
      zeichne();
    } catch (e) {
      console.error('Statistik konnte nicht geladen werden:', e);
    }
  });
}
