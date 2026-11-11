import { tageText } from './format.js';
import { h, icon, kachel, leerHinweis } from './ui.js';
import { oeffneSicherung } from './sicherung-sheet.js';
import { baueSatistikView } from './statistik.js';

const TABS = [
  { id: 'training', label: 'Training', iconName: 'i-dumbbell' },
  { id: 'verlauf', label: 'Verlauf', iconName: 'i-calendar' },
  { id: 'statistik', label: 'Statistik', iconName: 'i-trophy' },
  { id: 'rekorde', label: 'Rekorde', iconName: 'i-trophy' }
];

const artenListe = h('div', { class: 'list', id: 'arten-liste' });
const fortsetzen = h('div', { class: 'list resume', id: 'fortsetzen', hidden: true });
const naechsteKarte = h('div', { class: 'next', id: 'als-naechstes', hidden: true });
const artenTitel = h('div', { class: 'section-h oben-16', text: 'Trainingsart wählen' });

// Callbacks pro Tab-ID, die aufgerufen werden, wenn der Tab aktiviert wird (Aktualisierung beim Öffnen)
const tabAktivierungsCallbacks = new Map();

function ansichtTraining() {
  return h('div', { class: 'view' },
    h('div', { class: 'title-row' },
      h('h1', { class: 'largetitle', text: 'Training' }),
      h('button', { class: 'glass', id: 'glas-knopf', type: 'button', 'aria-label': 'Sicherung', onclick: oeffneSicherung },
        icon('i-sync', 's24'))),
    fortsetzen,
    naechsteKarte,
    artenTitel,
    artenListe,
    h('div', { class: 'abstand-16' }));
}

/**
 * Screen 01/01c/01d: Karte „Als Nächstes dran“ (nur ohne laufendes Training und mit Vorschlag),
 * alle Arten mit „zuletzt“ bzw. „läuft“. Zeile antippen öffnet die Vorschau.
 * laufend: null oder { art, nebentext, beiFortsetzen } für die Zeile „<Art> läuft“.
 * naechste: null oder { art, zuletzt, beiTipp } für die Karte.
 */
export function setzeArten(arten, zuletzt, beiTipp, laufend = null, naechste = null) {
  fortsetzen.hidden = !laufend;
  naechsteKarte.hidden = !naechste;
  artenTitel.textContent = naechste ? 'Oder Trainingsart wählen' : 'Trainingsart wählen';
  artenTitel.classList.toggle('oben-16', !laufend && !naechste);
  if (naechste) {
    const tage = tageText(naechste.zuletzt);
    naechsteKarte.onclick = naechste.beiTipp;
    naechsteKarte.replaceChildren(
      h('div', { class: 'k', text: 'Als Nächstes dran' }),
      h('div', { class: 'h' },
        h('div', { class: 'ico' }, icon(naechste.art.icon)),
        h('div', { class: 'next-text' },
          h('b', { text: naechste.art.name }),
          h('span', { text: `zuletzt ${tage}` }))),
      h('button', { class: 'btn primary', type: 'button', text: 'Training ansehen' }));
  } else {
    naechsteKarte.replaceChildren();
  }
  if (laufend) {
    fortsetzen.replaceChildren(h('button', { class: 'row', type: 'button', onclick: laufend.beiFortsetzen },
      kachel(laufend.art.icon),
      h('div', { class: 'main' },
        h('div', { class: 't fett', text: `${laufend.art.name} läuft` }),
        h('div', { class: 'st mit-punkt' }, h('span', { class: 'dot' }), laufend.nebentext)),
      h('span', { class: 'weiter' }, 'Fortsetzen', icon('i-chev', 's16'))));
  }
  artenListe.replaceChildren(...arten.map((a) =>
    h('button', { class: 'row', type: 'button', 'data-art': a.id, onclick: () => beiTipp(a) },
      kachel(a.icon),
      h('div', { class: 'main t', text: a.name }),
      h('div', { class: 'val', text: laufend?.art.id === a.id ? 'läuft' : tageText(zuletzt.get(a.id) || null) }),
      icon('i-chev', 's16 chev'))));
}

