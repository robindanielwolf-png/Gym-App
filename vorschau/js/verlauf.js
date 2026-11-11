// Tab Verlauf: Monatskalender mit Trainingsart-Icons, Modal für Trainingstag-Details.
// #17: Monatsansicht, Daten aus IndexedDB, Tag antippen → Modal mit Übungen + Sätze.

import * as db from './db.js';
import { registerTabUpdater } from './tab-events.js';
import { datumKurz } from './format.js';
import { h, icon, oeffneSheet, sheetKopf, einmalig } from './ui.js';

/**
 * Hilfsfunktion: Gibt Trainingsarten-Map (id → trainingsart) zurück.
 */
function artNach(daten) {
  const map = new Map();
  daten.trainingsarten.forEach(art => map.set(art.id, art));
  return map;
}

/**
 * Gruppiert Trainings nach Datum (YYYY-MM-DD).
 * Gibt Map { dateString → [trainings...] } zurück.
 */
function trainingNachDatum(daten) {
  const map = new Map();
  for (const training of daten.trainings) {
    // Extrahiere nur das Datum aus startedAt (ISO-8601)
    const dateStr = training.startedAt.slice(0, 10);
    if (!map.has(dateStr)) map.set(dateStr, []);
    map.get(dateStr).push(training);
  }
  return map;
}

/**
 * Gibt alle Einträge (Sätze + Cardio) für ein Training.
 */
function eintraegeVonTraining(daten, trainingId) {
  return [...daten.saetze, ...daten.cardio].filter(e => e.trainingId === trainingId);
}

/**
 * Schreibt ein Kalender-Monat-Grid mit Tagen und Icons.
 * year: 2026, month: 1-12
 */
