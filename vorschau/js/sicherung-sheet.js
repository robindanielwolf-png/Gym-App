// Sheet 10: Export, Import und „Import rückgängig machen”.
import * as db from './db.js';
import {
  baueSicherung, dateiname, istLeer, pruefeSicherung, zaehle,
  pruefeSicherungsErinnerung, resetSicherungsErinnerung, setzErinnerungNieMehr, setzErinnerungSpaeter
} from './sicherung.js';
import { datumLang, datumZeit, inhaltText, letzteSicherungText } from './format.js';
import { einmalig, h, icon, oeffneSheet, sheetKopf, griff, zeigeAlert, zeigeHinweis } from './ui.js';

const DREHEN_MIN_MS = 800;

const F1 = {
  titel: 'Datei nicht lesbar',
  text: 'Das ist keine gültige Gym-Tracker-Sicherung oder die Datei ist beschädigt. Deine Daten wurden nicht verändert.',
  knoepfe: [{ id: 'ok', label: 'OK', fett: true }]
};
const F2 = {
  titel: 'Das hat nicht geklappt',
  text: 'Deine Daten wurden nicht verändert. Bitte versuche es noch einmal.',
  knoepfe: [{ id: 'ok', label: 'OK', fett: true }]
};

let stand = null;
let aktualisiereAnzeige = () => {};
let exportLaeuft = false;

async function ladeStand() {
  stand = await db.leseStand();
  aktualisiereAnzeige();
}

const meldeAenderung = () => window.dispatchEvent(new Event('gym-daten-geaendert'));

function ladeHerunter(datei) {
  const url = URL.createObjectURL(datei);
  const link = h('a', { href: url, download: datei.name });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
  return 'fertig';
}

function drehen(an) {
  document.querySelector('#glas-knopf svg')?.classList.toggle('spin', an);
}

/**
 * Muss synchron im Tipp starten: iOS erlaubt das Teilen-Menü nur direkt nach einer
 * Nutzeraktion. Darum liegen die Daten in `stand` schon bereit.
 * Liefert 'fertig' oder 'abgebrochen'. Nur ein abgeschlossener Export zählt als Sicherung.
 */
function exportiere() {
  if (exportLaeuft || !stand) return Promise.resolve('abgebrochen');
  exportLaeuft = true;
  const beginn = Date.now();
  drehen(true);

  const jetzt = new Date();
  const sicherung = baueSicherung(stand.daten, jetzt);
  const datei = new File([JSON.stringify(sicherung)], dateiname(jetzt), { type: 'application/json' });

  const kannTeilen = typeof navigator.canShare === 'function' && navigator.canShare({ files: [datei] });
  const vorgang = kannTeilen
    ? navigator.share({ files: [datei] }).then(
      () => 'fertig',
      (e) => (e.name === 'AbortError' ? 'abgebrochen' : ladeHerunter(datei)))
    : Promise.resolve(ladeHerunter(datei));

  return vorgang.then(async (ergebnis) => {
    if (ergebnis === 'fertig') {
      try {
        await db.setzeLetzteSicherung(sicherung.exportiertAm);
        // Nach erfolgreichem Export: Erinnerung resetten
        await resetSicherungsErinnerung(stand.daten);
        await ladeStand();
      } catch { /* Datei ist geschrieben, nur die Anzeige fehlt */ }
    }
    return ergebnis;
  }).finally(() => {
    exportLaeuft = false;
    setTimeout(() => drehen(false), Math.max(0, DREHEN_MIN_MS - (Date.now() - beginn)));
  });
}

async function fuehreImportAus(pruefung, inhalt, datum, mitKopie) {
  try {
    await db.importiere(pruefung.daten, pruefung.exportiertAm, { mitKopie });
    meldeAenderung();
    await ladeStand();
  } catch {
    await zeigeAlert(F2);
    return;
  }
  zeigeHinweis({ titel: 'Sicherung importiert', text: `${inhalt} vom ${datum}` });
}

