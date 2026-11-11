// Tab Verlauf: Monatskalender mit Trainingsart-Icons, Modal für Trainingstag-Details.
// #17: Monatsansicht, Daten aus IndexedDB, Tag antippen → Modal mit Übungen + Sätze.

import * as db from './db.js';
import { registerTabUpdater } from './tab-events.js';
import { datumLang, uhrzeit } from './format.js';
import { chipText, nachZeit } from './logik.js';
import { oeffneSatz } from './satz.js';
import { baueTrainingsFigur } from './muskel-figur.js';
import { oeffneUebungsdetail } from './uebungsdetail.js';
import { h, icon, oeffneSheet, sheetKopf, griff, einmalig, leerHinweis } from './ui.js';

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
  // Trainings ohne Sätze (z. B. gerade gestartet) zeigen nichts Sinnvolles im Verlauf
  const mitEintraegen = new Set([...daten.saetze, ...daten.cardio].map((e) => e.trainingId));
  const sortiert = [...daten.trainings].sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt));
  for (const training of sortiert) {
    if (!mitEintraegen.has(training.id)) continue;
    // Lokales Datum (nicht UTC), sonst landet ein Training kurz nach Mitternacht am Vortag
    if (!training.startedAt) continue;
    const d = new Date(training.startedAt);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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
          iconsDiv.append(h('span', { class: 'tag-kachel' }, icon(art.icon, 'day-icon')));
        }
      });
      dayEl.append(iconsDiv);
    }

    tage.append(dayEl);
  }

  container.append(tage);
}

/**
 * Kontext für das Satz-Sheet bei einem beendeten Training (#13): nur Ändern und Löschen,
 * ohne Entwurf, Vorschlag und Rekord-Hinweis. zustand.daten wird nach jeder Änderung neu geladen.
 */
function kontextFuerAltes(zustand, trainingId, beiAenderung) {
  const geaendert = async () => {
    window.dispatchEvent(new Event('gym-daten-geaendert'));
    await beiAenderung();
  };
  return {
    trainingId,
    letztesMal: null,
    heute: (uebungId) => eintraegeVonTraining(zustand.daten, trainingId).filter((e) => e.uebungId === uebungId).sort(nachZeit),
    async speichere(store, eintrag) { await db.speichereEintrag(store, eintrag); await geaendert(); },
    async loesche(store, eintrag) { await db.loescheEintrag(store, eintrag.id); await geaendert(); },
    merke() {},
    pruefeRekord() {},
    koerpergewicht: () => {
      const k = (zustand.daten.koerpergewicht || []).at(-1);
      return typeof k?.kg === 'number' ? k.kg : null;
    },
    setzeKoerpergewicht: (kg) => db.speichereKoerpergewicht(kg),
    kgGefragt: () => true,
    markiereKgGefragt() {}
  };
}

/** Ein Training im Tages-Sheet: Kopf, Muskelfigur, Übungen mit antippbaren Sätzen. */
function trainingsBlock(zustand, training, aktualisiere) {
  const daten = zustand.daten;
  const art = artNach(daten).get(training.artId);
  const eintraege = eintraegeVonTraining(daten, training.id).sort(nachZeit);
  if (!art || eintraege.length === 0) return null;
  const uebungen = new Map(daten.uebungen.map((u) => [u.id, u]));
  const proUebung = new Map();
  for (const e of eintraege) {
    if (!proUebung.has(e.uebungId)) proUebung.set(e.uebungId, []);
    proUebung.get(e.uebungId).push(e);
  }
  const reihenfolge = training.uebungIds || [];
  const rang = (id) => (reihenfolge.indexOf(id) >= 0 ? reihenfolge.indexOf(id) : reihenfolge.length);
  const ids = [...proUebung.keys()].sort((a, b) => rang(a) - rang(b));

  return h('div', { class: 'verlauf-training' },
    h('div', { class: 'modal-title' },
      h('div', { class: 'title-icon' }, icon(art.icon)),
      h('div', { class: 'title-text' },
        h('div', { class: 'art-name', text: art.name }),
        h('div', { class: 'training-count', text: `${uhrzeit(training.startedAt)} · ${ids.length} ${ids.length === 1 ? 'Übung' : 'Übungen'} · ${eintraege.length} ${eintraege.length === 1 ? 'Satz' : 'Sätze'}` }))),
    baueTrainingsFigur(daten, training.id),
    h('div', { class: 'verlauf-uebung-liste' }, ids.map((id) => {
      const uebung = uebungen.get(id);
      if (!uebung) return null;
      return h('div', { class: 'verlauf-uebung' },
        h('button', { class: 'verlauf-uebung-eintrag', type: 'button', onclick: () => oeffneUebungsdetail(zustand.daten, uebung) },
          h('div', { class: 'uebung-name', text: uebung.name }),
          h('div', { class: 'uebung-pfeil' }, icon('i-chev'))),
        h('div', { class: 'sets verlauf-saetze' }, proUebung.get(id).map((e) =>
          h('button', {
            class: e.aufwaermen ? 'chip warm' : 'chip', type: 'button', text: chipText(uebung, e),
            'aria-label': `Satz ändern: ${chipText(uebung, e)}`,
            onclick: () => oeffneSatz({ uebung, kontext: kontextFuerAltes(zustand, training.id, aktualisiere), bearbeite: e })
          }))));
    })));
}

/** Tages-Sheet: alle Trainings des Tages; Sätze antippen zum Ändern oder Löschen. */
function oeffneTagesDetail(datenStart, trainings) {
  const zustand = { daten: datenStart };
  const ids = trainings.map((t) => t.id);
  const inhalt = h('div', { class: 'verlauf-modal-scroll' });
  const fuelle = () => {
    const bloecke = ids.map((id) => zustand.daten.trainings.find((t) => t.id === id))
      .filter(Boolean).map((t) => trainingsBlock(zustand, t, aktualisiere)).filter(Boolean);
    inhalt.replaceChildren(
      ...(bloecke.length ? bloecke : [h('p', { class: 'foot-links', text: 'An diesem Tag gibt es keine Sätze mehr.' })]),
      h('p', { class: 'foot-links verlauf-hinweis', text: 'Satz antippen, um ihn zu ändern oder zu löschen.' }));
  };
  const aktualisiere = async () => {
    zustand.daten = await db.leseDaten();
    fuelle();
  };
  fuelle();
  oeffneSheet({
    klasse: 'verlauf-sheet',
    baue: (zu) => [griff(), sheetKopf(datumLang(trainings[0].startedAt), zu), inhalt]
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
      }, icon('i-back', 's16')),
      h('div', { class: 'monat-anzeige', id: 'monat-anzeige' }),
      h('button', {
        class: 'btn-nav',
        type: 'button',
        'aria-label': 'Nächster Monat',
        onclick: () => wechselMonat(1)
      }, icon('i-chev', 's16'))));

  const kalenderContainer = h('div', { class: 'kalender-container' });
  const leer = h('div', { class: 'empty-wrap', hidden: true },
    leerHinweis({ iconName: 'i-calendar', headline: 'Noch kein Training', subhead: 'Deine Trainings erscheinen hier im Kalender.' }));

  ansicht.replaceChildren(kopf, kalenderContainer, leer);

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

    leer.hidden = trainingMap.size > 0;

    // Kalender-Tage
    schreibeKalenderTage(kalenderContainer, aktuellJahr, aktuellMonat, trainingMap, artNachMap,
      (tag, trainings) => {
        if (trainings.length > 0) oeffneTagesDetail(datenGlobal, trainings);
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
