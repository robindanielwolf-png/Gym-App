// Muskel-Daten und Hilfsfunktionen für die Zuordnung von Übungen zu Muskeln.
// Die Muskeldaten stammen aus startdaten.js und sind lesend nur von dort.

import { MUSKELN, STARTLISTE } from './startdaten.js';

// Nachschlage-Objekt: Muskel-ID → Muskel-Objekt
export const MUSKELN_NACH = new Map(MUSKELN.map((m) => [m.id, m]));

/**
 * Gibt den Namen eines Muskels zurück.
 * @param {string} muskelId - Die ID des Muskels (z.B. 'bizeps')
 * @returns {string} Der Label des Muskels oder undefined wenn nicht gefunden
 */
export function getMuskelName(muskelId) {
  return MUSKELN_NACH.get(muskelId)?.label;
}

/**
 * Gibt die Kategorie eines Muskels zurück.
 * @param {string} muskelId - Die ID des Muskels
 * @returns {string} Die Kategorie (z.B. 'Arme', 'Beine')
 */
export function getMuskelKategorie(muskelId) {
  return MUSKELN_NACH.get(muskelId)?.kategorie;
}

/**
 * Gibt die Haupt- und Hilfsmuskeln einer Übung als Labels zurück.
 * @param {object} uebung - Die Übung mit muskeln-Array
 * @returns {object} { haupt: ['Name1', 'Name2'], hilf: ['Name3'] }
 */
export function getMuskelNamen(uebung) {
  if (!uebung?.muskeln) {
    return { haupt: [], hilf: [] };
  }

  const haupt = [];
  const hilf = [];

  for (const m of uebung.muskeln) {
    const label = getMuskelName(m.id);
    if (label) {
      if (m.rolle === 'haupt') {
        haupt.push(label);
      } else if (m.rolle === 'hilf') {
        hilf.push(label);
      }
    }
  }

  return { haupt, hilf };
}

/**
 * Gibt alle Übungen zurück, die einen bestimmten Muskel trainieren (egal ob haupt oder hilf).
 * @param {array} daten - Die Übungs-Daten (z.B. STARTLISTE oder aus IndexedDB)
 * @param {string} muskelId - Die Muskel-ID
 * @returns {array} Array von Übungen, die diesen Muskel trainieren
 */
export function getUebungenPerMuskel(daten, muskelId) {
  if (!Array.isArray(daten)) {
    return [];
  }

  return daten.filter((u) => {
    if (!u.muskeln) return false;
    return u.muskeln.some((m) => m.id === muskelId);
  });
}

/**
 * Gibt alle Übungen zurück, die einen Muskel als Hauptmuskel trainieren.
 * @param {array} daten - Die Übungs-Daten
 * @param {string} muskelId - Die Muskel-ID
 * @returns {array} Array von Übungen mit diesem Muskel als Hauptmuskel
 */
export function getUebungenHauptmuskel(daten, muskelId) {
  if (!Array.isArray(daten)) {
    return [];
  }

  return daten.filter((u) => {
    if (!u.muskeln) return false;
    return u.muskeln.some((m) => m.id === muskelId && m.rolle === 'haupt');
  });
}

/**
 * Gibt alle Übungen nach Muskel-Kategorie gruppiert zurück.
 * Nützlich für die Muskel-Karte.
 * @param {array} daten - Die Übungs-Daten
 * @returns {object} { 'Beine': [uebungen...], 'Arme': [...], ... }
 */
export function getUebungenNachMuskelKategorie(daten) {
  const result = {};

  for (const muskel of MUSKELN) {
    const uebungen = getUebungenPerMuskel(daten, muskel.id);
    if (uebungen.length > 0) {
      if (!result[muskel.kategorie]) {
        result[muskel.kategorie] = [];
      }
      result[muskel.kategorie].push(...uebungen);
    }
  }

  return result;
}

/**
 * Gibt an, welche Muskeln in den Daten trainiert werden.
 * @param {array} daten - Die Übungs-Daten
 * @returns {array} Array von Muskel-IDs, die mindestens eine Übung haben
 */
export function getTrainierteMuskeln(daten) {
  const trainiert = new Set();

  for (const u of (Array.isArray(daten) ? daten : [])) {
    if (u.muskeln) {
      for (const m of u.muskeln) {
        trainiert.add(m.id);
      }
    }
  }

  return Array.from(trainiert);
}
