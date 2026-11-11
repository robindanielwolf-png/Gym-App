import * as db from './db.js';
import { baueTabs } from './tabs.js';
import { initVerlauf } from './verlauf.js';
import { initRekorde } from './rekorde.js';
import { initStatistik } from './statistik.js';
import { initTraining, ladeUndZeige } from './training.js';
import { folgeTastatur, offeneEbenen, zeigeAlert } from './ui.js';
import { zeigeSicherungsErinnerung } from './sicherung-sheet.js';

folgeTastatur();
const app = document.getElementById('app');

baueTabs(app);
// Verlauf und Rekorde füllen ihre (von baueTabs angelegten) Ansichten und laden ihre Daten
// selbst, sobald der Tab geöffnet wird oder sich Daten ändern.
initVerlauf();
initStatistik();
initRekorde();
initTraining(app);

navigator.storage?.persist?.().catch(() => {});

db.initialisiere()
  .then(() => ladeUndZeige({ start: true }))
  .then(() => {
    // Zeige die Sicherungs-Erinnerung nach 1-2 Sekunden
    setTimeout(() => { zeigeSicherungsErinnerung().catch(() => {}); }, 1500);
  })
  .catch(() => {
    zeigeAlert({
      titel: 'Das hat nicht geklappt',
      text: 'Deine Daten wurden nicht verändert. Bitte versuche es noch einmal.',
      knoepfe: [{ id: 'ok', label: 'OK', fett: true }]
    });
  });

// Nach Import oder „Rückgängig“ Start bzw. laufendes Training neu aufbauen.
window.addEventListener('gym-daten-geaendert', () => { ladeUndZeige(); });

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
