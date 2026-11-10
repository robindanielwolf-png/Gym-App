import { tageText } from './format.js';
import { h, icon, kachel, leerHinweis } from './ui.js';
import { oeffneSicherung } from './sicherung-sheet.js';

const TABS = [
  { id: 'training', label: 'Training', iconName: 'i-dumbbell' },
  { id: 'verlauf', label: 'Verlauf', iconName: 'i-calendar' },
  { id: 'rekorde', label: 'Rekorde', iconName: 'i-trophy' }
];

const artenListe = h('div', { class: 'list', id: 'arten-liste' });

function ansichtTraining() {
  return h('div', { class: 'view' },
    h('div', { class: 'title-row' },
      h('h1', { class: 'largetitle', text: 'Training' }),
      h('button', { class: 'glass', id: 'glas-knopf', type: 'button', 'aria-label': 'Sicherung', onclick: oeffneSicherung },
        icon('i-sync', 's24'))),
    h('div', { class: 'section-h oben-8', text: 'Trainingsart wählen' }),
    artenListe,
    h('div', { class: 'abstand-16' }));
}

/** Screen 01: alle Arten mit „zuletzt“. Zeile antippen = Check-in. */
export function setzeArten(arten, zuletzt, beiTipp) {
  artenListe.replaceChildren(...arten.map((a) =>
    h('button', { class: 'row', type: 'button', 'data-art': a.id, onclick: () => beiTipp(a) },
      kachel(a.icon),
      h('div', { class: 'main t', text: a.name }),
      h('div', { class: 'val', text: tageText(zuletzt.get(a.id) || null) }),
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
