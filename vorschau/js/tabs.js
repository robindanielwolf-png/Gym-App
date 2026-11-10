import { tageText } from './format.js';
import { h, icon, kachel, leerHinweis } from './ui.js';
import { oeffneSicherung } from './sicherung-sheet.js';

const TABS = [
  { id: 'training', label: 'Training', iconName: 'i-dumbbell' },
  { id: 'verlauf', label: 'Verlauf', iconName: 'i-calendar' },
  { id: 'rekorde', label: 'Rekorde', iconName: 'i-trophy' }
];

const artenListe = h('div', { class: 'list', id: 'arten-liste' });
const fortsetzen = h('div', { class: 'list resume', id: 'fortsetzen', hidden: true });
const artenTitel = h('div', { class: 'section-h oben-8', text: 'Trainingsart wählen' });

function ansichtTraining() {
  return h('div', { class: 'view' },
    h('div', { class: 'title-row' },
      h('h1', { class: 'largetitle', text: 'Training' }),
      h('button', { class: 'glass', id: 'glas-knopf', type: 'button', 'aria-label': 'Sicherung', onclick: oeffneSicherung },
        icon('i-sync', 's24'))),
    fortsetzen,
    artenTitel,
    artenListe,
    h('div', { class: 'abstand-16' }));
}

/**
 * Screen 01/01c: alle Arten mit „zuletzt“ bzw. „läuft“. Zeile antippen öffnet die Vorschau.
 * laufend: null oder { art, nebentext, beiFortsetzen } für die Zeile „<Art> läuft“.
 */
export function setzeArten(arten, zuletzt, beiTipp, laufend = null) {
  fortsetzen.hidden = !laufend;
  artenTitel.classList.toggle('oben-8', !laufend);
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

export function baueTabs(wurzel) {
  const ansichten = {
    training: ansichtTraining(),
    verlauf: ansichtLeer('Verlauf', {
      iconName: 'i-calendar',
      headline: 'Noch keine Trainings',
      subhead: 'Nach deinem ersten Training siehst du es hier im Kalender.'
    }),
    rekorde: ansichtLeer('Rekorde', {
      iconName: 'i-trophy',
      headline: 'Noch keine Rekorde',
      subhead: 'Sobald du Sätze eingetragen hast, stehen deine Rekorde hier.'
    })
  };

  const knoepfe = {};
  const zeige = (id) => {
    for (const t of TABS) {
      ansichten[t.id].hidden = t.id !== id;
      knoepfe[t.id].classList.toggle('on', t.id === id);
      if (t.id === id) knoepfe[t.id].setAttribute('aria-current', 'page');
      else knoepfe[t.id].removeAttribute('aria-current');
    }
  };

  for (const t of TABS) {
    knoepfe[t.id] = h('button', { class: 'tab', type: 'button', onclick: () => zeige(t.id) },
      icon(t.iconName), h('span', { text: t.label }));
  }

  wurzel.append(...Object.values(ansichten), h('nav', { class: 'tabbar' }, Object.values(knoepfe)));
  zeige('training');
}
