import { tageText } from './format.js';
import { h, icon, kachel, leerHinweis } from './ui.js';

// 0.5.0: Statistik und Rekorde liegen jetzt unter „Mehr“ (mehr.js).
const TABS = [
  { id: 'start', label: 'Start', iconName: 'i-person' },
  { id: 'training', label: 'Training', iconName: 'i-dumbbell' },
  { id: 'verlauf', label: 'Verlauf', iconName: 'i-calendar' },
  { id: 'mehr', label: 'Mehr', iconName: 'i-more' }
];

const artenListe = h('div', { class: 'list', id: 'arten-liste' });
const fortsetzen = h('div', { class: 'list resume', id: 'fortsetzen', hidden: true });
const naechsteKarte = h('div', { class: 'next', id: 'als-naechstes', hidden: true });
const artenTitel = h('div', { class: 'section-h oben-16', text: 'Trainingsart wählen' });
// 0.6.0 (#39): Zeile „Trainingsplan“ zwischen „Training fortführen“ und der Karte. Nur ohne laufendes Training.
const planListe = h('div', { class: 'list plain plan-liste', id: 'plan-zeile', hidden: true });

// Callbacks pro Tab-ID: beim Öffnen (nach jedem Antippen des Tabs) und beim Verlassen.
const tabAktivierungsCallbacks = new Map();
const tabVerlassenCallbacks = new Map();

function ansichtTraining() {
  return h('div', { class: 'view' },
    h('div', { class: 'title-row' },
      h('h1', { class: 'largetitle', text: 'Training' })),
    fortsetzen,
    planListe,
    naechsteKarte,
    artenTitel,
    artenListe,
    h('div', { class: 'abstand-16' }));
}

/**
 * Screen 01/01c/01d: Karte „Als Nächstes dran“ (nur ohne laufendes Training und mit Vorschlag),
 * alle Arten mit „zuletzt“ bzw. „läuft“. Zeile antippen öffnet die Vorschau.
 * laufend: null oder { art, nebentext, beiFortsetzen } für die Zeile „<Art> läuft“.
 * naechste: null oder { art, nebentext, beiTipp } für die Karte. nebentext: fertiger Text
 *   („zuletzt vor 2 Tagen“ bzw. mit Plan „… · Tag 2 von 3“). Die Karte ist eine fokussierbare Fläche.
 * fortfuehren (0.5.3, #36): null oder { art, minuten, beiTipp } für die Zeile „Training fortführen“
 *   an derselben Stelle; nur ohne laufendes Training.
 */