function schreibeKalenderTage(container, year, month, trainingNachDatumMap, artNachMap, onTagTipp) {
  const tageOderNummerWochentag = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

  // Erstelle Kopf-Zeile (Wochentage)
  const kopf = h('div', { class: 'calendar-header' });
  tageOderNummerWochentag.forEach(tag => {
    kopf.append(h('div', { class: 'calendar-day-name', text: tag }));
  });
  container.append(kopf);

  // Bestimme den ersten Wochentag des Monats
  // JavaScript Date: 0 = Sonntag, 1 = Montag, ... 6 = Samstag
  // Wir wollen Montag = 0, daher: (getDay() + 6) % 7
  const erstTag = new Date(year, month - 1, 1);
  const letzterTag = new Date(year, month, 0);
  const erstenWochentag = (erstTag.getDay() + 6) % 7; // 0 = Montag, 6 = Sonntag

  // Tage-Grid
  const tage = h('div', { class: 'calendar-days' });

  // Leere Zellen vor dem 1. Tag
  for (let i = 0; i < erstenWochentag; i++) {
    tage.append(h('div', { class: 'calendar-day empty' }));
  }

  // Alle Tage des Monats
  for (let tag = 1; tag <= letzterTag.getDate(); tag++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(tag).padStart(2, '0')}`;
    const trainings = trainingNachDatumMap.get(dateStr) || [];

    const dayEl = h('div', {
      class: trainings.length > 0 ? 'calendar-day has-training' : 'calendar-day',
      onclick: () => trainings.length > 0 && onTagTipp(tag, trainings)
    });

    // Tag-Nummer
    dayEl.append(h('div', { class: 'day-number', text: String(tag) }));

    // Icons der Trainingsarten an diesem Tag (max. 2, nebeneinander)
    if (trainings.length > 0) {
      const iconsDiv = h('div', { class: 'day-icons' });
      trainings.slice(0, 2).forEach(training => {
        const art = artNachMap.get(training.artId);
        if (art && art.icon) {
          iconsDiv.append(icon(art.icon, 'day-icon'));
        }
      });
      dayEl.append(iconsDiv);
    }

    tage.append(dayEl);
  }

  container.append(tage);
}

/**
 * Öffnet Modal mit den Übungen + Sätze eines Trainingstags.
 * training: { id, artId, startedAt, ... }
 * daten: { trainingsarten, uebungen, saetze, cardio, ... }
 */
function oeffneTrainingsDetail(training, daten, artNachMap, onUebungTipp) {
  const art = artNachMap.get(training.artId);
  if (!art) return;

  const eintraege = eintraegeVonTraining(daten, training.id);
  const uebungen = new Map(daten.uebungen.map(u => [u.id, u]));

  // Gruppiere Einträge nach Übung
  const uebungMap = new Map();
  eintraege.forEach(eintrag => {
    if (!uebungMap.has(eintrag.uebungId)) {
      uebungMap.set(eintrag.uebungId, []);
    }
    uebungMap.get(eintrag.uebungId).push(eintrag);
  });

  // Sortiere nach Reihenfolge des Trainings
  const reihenfolge = training.uebungIds || [];
  const sortierteUebungen = [...uebungMap.keys()].sort((a, b) => {
    const aIdx = reihenfolge.indexOf(a);
    const bIdx = reihenfolge.indexOf(b);
    if (aIdx >= 0 && bIdx >= 0) return aIdx - bIdx;
    if (aIdx >= 0) return -1;
    if (bIdx >= 0) return 1;
    return 0;
  });

  // Erstelle Sheet-Inhalt
  const inhalt = h('div', { class: 'verlauf-modal-scroll' });

  // Überschrift im Modal
  const titel = h('div', { class: 'modal-title' },
    h('div', { class: 'title-icon' }, icon(art.icon)),
    h('div', { class: 'title-text' },
      h('div', { class: 'art-name', text: art.name }),
      h('div', { class: 'training-count', text: `${uebungMap.size} Übung${uebungMap.size !== 1 ? 'en'} · ${eintraege.length} Sätze` })));
  inhalt.append(titel);

  // Liste der Übungen
  const liste = h('div', { class: 'verlauf-uebung-liste' });

  sortierteUebungen.forEach(uebungId => {
    const uebung = uebungen.get(uebungId);
    if (!uebung) return;

    const saetze = uebungMap.get(uebungId) || [];
    const saetzeText = saetze.map(satz => {
      if (satz.dauerMin !== undefined) {
        // Cardio
        return `${satz.dauerMin} min`;
      } else {
        // Kraft
        const gewicht = satz.gewicht !== undefined ? `${satz.gewicht} kg` : '–';
        const wdh = satz.wdh ? `${satz.wdh}×` : '–';
        return `${gewicht} ${wdh}`;
      }
    }).join(', ');

    const uebungEl = h('div', {
      class: 'verlauf-uebung-eintrag',
      onclick: () => {
        onUebungTipp(uebung);
      }
    },
      h('div', { class: 'uebung-name', text: uebung.name }),
      h('div', { class: 'uebung-saetze', text: saetzeText }),
      h('div', { class: 'uebung-pfeil' }, icon('i-chev')));

    liste.append(uebungEl);
  });

  inhalt.append(liste);

  // Öffne Sheet
  oeffneSheet({
    kopf: sheetKopf({ titel: datumKurz(training.startedAt) }),
    inhalt: inhalt,
    klasse: 'verlauf-sheet'
  });
}

/**
 * Hauptfunktion: Erstellt die Verlauf-Ansicht mit Monatskalender.
 * Sucht nach #verlauf-ansicht und füllt sie mit Inhalten.
 */
export function initVerlauf() {
  let datenGlobal = null;
  let aktuellMonat = new Date().getMonth() + 1; // 1-12
  let aktuellJahr = new Date().getFullYear();

  const ansicht = document.getElementById('verlauf-ansicht');
  if (!ansicht) {
    console.error('Verlauf-Ansicht Element nicht gefunden');
    return;
  }

  const kopf = h('div', { class: 'verlauf-kopf' },
    h('h1', { class: 'largetitle', text: 'Verlauf' }),
    h('div', { class: 'monat-nav' },
      h('button', {
        class: 'btn-nav',
        type: 'button',
        'aria-label': 'Vorheriger Monat',
        onclick: () => wechselMonat(-1)
      }, h('span', { text: '<' })),
      h('div', { class: 'monat-anzeige', id: 'monat-anzeige' }),
      h('button', {
        class: 'btn-nav',
        type: 'button',
        'aria-label': 'Nächster Monat',
        onclick: () => wechselMonat(1)
      }, h('span', { text: '>' }))));

  const kalenderContainer = h('div', { class: 'kalender-container' });

  ansicht.append(kopf, kalenderContainer);

  /**
   * Aktualisiert die Kalender-Anzeige.
   */
  function zeichneKalender() {
    kalenderContainer.replaceChildren();

    if (!datenGlobal) return;

    const artNachMap = artNach(datenGlobal);
    const trainingMap = trainingNachDatum(datenGlobal);

    // Monat-Anzeige
    const monate = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
                    'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
    document.getElementById('monat-anzeige').textContent = `${monate[aktuellMonat - 1]} ${aktuellJahr}`;

    // Kalender-Tage
    schreibeKalenderTage(kalenderContainer, aktuellJahr, aktuellMonat, trainingMap, artNachMap,
      (tag, trainings) => {
        // Alle Trainings dieses Tages zeigen (nur das erste für jetzt)
        // TODO: Falls mehrere Trainings an einem Tag, erst Liste zeigen
        if (trainings.length > 0) {
          oeffneTrainingsDetail(trainings[0], datenGlobal, artNachMap, (uebung) => {
            // #10 Übungsdetail öffnen (noch nicht implementiert)
            console.log('Übungsdetail öffnen:', uebung);
          });
        }
      });
  }

  /**
   * Wechselt den Monat.
   */
  function wechselMonat(delta) {
    aktuellMonat += delta;
    if (aktuellMonat > 12) {
      aktuellMonat = 1;
      aktuellJahr += 1;
    } else if (aktuellMonat < 1) {
      aktuellMonat = 12;
      aktuellJahr -= 1;
    }
    zeichneKalender();
  }

  /**
   * Update-Handler: Wird aufgerufen bei Tab-Aktivierung oder Datenänderung.
   */
  const updateHandler = einmalig(async () => {
    datenGlobal = await db.leseDaten();
    zeichneKalender();
  });

  // Registriere als Tab-Updater
  registerTabUpdater('verlauf', updateHandler);

  return { ansicht, updateHandler };
}
