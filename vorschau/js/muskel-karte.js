// Muskel-Karte 2D: Körper-Diagramm mit Einfärbung nach Trainingspunkten
// Basiert auf react-muscle-highlighter v1.2.0 (MIT-Lizenz)
// Implementiert die Punkte-Regel vom Trainingsexperten (Muskeldaten.md)

import { MUSKELN, STARTLISTE } from './startdaten.js';
import { eintraegeVon, istCardio, istNurWdh, istZeit } from './logik.js';

/**
 * Berechnet Trainings-Punkte pro Muskel nach Trainingsexperte-Regel.
 * - Hauptmuskel: 1 Punkt pro Arbeitssatz (Satzfaktor)
 * - Hilfsmuskel: 0,5 Punkte pro Arbeitssatz (Satzfaktor)
 */
export function berechneMuskelPunkte(daten, trainingIds = null, nurDieseTrainings = false) {
  const muskelPunkte = {};

  // Initialisiere alle Muskeln mit 0
  for (const m of MUSKELN) {
    muskelPunkte[m.id] = 0;
  }

  if (!trainingIds || trainingIds.length === 0) return muskelPunkte;
  const trainingsIdSet = new Set(trainingIds);

  // Gehe durch alle Sätze
  for (const satz of (daten.saetze || [])) {
    if (!trainingsIdSet.has(satz.trainingId)) continue;

    // Finde die Übung
    const uebung = daten.uebungen.find((u) => u.id === satz.uebungId);
    if (!uebung || !uebung.muskeln || uebung.muskeln.length === 0) continue;

    // Springe über Aufwärmsätze
    if (satz.aufwaermen) continue;

    // Berechne Satzfaktor
    let satzfaktor = 1;
    if (istNurWdh(uebung) || istZeit(uebung)) {
      satzfaktor = calcWdhZeitFaktor(daten, satz, uebung);
    }

    // Addiere Punkte für jeden Muskel
    for (const muskel of uebung.muskeln) {
      const rolle = muskel.rolle === 'haupt' ? 1 : 0.5;
      const punkte = rolle * satzfaktor;
      if (muskelPunkte[muskel.id] !== undefined) {
        muskelPunkte[muskel.id] += punkte;
      }
    }
  }

  // Runde auf 2 Dezimalstellen
  for (const k in muskelPunkte) {
    muskelPunkte[k] = Math.round(muskelPunkte[k] * 100) / 100;
  }

  return muskelPunkte;
}

function calcWdhZeitFaktor(daten, satz, uebung) {
  const vorherigeSaetze = (daten.saetze || [])
    .filter((s) => s.uebungId === satz.uebungId && !s.aufwaermen && s.id !== satz.id)
    .sort((a, b) => (a.erstelltAm || '') > (b.erstelltAm || '') ? 1 : -1);

  const referenz = vorherigeSaetze.length < 3 ? (istZeit(uebung) ? 60 : 20) : calcDurchschnittLetzten5(vorherigeSaetze, uebung);

  const wert = istZeit(uebung) ? (satz.sekunden || 0) : (satz.wdh || 0);
  const faktor = Math.min(0.75, 0.5 * (wert / referenz));

  return Math.max(0, faktor);
}

function calcDurchschnittLetzten5(saetze, uebung) {
  const letzten5 = saetze.slice(-5);
  let summe = 0;
  for (const s of letzten5) {
    const wert = istZeit(uebung) ? (s.sekunden || 0) : (s.wdh || 0);
    summe += wert || 0;
  }
  return summe / letzten5.length || 1;
}

/**
 * Bestimmt die Farbstufe eines Muskels.
 */
export function getMuskelStufe(punkte, zeitraum = 'training') {
  if (punkte <= 0) return 0;

  if (zeitraum === '7tage') {
    if (punkte <= 5) return 1;
    if (punkte <= 10) return 2;
    return 3;
  } else {
    if (punkte <= 2.5) return 1;
    if (punkte <= 5) return 2;
    return 3;
  }
}

/**
 * Gibt die Hex-Farbe für einen Muskel.
 */
export function getMuskelFarbe(stufe) {
  const farben = [
    '#C9CCD3', // Stufe 0: Grau
    '#9CC9FF', // Stufe 1: Hellblau
    '#4DA3FF', // Stufe 2: Mittelblau
    '#007AFF'  // Stufe 3: Dunkelblau
  ];
  return farben[stufe] || farben[0];
}

/**
 * Filtert Trainings-IDs nach Zeitraum.
 */
export function filterTrainingsIdNachZeitraum(daten, trainingIds, zeitraum = 'training') {
  if (zeitraum === 'training') {
    return trainingIds;
  }

  const tage = zeitraum === '7tage' ? 7 : 30;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - tage + 1);
  const cutoffMs = cutoff.getTime();

  return trainingIds.filter((tId) => {
    const t = daten.trainings.find((t) => t.id === tId);
    return t && new Date(t.startedAt || '').getTime() >= cutoffMs;
  });
}

/**
 * Gibt den Namen eines Muskels.
 */
export function getMuskelLabel(muskelId) {
  return MUSKELN.find((m) => m.id === muskelId)?.label || muskelId;
}

/**
 * Rendert die Muskelkarte als HTML.
 */
export function renderMuskelKarte(daten, trainingIds, zeitraum = 'training') {
  const gefiltert = filterTrainingsIdNachZeitraum(daten, trainingIds, zeitraum);
  const muskelPunkte = berechneMuskelPunkte(daten, gefiltert);

  let html = `<div class="muskel-karte-container" data-zeitraum="${zeitraum}">`;
  html += `<div class="muskel-legende">`;
  html += `<span style="background: ${getMuskelFarbe(0)}; width:12px; height:12px; display:inline-block; border-radius:3px; margin-right:6px;"></span> Nicht trainiert<br>`;
  html += `<span style="background: ${getMuskelFarbe(1)}; width:12px; height:12px; display:inline-block; border-radius:3px; margin-right:6px;"></span> ${zeitraum === '7tage' ? '1–5 Pkte' : '1–2,5 Pkte'}<br>`;
  html += `<span style="background: ${getMuskelFarbe(2)}; width:12px; height:12px; display:inline-block; border-radius:3px; margin-right:6px;"></span> ${zeitraum === '7tage' ? '5–10 Pkte' : '2,5–5 Pkte'}<br>`;
  html += `<span style="background: ${getMuskelFarbe(3)}; width:12px; height:12px; display:inline-block; border-radius:3px; margin-right:6px;"></span> ${zeitraum === '7tage' ? '>10 Pkte' : '>5 Pkte'}`;
  html += `</div>`;
  html += `<p style="font-size:12px; color:#999; margin:4px 0 0;">(SVG-Figur wird später integriert)</p>`;
  html += `</div>`;

  return html;
}

export default { berechneMuskelPunkte, getMuskelStufe, getMuskelFarbe, renderMuskelKarte };