export function setzeArten(arten, zuletzt, beiTipp, laufend = null, naechste = null, fortfuehren = null) {
  if (laufend) fortfuehren = null;
  fortsetzen.hidden = !laufend && !fortfuehren;
  naechsteKarte.hidden = !naechste;
  artenTitel.textContent = naechste ? 'Oder Trainingsart wählen' : 'Trainingsart wählen';
  artenTitel.classList.toggle('oben-16', !laufend && !fortfuehren && !naechste);
  if (naechste) {
    naechsteKarte.onclick = naechste.beiTipp;
    naechsteKarte.onkeydown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); naechste.beiTipp(); }
    };
    naechsteKarte.setAttribute('role', 'button');
    naechsteKarte.setAttribute('tabindex', '0');
    naechsteKarte.replaceChildren(
      h('div', { class: 'k', text: 'Als Nächstes dran' }),
      h('div', { class: 'h' },
        h('div', { class: 'ico' }, icon(naechste.art.icon)),
        h('div', { class: 'next-text' },
          h('b', { text: naechste.art.name }),
          h('span', { text: naechste.nebentext }))),
      h('span', { class: 'btn primary', text: 'Training ansehen' }));
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
  } else if (fortfuehren) {
    const vor = fortfuehren.minuten < 1 ? 'beendet gerade eben' : `beendet vor ${fortfuehren.minuten} Min.`;
    fortsetzen.replaceChildren(h('button', { class: 'row fortfuehren', type: 'button', onclick: fortfuehren.beiTipp },
      kachel(fortfuehren.art.icon),
      h('div', { class: 'main' },
        h('div', { class: 't fett', text: 'Training fortführen' }),
        h('div', { class: 'st', text: `${fortfuehren.art.name} · ${vor}` })),
      icon('i-chev', 's16 chev')));
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
 * Registriert einen Callback, der aufgerufen wird, wenn ein Tab geöffnet oder erneut angetippt wird.
 * Der Callback bekommt { nochmal: true }, wenn der Tab schon offen war.
 */
export function registerTabActivation(tabId, callback) {
  if (!tabAktivierungsCallbacks.has(tabId)) {
    tabAktivierungsCallbacks.set(tabId, []);
  }
  tabAktivierungsCallbacks.get(tabId).push(callback);
}

/**
 * 0.6.0 (#39): Zeile „Trainingsplan“. zeile = null (ausgeblendet, z. B. laufendes Training) oder
 * { wert, beiTipp }. Der Wert steht rechts, das Label links (iOS-Einstellungsmuster).
 */
export function setzePlanZeile(zeile) {
  planListe.hidden = !zeile;
  if (!zeile) {
    planListe.replaceChildren();
    return;
  }
  planListe.replaceChildren(h('button', {
    class: 'row plan-zeile-row', type: 'button', 'aria-haspopup': 'dialog', onclick: zeile.beiTipp
  },
  h('div', { class: 'main t', text: 'Trainingsplan' }),
  h('span', { class: 'val plan-wert', text: zeile.wert }),
  icon('i-chev', 's16 chev')));
}

/** Fokus zurück auf die Zeile „Trainingsplan“ (nach dem Auswahl-Sheet). */
export function fokusiereTrainingsplan() {
  planListe.querySelector('button')?.focus({ preventScroll: true });
}

/** Callback, wenn der Tab verlassen wird (z. B. um die 3D-Figur freizugeben). */
export function registerTabVerlassen(tabId, callback) {
  if (!tabVerlassenCallbacks.has(tabId)) {
    tabVerlassenCallbacks.set(tabId, []);
  }
  tabVerlassenCallbacks.get(tabId).push(callback);
}

function rufeAuf(liste, arg) {
  for (const cb of liste || []) {
    try {
      cb(arg);
    } catch (e) {
      console.error('Tab-Callback fehlgeschlagen:', e);
    }
  }
}

let tabZeigen = null;
let aktuellerTabId = null;

/** Id des offenen Tabs ('start' | 'training' | 'verlauf' | 'mehr'). */
export const aktuellerTab = () => aktuellerTabId;

/** Öffnet einen Tab wie per Antippen (z. B. beim App-Start mit laufendem Training). */
export function zeigeTab(id) {
  if (tabZeigen && aktuellerTabId !== id) tabZeigen(id);
}

export function baueTabs(wurzel) {
  const ansichten = {
    start: h('div', { class: 'view start-view', hidden: true, id: 'start-ansicht' }),
    training: ansichtTraining(),
    verlauf: h('div', { class: 'view verlauf-view', hidden: true, id: 'verlauf-ansicht' }),
    // Rahmen für die Unterseiten von Mehr (Liste, Statistik, Rekorde, Quellen); füllt mehr.js.
    mehr: h('div', { class: 'mehr-rahmen', hidden: true, id: 'mehr-ansicht' })
  };

  const knoepfe = {};
  let aktuell = null;
  const zeige = (id, nochmal = false) => {
    if (aktuell && aktuell !== id) rufeAuf(tabVerlassenCallbacks.get(aktuell));
    aktuell = id;
    aktuellerTabId = id;
    for (const t of TABS) {
      ansichten[t.id].hidden = t.id !== id;
      knoepfe[t.id].classList.toggle('on', t.id === id);
      if (t.id === id) knoepfe[t.id].setAttribute('aria-current', 'page');
      else knoepfe[t.id].removeAttribute('aria-current');
    }
    rufeAuf(tabAktivierungsCallbacks.get(id), { nochmal });
  };

  for (const t of TABS) {
    knoepfe[t.id] = h('button', { class: 'tab', type: 'button', onclick: () => zeige(t.id, aktuell === t.id) },
      icon(t.iconName), h('span', { text: t.label }));
  }

  wurzel.append(...Object.values(ansichten), h('nav', { class: 'tabbar' }, Object.values(knoepfe)));
  tabZeigen = (id) => zeige(id);
  zeige('start');
}