function ansichtLeer(titel, hinweis) {
  return h('div', { class: 'view view-mitte' },
    h('h1', { class: 'largetitle titel-unter-nav', text: titel }),
    h('div', { class: 'empty-wrap' }, leerHinweis(hinweis)));
}

/**
 * Statistik-View: Sätze pro Muskelgruppe der letzten 7 Tage.
 * Der Inhalt wird bei Tab-Aktivierung aktualisiert.
 */
function ansichtStatistik() {
  const statistikContainer = h('div', { class: 'view', id: 'statistik-view' },
    h('div', { class: 'title-row' },
      h('h1', { class: 'largetitle', text: 'Statistik' })),
    h('div', { id: 'statistik-inhalt' }, leerHinweis({
      iconName: 'i-sync',
      headline: 'Lädt...',
      subhead: 'Trainings-Statistik wird berechnet.'
    })));
  return statistikContainer;
}

/**
 * Registriert einen Callback, der aufgerufen wird, wenn ein Tab aktiviert wird.
 * Das ermöglicht es, dass Verlauf/Rekorde sofort den aktuellen Stand zeigen.
 * tabId: 'verlauf' oder 'rekorde'
 */
export function registerTabActivation(tabId, callback) {
  if (!tabAktivierungsCallbacks.has(tabId)) {
    tabAktivierungsCallbacks.set(tabId, []);
  }
  tabAktivierungsCallbacks.get(tabId).push(callback);
}

export function baueTabs(wurzel, datenCallback = null) {
  // State für Statistik-Zeitraum
  let aktuellerZeitraum = 'woche';

  const ansichten = {
    training: ansichtTraining(),
    verlauf: ansichtLeer('Verlauf', {
      iconName: 'i-calendar',
      headline: 'Kommt bald',
      subhead: 'Kommt in einer der nächsten Versionen – deine Trainings sind gespeichert.'
    }),
    statistik: ansichtStatistik(),
    rekorde: ansichtLeer('Rekorde', {
      iconName: 'i-trophy',
      headline: 'Kommt bald',
      subhead: 'Kommt in einer der nächsten Versionen – deine Trainings sind gespeichert.'
    })
  };

  // Funktion zum Aktualisieren der Statistik-View
  const aktualisiereStatistik = () => {
    const daten = datenCallback?.();
    if (daten) {
      const inhalt = document.getElementById('statistik-inhalt');
      if (inhalt) {
        inhalt.replaceChildren(baueSatistikView(daten, aktuellerZeitraum, (neuZeitraum) => {
          aktuellerZeitraum = neuZeitraum;
          aktualisiereStatistik();
        }));
      }
    }
  };

  // Registriere Statistik-Aktualisierungs-Callback
  if (datenCallback) {
    registerTabActivation('statistik', aktualisiereStatistik);
  }

  const knoepfe = {};
  const zeige = (id) => {
    for (const t of TABS) {
      ansichten[t.id].hidden = t.id !== id;
      knoepfe[t.id].classList.toggle('on', t.id === id);
      if (t.id === id) knoepfe[t.id].setAttribute('aria-current', 'page');
      else knoepfe[t.id].removeAttribute('aria-current');
    }
    // Triggere Tab-Aktivierungs-Callbacks für aktuelle Datenaktualisierung
    const callbacks = tabAktivierungsCallbacks.get(id);
    if (callbacks) {
      for (const cb of callbacks) {
        try {
          cb();
        } catch (e) {
          console.error(`Tab-Aktivierungs-Callback für '${id}' fehlgeschlagen:`, e);
        }
      }
    }
  };

  for (const t of TABS) {
    knoepfe[t.id] = h('button', { class: 'tab', type: 'button', onclick: () => zeige(t.id) },
      icon(t.iconName), h('span', { text: t.label }));
  }

  wurzel.append(...Object.values(ansichten), h('nav', { class: 'tabbar' }, Object.values(knoepfe)));
  zeige('training');
}