async function pruefeUndFrage(datei) {
  let text;
  try {
    text = await datei.text();
  } catch {
    await zeigeAlert(F1);
    return;
  }
  const pruefung = pruefeSicherung(text);
  if (!pruefung) {
    await zeigeAlert(F1);
    return;
  }

  try {
    await ladeStand();
  } catch {
    await zeigeAlert(F2);
    return;
  }

  const datum = datumLang(pruefung.exportiertAm);
  const inhalt = inhaltText(zaehle(pruefung.daten));

  if (istLeer(stand.daten)) {
    const wahl = await zeigeAlert({
      titel: 'Sicherung importieren?',
      text: `Datei vom ${datum} mit ${inhalt}.`,
      knoepfe: [{ id: 'nein', label: 'Abbrechen' }, { id: 'ja', label: 'Importieren', fett: true }]
    });
    if (wahl === 'ja') await fuehreImportAus(pruefung, inhalt, datum, false);
    return;
  }

  for (;;) {
    const aktuell = inhaltText(zaehle(stand.daten));
    let exportVorgang = null;
    const wahl = await zeigeAlert({
      titel: 'Sicherung importieren?',
      text: `Datei vom ${datum} mit ${inhalt}. Sie ersetzt deinen aktuellen Stand mit ${aktuell}. Aktuellen Stand vorher exportieren?`,
      knoepfe: [
        { id: 'export', label: 'Erst exportieren', fett: true, beiTipp: () => { exportVorgang = exportiere(); } },
        { id: 'direkt', label: 'Direkt importieren' },
        { id: 'nein', label: 'Abbrechen' }
      ]
    });

    if (wahl === 'nein') return;
    if (wahl === 'direkt') {
      await fuehreImportAus(pruefung, inhalt, datum, true);
      return;
    }

    if (await exportVorgang === 'fertig') {
      const bestaetigt = await zeigeAlert({
        titel: 'Jetzt importieren?',
        text: `Dein aktueller Stand ist exportiert. Die Datei vom ${datum} mit ${inhalt} ersetzt ihn jetzt.`,
        knoepfe: [{ id: 'nein', label: 'Abbrechen' }, { id: 'ja', label: 'Importieren', fett: true }]
      });
      if (bestaetigt === 'ja') await fuehreImportAus(pruefung, inhalt, datum, true);
      return;
    }
  }
}

async function frageRueckgaengig() {
  const inhalt = inhaltText(zaehle(stand.kopie.daten));
  const wahl = await zeigeAlert({
    titel: 'Import rückgängig machen?',
    text: `Dein Stand vom ${datumZeit(stand.kopie.erstelltAm)} mit ${inhalt} kommt zurück. Was du seit dem Import eingetragen hast, geht verloren.`,
    knoepfe: [{ id: 'nein', label: 'Abbrechen' }, { id: 'ja', label: 'Wiederherstellen', fett: true }]
  });
  if (wahl !== 'ja') return;

  try {
    await db.machImportRueckgaengig();
    meldeAenderung();
    await ladeStand();
  } catch {
    await zeigeAlert(F2);
    return;
  }
  zeigeHinweis({ titel: 'Import rückgängig gemacht', text: `${inhalt} wiederhergestellt` });
}

/** Die Dateiauswahl bleibt ohne `accept`, damit eine falsche Datei wählbar ist und F1 auslöst. */
function dateiFeld() {
  let feld = document.getElementById('import-datei');
  if (feld) return feld;
  feld = h('input', {
    id: 'import-datei', class: 'versteckt', type: 'file', tabindex: '-1', 'aria-hidden': 'true',
    onchange: () => {
      const datei = feld.files[0];
      feld.value = '';
      if (datei) pruefeUndFrage(datei);
    }
  });
  document.body.append(feld);
  return feld;
}

/**
 * Zeigt die Sicherungs-Erinnerung an, wenn diese nötig ist.
 * Wird beim App-Start aufgerufen.
 */
