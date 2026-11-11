// Tab Rekorde (#18): Übersicht aller Übungen mit ihren Rekorden.
// Abhängig von #10 (Übungsdetail wird später implementiert).
// #29 Integration: Daten werden bei jedem Tab-Öffnen neu geladen.

import * as db from './db.js';
import { kommaZahl } from './format.js';
import { istCardio, istNurWdh, istZusatz } from './logik.js';
import { rekorde } from './regeln.js';
import { registerTabUpdater } from './tab-events.js';
import { h, icon, oeffneSheet, sheetKopf, griff, einmalig } from './ui.js';
import { oeffneUebungsdetail } from './uebungsdetail.js';

let daten = null;
let aktuellerFilter = 'alle'; // 'alle' oder artId

/**
 * Initialisiert den Rekorde-Tab und registriert den Update-Handler.
 * Die Rekorde-Ansicht wird von baueTabs() als leere Ansicht erstellt
 * und wird hier mit Inhalten gefüllt (mit ID 'rekorde-ansicht').
 */
export function initRekorde() {
  const ansicht = document.getElementById('rekorde-ansicht');
  if (!ansicht) {
    console.error('Rekorde-Ansicht Element nicht gefunden');
    return;
  }

  // Fülle die Ansicht mit Kopf und Inhalts-Container
  const rekordeInhalt = h('div', { class: 'list', id: 'rekorde-liste' });
  const kopf = h('div', { class: 'rekorde-kopf' },
    h('div', { class: 'title-row' },
      h('h1', { class: 'largetitle', text: 'Rekorde' })),
    h('div', { class: 'search-wrapper' },
      h('input', {
        type: 'search',
        class: 'search',
        placeholder: 'Übung suchen',
        id: 'rekorde-suche',
        oninput: (e) => {
          aktualisiereFilter(e.target.value);
          zeigeRekorde(ansicht, rekordeInhalt);
        }
      })),
    h('div', { class: 'filter-chips', id: 'filter-chips' }));

  ansicht.replaceChildren(kopf, rekordeInhalt, h('div', { class: 'abstand-16' }));

  // Update-Handler: wird aufgerufen bei Tab-Aktivierung oder Datenänderung
  const updateHandler = einmalig(async () => {
    daten = await db.leseDaten();
    baueFilter(ansicht);
    zeigeRekorde(ansicht, rekordeInhalt);
  });

  // Registriere als Tab-Updater
  registerTabUpdater('rekorde', updateHandler);
}

/**
 * Aktualisiert den Filter basierend auf der Suchbox.
 */
function aktualisiereFilter(suchText) {
  // Der Filter wird sofort in zeigeRekorde() angewendet
  // Diese Funktion wird nur aufgerufen, wenn sich der Such-Input ändert
}

/**
 * Baut die Filter-Chips (Trainingsarten) auf.
 */
function baueFilter(ansicht) {
  const filterChips = ansicht.querySelector('#filter-chips');
  if (!filterChips || !daten) return;

  const arten = [...daten.trainingsarten].sort((a, b) => a.reihenfolge - b.reihenfolge);
  const chips = [
    h('button', {
      class: `chip ${aktuellerFilter === 'alle' ? 'on' : ''}`,
      type: 'button',
      text: 'Alle',
      onclick: () => {
        aktuellerFilter = 'alle';
        baueFilter(ansicht);
        zeigeRekorde(ansicht, ansicht.querySelector('#rekorde-liste'));
      }
    }),
    ...arten.map((art) =>
      h('button', {
        class: `chip ${aktuellerFilter === art.id ? 'on' : ''}`,
        type: 'button',
        text: art.name,
        onclick: () => {
          aktuellerFilter = art.id;
          baueFilter(ansicht);
          zeigeRekorde(ansicht, ansicht.querySelector('#rekorde-liste'));
        }
      }))
  ];

  filterChips.replaceChildren(...chips);
}

/**
 * Zeigt die Rekorde-Liste mit Filtern und Körpergewicht-Zeile an.
 */
function zeigeRekorde(ansicht, rekordeInhalt) {
  if (!daten) return;

  const rekordListe = [];

  // Gruppiere Übungen nach Trainingsarten
  const artenMap = new Map();
  for (const uebung of daten.uebungen) {
    const artIds = uebung.artIds || [];
    for (const artId of artIds) {
      if (!artenMap.has(artId)) artenMap.set(artId, []);
      artenMap.get(artId).push(uebung);
    }
  }

  const arten = [...daten.trainingsarten].sort((a, b) => a.reihenfolge - b.reihenfolge);
  const suchText = (ansicht.querySelector('#rekorde-suche')?.value || '').toLowerCase();

  for (const art of arten) {
    // Filtere nach ausgewählter Trainingsart
    if (aktuellerFilter !== 'alle' && aktuellerFilter !== art.id) continue;

    const uebungenDerArt = artenMap.get(art.id) || [];
    const gefiltert = uebungenDerArt.filter((u) =>
      suchText === '' || u.name.toLowerCase().includes(suchText)
    );

    if (gefiltert.length === 0) continue;

    // Gruppiere nach Trainingsart mit Section-Header (nur wenn nicht gefiltert)
    if (aktuellerFilter === 'alle') {
      rekordListe.push(h('div', { class: 'section-h', text: art.name }));
    }

    for (const uebung of gefiltert.sort((a, b) => a.name.localeCompare(b.name, 'de'))) {
      const eintraege = [...daten.saetze, ...daten.cardio].filter((e) => e.uebungId === uebung.id);
      const rek = rekorde(uebung, eintraege);

      // Rendere die Rekord-Zeile je nach Übungstyp
      const zeile = baueRekordeZeile(uebung, rek);
      if (zeile) rekordListe.push(zeile);
    }
  }

  // Körpergewicht-Zeile unten
  const koerpergewichtZeile = baueKoerpergewichtZeile();
  if (koerpergewichtZeile) {
    rekordListe.push(h('div', { class: 'spacer-16' }));
    rekordListe.push(koerpergewichtZeile);
  }

  rekordeInhalt.replaceChildren(...rekordListe);
}

