import * as db from './db.js';
import { baueTabs } from './tabs.js';
import { folgeTastatur, zeigeAlert } from './ui.js';

folgeTastatur();
baueTabs(document.getElementById('app'));

navigator.storage?.persist?.().catch(() => {});

db.initialisiere().catch(() => {
  zeigeAlert({
    titel: 'Das hat nicht geklappt',
    text: 'Deine Daten wurden nicht verändert. Bitte versuche es noch einmal.',
    knoepfe: [{ id: 'ok', label: 'OK', fett: true }]
  });
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => {});
}
