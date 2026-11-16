import { starteFehlerprotokoll } from './fehlerprotokoll.js';
import * as db from './db.js';
import { baueTabs } from './tabs.js';
import { initVerlauf } from './verlauf.js';
import { initMehr } from './mehr.js';
import { initStartseite } from './muskel-figur.js';
import { initTraining, ladeUndZeige } from './training.js';
import { folgeTastatur, offeneEbenen, starteWaechter, zeigeAlert } from './ui.js';
import { aktualisierePunkt, frageErstSichern } from './sicherung-sheet.js';
import { inWarteschlange } from './tab-events.js';

starteFehlerprotokoll();
starteWaechter();
folgeTastatur();
const app = document.getElementById('app');

baueTabs(app);
const aktualisiereStartseite = initStartseite();
// Verlauf füllt seine (von baueTabs angelegte) Ansicht und lädt die Daten selbst, sobald der Tab
// geöffnet wird oder sich Daten ändern. Mehr baut Statistik, Rekorde und Quellen auf.
initVerlauf();
initMehr();
initTraining(app);

// V3: einmal pro Start um dauerhaften Speicher bitten; das Ergebnis zeigt Mehr → Fehlerprotokoll.
try {
  navigator.storage?.persist?.()?.catch?.(() => {});
} catch { /* nicht verfügbar */ }

// Start: Startliste ergänzen, Daten laden, Startseite aufbauen. Klappt das Laden nicht (z. B. Hänger
// beim Start), kommt die Meldung; nach OK lädt die App erneut, höchstens START_VERSUCHE Mal am Stück.
// Danach versucht sie es wieder, sobald sie in den Vordergrund kommt (kein Endlos-Wiederholen).
const START_VERSUCHE = 3;
const INIT_WARTEN_MS = 1500;
let gestartet = false;
let startLaeuft = false;

async function starteApp() {
  if (gestartet || startLaeuft) return;
  startLaeuft = true;
  try {
    // Startliste ergänzen: Hängt das Schreiben, sind vorhandene Daten trotzdem lesbar. Darum höchstens
    // kurz warten; wird die Startliste später fertig, lädt die App einmal nach.
    const init = db.initialisiere().then(() => true, () => false);
    const schnell = await Promise.race([init, new Promise((ok) => setTimeout(() => ok(null), INIT_WARTEN_MS))]);
    if (schnell === null) init.then((ok) => { if (ok) window.dispatchEvent(new Event('gym-daten-geaendert')); });
    for (let versuch = 1; versuch <= START_VERSUCHE; versuch++) {
      if (await ladeUndZeige({ start: true, fehlerAlert: false })) {
        gestartet = true;
        break;
      }
      await zeigeAlert({
        titel: 'Das hat nicht geklappt',
        text: 'Deine Daten wurden nicht verändert. Bitte versuche es noch einmal.',
        knoepfe: [{ id: 'ok', label: 'OK', fett: true }]
      });
    }
  } finally {
    startLaeuft = false;
  }
  if (!gestartet) return;
  await aktualisiereStartseite();
  aktualisierePunkt();
  await frageErstSichern();
}

starteApp().catch(() => {});
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && !gestartet) starteApp().catch(() => {});
});

// Nach Import, „Rückgängig“ oder Änderungen im Verlauf das Training neu aufbauen – in derselben
// Warteschlange wie die Tabs, also nacheinander (F3). Das laufende Training meldet nach einem Satz
// nur 'gym-daten-veraltet' und lädt dafür nichts neu.
window.addEventListener('gym-daten-geaendert', () => { inWarteschlange(() => ladeUndZeige()); });

if ('serviceWorker' in navigator) {
  // Neue Version aktiv: einmal neu laden, sobald die App wieder in den Vordergrund kommt
  // und kein Sheet offen ist. Halb Eingetipptes steht in IndexedDB und kommt danach zurück.
  const hatteVersion = Boolean(navigator.serviceWorker.controller);
  let updateBereit = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hatteVersion) updateBereit = true; });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && updateBereit && offeneEbenen() === 0) location.reload();
  });
  navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => {});
}
