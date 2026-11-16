// 3D-Muskelfigur auf dem Tab Start (Backlog #25–27, Design „Muskelfigur 3D“).
// Dieses Modul ist klein. three.js und das Modell lädt figur-3d-kern.js erst, wenn der Tab Start
// sichtbar ist. Ohne WebGL oder bei einem Fehler zeigt sich still die 2D-Figur (nur console).
// 0.5.2 (F4): Die Figur wird einmal pro App-Sitzung aufgebaut und behalten. Verlässt man den Tab,
// liegt Training/Vorschau darüber oder geht die App in den Hintergrund, pausiert nur das Zeichnen.
// Nur nach einem echten Kontextverlust (webglcontextlost) wird sie einmal neu aufgebaut, beim
// zweiten Verlust bleibt es still bei der 2D-Figur. Aussehen unverändert.
import { protokolliere } from './fehlerprotokoll.js';

const KERN = './figur-3d-kern.js';
const NEUAUFBAU_MAX = 1;

/**
 * Steuert die Figur im Platz `stage` (520 px hoch, von muskel-figur.js angelegt).
 * setzeInhalt({ stufen, zweiD }): stufen = { kennung: 0–3 }, zweiD() liefert die 2D-Figur als Ersatz.
 * setzeTabAktiv(bool): true, wenn der Tab Start offen und nicht von Training/Vorschau überdeckt ist.
 */
export function erstelleFigur(stage) {
  let stufen = {};
  let zweiD = null;
  let tabAktiv = false;
  let kern = null;      // Handle aus figur-3d-kern.js, solange die Figur aufgebaut ist
  let laedt = false;
  let nutzt2D = false;  // ab hier bleibt es für diese App-Sitzung bei der 2D-Figur
  let token = 0;        // macht Ladevorgänge ungültig, die nach einem Verlust fertig werden
  let verluste = 0;

  const soll = () => tabAktiv && !document.hidden;

  function zeige2D() {
    token++;
    laedt = false;
    kern?.dispose();
    kern = null;
    nutzt2D = true;
    if (zweiD) stage.replaceChildren(zweiD());
  }

  function verloren() {
    verluste++;
    protokolliere('3D-Figur', verluste > NEUAUFBAU_MAX
      ? 'Grafik-Kontext erneut verloren, 2D-Figur wird gezeigt.'
      : 'Grafik-Kontext verloren, Figur wird neu aufgebaut.');
    if (verluste > NEUAUFBAU_MAX) {
      zeige2D();
      return;
    }
    token++;
    laedt = false;
    kern?.dispose();
    kern = null;
    stage.replaceChildren();
    zeigeInhalt();
  }

  function aufbauen() {
    const mein = ++token;
    laedt = true;
    const platz = document.createElement('div');
    platz.className = 'figur3d-platz';
    platz.textContent = 'Figur wird geladen …';
    stage.replaceChildren(platz);
    import(KERN)
      .then((modul) => modul.baueFigur(stage, stufen, () => { if (mein === token) verloren(); }))
      .then((handle) => {
        if (mein !== token) {
          handle.dispose();
          return;
        }
        handle.setLevels(stufen);
        kern = handle;
        laedt = false;
        kern.pausiere(!soll());
      })
      .catch((e) => {
        if (mein !== token) return;
        console.warn('3D-Muskelfigur nicht verfügbar, 2D-Figur wird gezeigt:', e);
        zeige2D();
      });
  }

  function zeigeInhalt() {
    if (nutzt2D) {
      if (zweiD && soll()) stage.replaceChildren(zweiD());
      return;
    }
    if (kern) {
      kern.setLevels(stufen);
      kern.pausiere(!soll());
      return;
    }
    // Noch nicht aufgebaut: erst, wenn Start wirklich sichtbar ist (nicht hinter einem Training).
    if (soll() && !laedt) aufbauen();
  }

  document.addEventListener('visibilitychange', zeigeInhalt);

  return {
    setzeInhalt({ stufen: neue, zweiD: fallback }) {
      stufen = neue;
      zweiD = fallback;
      zeigeInhalt();
    },
    setzeTabAktiv(aktiv) {
      if (aktiv === tabAktiv) return;
      tabAktiv = aktiv;
      zeigeInhalt();
    }
  };
}
