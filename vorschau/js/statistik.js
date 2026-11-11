// Statistik-Views für die Trainingsübersicht nach Muskelgruppe/Woche.
import * as db from './db.js';
import { h, leerHinweis } from './ui.js';
import { saetzeProMuskelgruppe } from './logik.js';
import { MUSKELN_NACH } from './muskeln.js';
import { registerTabUpdater } from './tab-events.js';

// Zeitraum-Konfiguration: tageAnzahl für verschiedene Filter
const ZEITRAEUME = [
  { id: 'heute', label: 'Heute', tage: 1 },
  { id: 'woche', label: 'Diese Woche', tage: 7 },
  { id: 'monat', label: 'Dieser Monat', tage: 30 },
  { id: 'alles', label: 'Alles', tage: 999 }
];

// Ideal-Bereiche pro Woche (grüner Bereich)
const IDEAL_MIN = 10;
const IDEAL_MAX = 20;
const WARN_MIN = 5; // unter 5 = rot

/**
 * Gibt den Status-Farbcode und Text zurück.
 * gruen: 10-20 Sätze
 * orange: 5-9 Sätze
 * rot: < 5 Sätze
 */
function getStatusColor(saetze, tageAnzahl) {
  // Normalisiere auf pro Woche (7 Tage)
  const proWoche = saetze * (7 / tageAnzahl);

  if (proWoche >= IDEAL_MIN && proWoche <= IDEAL_MAX) return 'gruen';
  if (proWoche >= WARN_MIN) return 'orange';
  return 'rot';
}

function getStatusLabel(saetze, tageAnzahl) {
  const proWoche = saetze * (7 / tageAnzahl);

  if (proWoche >= IDEAL_MIN && proWoche <= IDEAL_MAX) return 'Im Plan';
  if (proWoche >= WARN_MIN) return 'Unterschritten';
  return 'Stark unterschritten';
}

/**
 * Sortiert Muskelgruppen nach Kategorie (Reihenfolge: Beine, Brust, Rücken, Arme, Schultern, Bauch).
 */
function sortierMuskelgruppen(kategorieMap) {
  const reihenfolge = ['Beine', 'Brust', 'Rücken', 'Arme', 'Schultern', 'Bauch'];
  const result = [];

  for (const kategorie of reihenfolge) {
    if (kategorieMap.has(kategorie)) {
      result.push({ kategorie, saetze: kategorieMap.get(kategorie) });
    }
  }

  // Übrige Kategorien hinzufügen (falls neue hinzukommen)
  for (const [kategorie, saetze] of kategorieMap) {
    if (!reihenfolge.includes(kategorie)) {
      result.push({ kategorie, saetze });
    }
  }

  return result;
}

/**
 * Erstellt die Statistik-View mit Balkendiagramm und Status.
 * onZeitraumChange: Callback, wenn ein neuer Zeitraum gewählt wird
 */
export function baueSatistikView(daten, zeitraumId = 'woche', onZeitraumChange = null) {
  const zeitraum = ZEITRAEUME.find((z) => z.id === zeitraumId) || ZEITRAEUME[1];

  // Berechne Sätze pro Muskelgruppe
  const proMuskel = saetzeProMuskelgruppe(daten, zeitraum.tage);

  // Gruppiere nach Kategorie
  const kategorieMap = new Map();
  for (const [muskelId, saetze] of Object.entries(proMuskel)) {
    const muskel = MUSKELN_NACH.get(muskelId);
    if (!muskel) continue;

    const kategorie = muskel.kategorie;
    if (!kategorieMap.has(kategorie)) {
      kategorieMap.set(kategorie, 0);
    }
    kategorieMap.set(kategorie, kategorieMap.get(kategorie) + saetze);
  }

  // Sortiere Kategorien
  const sortiert = sortierMuskelgruppen(kategorieMap);

  // Finde Max für Balken-Skalierung
  const maxSaetze = Math.max(...sortiert.map((g) => g.saetze), 1);
  const maxFuerSkala = Math.ceil(maxSaetze / 5) * 5; // Auf nächste 5 runden

  // Zeitraum-Filter Buttons
  const zeitraumButtons = h('div', { class: 'statistik-filter' },
    ...ZEITRAEUME.map((z) =>
      h('button', {
        type: 'button',
        class: ['zeitraum-btn', z.id === zeitraumId && 'active'].filter(Boolean).join(' '),
        text: z.label,
        onclick: () => {
          if (onZeitraumChange) {
            onZeitraumChange(z.id);
          }
        }
      })
    )
  );

  // Balken-Diagramm
  const baelkchen = sortiert.map(({ kategorie, saetze }) => {
    const proWoche = saetze * (7 / zeitraum.tage);
    const statusColor = getStatusColor(saetze, zeitraum.tage);
    const statusLabel = getStatusLabel(saetze, zeitraum.tage);
    const balkenBreite = (saetze / maxFuerSkala) * 100;

    const balken = h('div', { class: `stat-bar stat-bar-${statusColor}` });
    balken.style.width = `${balkenBreite}%`;
    return h('div', { class: 'statistik-zeile' },
      h('div', { class: 'stat-label' },
        h('span', { class: 'stat-name', text: kategorie }),
        h('span', { class: `stat-value stat-${statusColor}`, text: `${Math.round(saetze * 10) / 10}`.replace('.', ',') })),
      h('div', { class: 'stat-balken' },
        balken,
        h('span', { class: 'stat-info', text: `${String(Math.round(proWoche * 10) / 10).replace('.', ',')} Sätze/Woche` })),
      h('span', { class: `stat-status stat-status-${statusColor}`, text: statusLabel })
    );
  });

  // Ideal-Bereich Info
  const infoBox = h('div', { class: 'statistik-info' },
    h('p', { text: `Ideal-Bereich: ${IDEAL_MIN}–${IDEAL_MAX} Sätze pro Woche` })
  );

  const inhalt = baelkchen.length
    ? h('div', { class: 'statistik-inhalt' }, ...baelkchen)
    : leerHinweis({ iconName: 'i-chart', headline: 'Noch keine Sätze', subhead: 'In diesem Zeitraum gibt es noch keine Kraft-Sätze.' });

  return h('div', { class: 'statistik-container' },
    h('h2', { class: 'statistik-title', text: 'Sätze pro Muskelgruppe' }),
    zeitraumButtons,
    inhalt,
    infoBox
  );
}

/** Füllt die von baueTabs angelegte Ansicht und lädt die Daten beim Öffnen und nach Änderungen. */
export function initStatistik() {
  const ansicht = document.getElementById('statistik-ansicht');
  const inhalt = h('div');
  ansicht.replaceChildren(h('div', { class: 'title-row' }, h('h1', { class: 'largetitle', text: 'Statistik' })), inhalt);
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

