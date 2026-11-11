/**
 * Hilfsfunktionen für Tab-Aktivierung und Datenänderungen.
 * Das ermöglicht es, dass Verlauf/Rekorde-Tabs sofort aktualisiert werden.
 */

import { registerTabActivation } from './tabs.js';

/**
 * Registriert einen Update-Handler für einen Tab.
 * Handler wird aufgerufen, wenn:
 * 1. Der Tab aktiviert wird (Tabwechsel)
 * 2. Das Event 'gym-daten-geaendert' triggert (Daten gespeichert/gelöscht)
 *
 * tabId: 'verlauf' oder 'rekorde'
 * updateHandler: async function() { ... }
 */
export function registerTabUpdater(tabId, updateHandler) {
  // 1. Bei Tab-Aktivierung
  registerTabActivation(tabId, updateHandler);

  // 2. Bei Datenänderungen
  window.addEventListener('gym-daten-geaendert', updateHandler);
}

/**
 * Hilfsfunktion: auf Datenänderungen hören ohne Tab-Aktivierung.
 * Nützlich für andere Module.
 */
export function onDatenGeaendert(callback) {
  window.addEventListener('gym-daten-geaendert', callback);
}

/**
 * Triggert das Datenänderungs-Event (nur falls nicht bereits triggert).
 * Wird von training.js nach dem Speichern/Löschen aufgerufen.
 */
export function triggerDatenGeaendert() {
  window.dispatchEvent(new Event('gym-daten-geaendert'));
}