/**
 * Baut eine Rekord-Zeile für eine Übung.
 */
function baueRekordeZeile(uebung, rek) {
  let texte = [];

  if (rek.art === 'cardio') {
    // Cardio: Dauer und optional Strecke
    if (rek.laengsteDauer !== null) {
      texte.push(`${kommaZahl(rek.laengsteDauer)} min`);
    }
    if (rek.laengsteStrecke !== null) {
      texte.push(`${kommaZahl(rek.laengsteStrecke)} km`);
    }
    if (texte.length === 0) {
      texte.push('–');
    }
  } else if (rek.art === 'wdh') {
    // Nur Wdh.
    if (rek.meisteWdh !== null) {
      texte.push(`${rek.meisteWdh} Wdh.`);
    } else {
      texte.push('–');
    }
  } else if (rek.art === 'zeit') {
    texte.push(rek.laengsteZeit !== null ? `${rek.laengsteZeit} s` : '–');
  } else if (rek.art === 'zusatz') {
    // Körpergewicht mit Zusatz: zwei Rekorde
    if (rek.schwerstesZusatz) {
      texte.push(`+${kommaZahl(rek.schwerstesZusatz.gewicht)} kg (${rek.schwerstesZusatz.wdh} Wdh.)`);
    }
    if (rek.meisteWdhOhne !== null) {
      texte.push(`${rek.meisteWdhOhne} ohne Zusatz`);
    }
    if (texte.length === 0) {
      texte.push('–');
    }
  } else if (rek.art === 'gewicht') {
    // Kraft: Gewicht und 1RM
    if (rek.schwerstes) {
      texte.push(`${kommaZahl(rek.schwerstes.gewicht)} kg (${rek.schwerstes.wdh} Wdh.)`);
    }
    if (rek.einerMax) {
      const label = rek.einerMax.belegt ? 'belegt' : 'geschätzt';
      texte.push(`1RM ${kommaZahl(rek.einerMax.wert)} kg (${label})`);
    }
    if (texte.length === 0) {
      texte.push('–');
    }
  }

  const zeile = h('button', {
    class: 'row',
    type: 'button',
    onclick: () => oeffneUebungsdetail(daten, uebung)
  },
    h('div', { class: 'main' },
      h('div', { class: 't', text: uebung.name }),
      h('div', { class: 'st', text: texte.join(' · ') })),
    h('span', { class: 'weiter' }, icon('i-chev', 's16 chev')));

  return zeile;
}

/**
 * Baut die Körpergewicht-Zeile mit Edit-Funktionalität.
 */
function baueKoerpergewichtZeile() {
  const kgEntry = (daten.koerpergewicht || [])[0];
  const kg = kgEntry?.kg || null;

  const zeile = h('button', {
    class: 'row',
    type: 'button',
    onclick: () => oeffneKoerpergewichtEdit(kg)
  },
    h('div', { class: 'main' },
      h('div', { class: 't', text: 'Körpergewicht' }),
      h('div', { class: 'val', text: kg !== null ? `${kommaZahl(kg)} kg` : '–' })),
    h('span', { class: 'weiter' }, icon('i-chev', 's16 chev')));

  return zeile;
}

/**
 * Öffnet die Körpergewicht-Edit-Sheet.
 */
function oeffneKoerpergewichtEdit(aktuellesKg) {
  const { schliessen } = oeffneSheet({
    klasse: 'kg-sheet',
    fokusBleibt: true,
    baue: (zu) => [
      griff(),
      sheetKopf('Körpergewicht', zu),
      h('div', { class: 'sheet-content' },
        h('div', { class: 'sheet-item' },
          h('label', { text: 'Gewicht (kg)' }),
          h('input', {
            id: 'kg-eingabe',
            type: 'number',
            step: '0.1',
            min: '0',
            value: aktuellesKg ? kommaZahl(aktuellesKg) : '',
            placeholder: 'z.B. 78,5',
            onchange: async (e) => {
              const eingabe = e.target;
              if (eingabe && eingabe.value.trim()) {
                const newKg = parseFloat(eingabe.value.replace(',', '.'));
                if (!isNaN(newKg) && newKg > 0) {
                  try {
                    await db.speichereKoerpergewicht(newKg);
                    // Event triggern, damit sich die Rekorde-Ansicht aktualisiert
                    window.dispatchEvent(new Event('gym-daten-geaendert'));
                    schliessen();
                  } catch (err) {
                    console.error('Fehler beim Speichern des Körpergewichts:', err);
                  }
                }
              }
            }
          })))
    ]
  });
}