export async function zeigeSicherungsErinnerung() {
  try {
    // Lade die Daten und prüfe, ob eine Erinnerung angezeigt werden sollte
    const stand = await db.leseStand();
    const pruefung = await pruefeSicherungsErinnerung(stand.daten);

    if (!pruefung || !pruefung.sollZeigen) {
      return;
    }

    // Baue den Text der Erinnerung
    let erinnerungsText = '';
    if (pruefung.tagenSeither === -1) {
      erinnerungsText = 'Du hast noch nie Trainingsdaten exportiert. Sichere sie regelmäßig, um Datenverlust zu vermeiden.';
    } else {
      const zeit = pruefung.tagenSeither === 1 ? 'einen Tag' : `${pruefung.tagenSeither} Tagen`;
      erinnerungsText = `Es sind ${pruefung.trainingsNeu} neue Trainings seit deinem letzten Export (vor ${zeit}).`;
    }

    // Zeige das Modal
    const wahl = await zeigeAlert({
      titel: '🔒 Trainingsdaten sichern?',
      text: erinnerungsText,
      knoepfe: [
        { id: 'jetzt', label: 'Jetzt exportieren', fett: true },
        { id: 'spaeter', label: 'In 7 Tagen erinnern' },
        { id: 'nie', label: 'Nicht mehr' }
      ]
    });

    if (wahl === 'jetzt') {
      // Öffne das Sicherungs-Sheet und exportiere
      await oeffneSicherung();
    } else if (wahl === 'spaeter') {
      // Setzt die Erinnerung auf später
      await setzErinnerungSpaeter(stand.daten);
    } else if (wahl === 'nie') {
      // Setzt "Nie mehr"
      await setzErinnerungNieMehr();
    }
  } catch {
    // Fehler beim Prüfen ignorieren, die App lädt trotzdem
  }
}

export const oeffneSicherung = einmalig(async () => {
  try {
    await ladeStand();
  } catch {
    zeigeAlert(F2);
    return;
  }

  const feld = dateiFeld();
  const letzte = h('div', { class: 'val', id: 'letzte-sicherung' });
  const inhalt = h('div', { class: 'val', id: 'inhalt' });
  const rueckgaengigNotiz = h('p', { class: 'foot-mitte' });
  const rueckgaengig = h('div', { class: 'rueckgaengig' },
    h('button', { class: 'btn plain', type: 'button', text: 'Import rückgängig machen', onclick: frageRueckgaengig }),
    rueckgaengigNotiz);

  aktualisiereAnzeige = () => {
    letzte.textContent = letzteSicherungText(stand.letzteSicherung);
    inhalt.textContent = inhaltText(zaehle(stand.daten));
    rueckgaengig.hidden = !stand.kopie;
    if (stand.kopie) {
      rueckgaengigNotiz.textContent = `Stellt den Stand vor dem Import wieder her: ${inhaltText(zaehle(stand.kopie.daten))}, ${datumZeit(stand.kopie.erstelltAm)}.`;
    }
  };

  oeffneSheet({
    klasse: 'mit-boden',
    beiZu: () => { aktualisiereAnzeige = () => {}; },
    baue: (schliessen) => [
      griff(),
      sheetKopf('Sicherung', schliessen),
      h('p', { class: 'hint', text: 'Deine Daten liegen nur auf diesem iPhone. Wird die App gelöscht, sind sie weg – sichere regelmäßig in „Dateien“ / iCloud Drive.' }),
      h('div', { class: 'list plain auf-weiss kein-rand oben-16' },
        h('div', { class: 'row' }, h('div', { class: 'main t', text: 'Letzte Sicherung' }), letzte),
        h('div', { class: 'row' }, h('div', { class: 'main t', text: 'Inhalt' }), inhalt)),
      h('div', { class: 'abstand-16' }),
      h('button', { class: 'btn primary', type: 'button', onclick: exportiere }, icon('i-export'), 'Sicherung exportieren'),
      h('div', { class: 'abstand-8' }),
      h('button', { class: 'btn secondary', type: 'button', onclick: () => feld.click() }, icon('i-import'), 'Sicherung importieren'),
      rueckgaengig
    ]
  });
  aktualisiereAnzeige();
});
