// 3D-Muskelfigur auf dem Tab Start (Backlog #25–27, Design „Muskelfigur 3D“).
// Dieses Modul ist klein. three.js und das Modell lädt figur-3d-kern.js erst, wenn der Tab Start
// sichtbar ist. Ohne WebGL oder bei einem Fehler zeigt sich still die 2D-Figur (nur console).
// Verlässt man den Tab oder geht die App in den Hintergrund, wird der WebGL-Kontext freigegeben;
// beim Zurückkommen wird die Figur neu aufgebaut.

const KERN = './figur-3d-kern.js';

/**
 * Steuert die Figur im Platz `stage` (520 px hoch, von muskel-figur.js angelegt).
 * setzeInhalt({ stufen, zweiD }): stufen = { kennung: 0–3 }, zweiD() liefert die 2D-Figur als Ersatz.
 * setzeTabAktiv(bool): true, wenn der Tab Start offen ist.
 */
export function erstelleFigur(stage) {
  let stufen = {};
  let zweiD = null;
  let tabAktiv = false;
  let kern = null;      // Handle aus figur-3d-kern.js, solange gezeichnet wird
  let laedt = false;
  let nutzt2D = false;  // ab hier bleibt es für diese App-Sitzung bei der 2D-Figur
  let token = 0;        // macht Ladevorgänge ungültig, die nach einem Abbau fertig werden

  const soll = () => tabAktiv && !document.hidden;

  function abbauen() {
    token++;
    laedt = false;
    kern?.dispose();
    kern = null;
    stage.replaceChildren();
  }

  function zeige2D() {
    abbauen();
    nutzt2D = true;
    if (zweiD) stage.replaceChildren(zweiD());
  }

  function aufbauen() {
    const mein = ++token;
    laedt = true;
    const platz = document.createElement('div');
    platz.className = 'figur3d-platz';
    platz.textContent = 'Figur wird geladen …';
    stage.replaceChildren(platz);
    import(KERN)
      .then((modul) => modul.baueFigur(stage, stufen, () => { if (mein === token) zeige2D(); }))
      .then((handle) => {
        if (mein !== token || !soll()) {
          handle.dispose();
          return;
        }
        handle.setLevels(stufen);
        kern = handle;
        laedt = false;
      })
      .catch((e) => {
        if (mein !== token) return;
        console.warn('3D-Muskelfigur nicht verfügbar, 2D-Figur wird gezeigt:', e);
        zeige2D();
      });
  }

  function zeigeInhalt() {
    if (!soll()) {
      abbauen();
      return;
    }
    if (nutzt2D) {
      if (zweiD) stage.replaceChildren(zweiD());
      return;
    }
    if (kern) {
      kern.setLevels(stufen);
      return;
    }
    if (!laedt) aufbauen();
  }

  document.addEventListener('visibilitychange', zeigeInhalt);

  return {
    setzeInhalt({ stufen: neue, zweiD: fallback }) {
      stufen = neue;
      zweiD = fallback;
      zeigeInhalt();
    },
    setzeTabAktiv(aktiv) {
      tabAktiv = aktiv;
      zeigeInhalt();
    }
  };
}
