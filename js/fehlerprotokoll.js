// Fehlerprotokoll (0.5.2, V1): Hänger und nicht geklappte Speicherungen mit Uhrzeit, nur lokal in
// localStorage (keine Datenbank, keine Migration, nicht in der Sicherung). Einträge enthalten nie
// Trainingswerte: nur Zeit, Art und einen Kurztext. Ohne Zugriff auf die Oberfläche.
import { IST_VORSCHAU } from './umgebung.js';

// Vorschau und Live teilen sich die Domain und damit localStorage: eigener Schlüssel je Bereich.
const SCHLUESSEL = IST_VORSCHAU ? 'gym-tracker-vorschau-fehlerprotokoll' : 'gym-tracker-fehlerprotokoll';
const MAX_EINTRAEGE = 100;
const MAX_TEXT = 140;
// Gleicher Eintrag kurz hintereinander (z. B. bei jedem Tastendruck) wird nur einmal protokolliert.
const DOPPELT_MS = 30000;

function lese() {
  try {
    const liste = JSON.parse(localStorage.getItem(SCHLUESSEL) || '[]');
    return Array.isArray(liste) ? liste.filter((e) => e && typeof e.zeit === 'string') : [];
  } catch {
    return [];
  }
}

function schreibe(liste) {
  try {
    localStorage.setItem(SCHLUESSEL, JSON.stringify(liste));
  } catch { /* Speicher voll oder gesperrt: Protokoll ist nicht wichtiger als die App */ }
}

const kurz = (text) => {
  const t = String(text ?? '').replace(/\s+/g, ' ').trim();
  return t.length > MAX_TEXT ? `${t.slice(0, MAX_TEXT - 1)}…` : t;
};

/** Neuer Eintrag. art: z. B. „Speichern hat nicht geklappt“, text: kurze Beschreibung ohne Trainingswerte. */
export function protokolliere(art, text = '') {
  try {
    const liste = lese();
    const eintrag = { zeit: new Date().toISOString(), art: kurz(art), text: kurz(text) };
    const letzter = liste.at(-1);
    if (letzter && letzter.art === eintrag.art && letzter.text === eintrag.text
      && Date.parse(eintrag.zeit) - Date.parse(letzter.zeit) < DOPPELT_MS) return;
    liste.push(eintrag);
    schreibe(liste.slice(-MAX_EINTRAEGE));
    window.dispatchEvent(new Event('gym-fehlerprotokoll'));
  } catch { /* nie die App stören */ }
}

/** Alle Einträge, neueste zuerst. */
export function leseProtokoll() {
  return lese().reverse();
}

export function leereProtokoll() {
  schreibe([]);
  window.dispatchEvent(new Event('gym-fehlerprotokoll'));
}

const fehlerText = (f) => {
  if (!f) return 'ohne Angabe';
  if (typeof f === 'string') return f;
  return [f.name, f.message].filter(Boolean).join(': ') || 'ohne Angabe';
};

/** Unerwartete Programmfehler mitschreiben (einmal beim Start aufrufen). */
export function starteFehlerprotokoll() {
  window.addEventListener('error', (e) => {
    const ort = e.filename ? ` (${e.filename.split('/').pop().split('?')[0]}:${e.lineno || 0})` : '';
    protokolliere('Programmfehler', `${fehlerText(e.error || e.message)}${ort}`);
  });
  window.addEventListener('unhandledrejection', (e) => {
    protokolliere('Programmfehler', `Unbehandelt: ${fehlerText(e.reason)}`);
  });
}
