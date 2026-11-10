import { h, icon, kachel, leerHinweis } from './ui.js';
import { oeffneUebungen } from './uebungen.js';
import { oeffneSicherung } from './sicherung-sheet.js';

const TABS = [
  { id: 'training', label: 'Training', iconName: 'i-dumbbell' },
  { id: 'verlauf', label: 'Verlauf', iconName: 'i-calendar' },
  { id: 'rekorde', label: 'Rekorde', iconName: 'i-trophy' }
];

function ansichtTraining() {
  return h('div', { class: 'view' },
    h('div', { class: 'title-row' },
      h('h1', { class: 'largetitle', text: 'Training' }),
      h('button', { class: 'glass', id: 'glas-knopf', type: 'button', 'aria-label': 'Sicherung', onclick: oeffneSicherung },
        icon('i-sync', 's24'))),
    h('div', { class: 'list' },
      h('button', { class: 'row', type: 'button', onclick: oeffneUebungen },
        kachel('i-dumbbell'),
        h('div', { class: 'main t', text: 'Übungen' }),
        icon('i-chev', 's16 chev'))),
    h('div', { class: 'abstand-32' }),
    leerHinweis({
      iconName: 'i-dumbbell',
      headline: 'Hier startest du bald dein Training',
      subhead: 'Bis dahin kannst du Übungen ansehen, eigene anlegen und deine Daten sichern.'
    }));
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
