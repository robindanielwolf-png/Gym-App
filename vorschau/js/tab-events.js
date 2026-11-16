/**
 * Aktualisieren der Tabs nach Datenänderungen (0.5.2, F3/V4).
 * - Beim Öffnen eines Tabs lädt er immer neu (#29).
 * - Nach einer Datenänderung lädt nur ein Tab neu, der gerade sichtbar ist. Alle anderen werden als
 *   veraltet markiert und laden beim nächsten Öffnen bzw. sobald Training/Vorschau sie freigibt.
 * - Neuladen nach Datenänderungen läuft nacheinander in einer Warteschlange, nie parallel.
 *
 * Ereignisse: 'gym-daten-geaendert' (Import, Verlauf, Rekorde: auch das Training lädt neu, main.js)
 * und 'gym-daten-veraltet' (laufendes Training hat selbst schon aktualisiert, nur die Tabs).
 */

import { aktuellerTab, registerTabActivation } from './tabs.js';
import { beiUeberdeckt, istUeberdeckt } from './ui.js';

// Eine hängende Aufgabe darf die Warteschlange nicht blockieren.
const AUFGABE_MAX_MS = 12000;

const updater = new Map();
const veraltet = new Set();
let schlange = Promise.resolve();

/** Hängt eine Lade-Aufgabe an die Warteschlange (nacheinander, höchstens AUFGABE_MAX_MS je Aufgabe). */
export function inWarteschlange(aufgabe) {
  const weiter = schlange.then(() => new Promise((fertig) => {
    const timer = setTimeout(fertig, AUFGABE_MAX_MS);
    Promise.resolve().then(aufgabe).catch((e) => console.error('Neuladen fehlgeschlagen:', e))
      .finally(() => { clearTimeout(timer); fertig(); });
  }));
  schlange = weiter;
  return weiter;
}

const sichtbar = (tabId) => aktuellerTab() === tabId && !istUeberdeckt();

function datenGeaendert() {
  for (const [tabId, handler] of updater) {
    if (sichtbar(tabId)) {
      veraltet.delete(tabId);
      inWarteschlange(() => handler());
    } else {
      veraltet.add(tabId);
    }
  }
}

window.addEventListener('gym-daten-geaendert', datenGeaendert);
window.addEventListener('gym-daten-veraltet', datenGeaendert);

// Training oder Vorschau geschlossen: den jetzt sichtbaren Tab nachladen, falls veraltet.
beiUeberdeckt((zu) => {
  if (zu) return;
  const tabId = aktuellerTab();
  if (!veraltet.has(tabId) || !updater.has(tabId)) return;
  veraltet.delete(tabId);
  inWarteschlange(() => updater.get(tabId)());
});

/**
 * Registriert einen Update-Handler für einen Tab ('start', 'verlauf', 'mehr').
 * Aufruf beim Öffnen des Tabs (sofort, mit { nochmal }) und nach Datenänderungen (ohne Argument),
 * wenn der Tab sichtbar ist.
 */
export function registerTabUpdater(tabId, updateHandler) {
  updater.set(tabId, updateHandler);
  registerTabActivation(tabId, (arg) => {
    veraltet.delete(tabId);
    return updateHandler(arg);
  });
}
