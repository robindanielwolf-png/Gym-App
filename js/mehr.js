// Tab „Mehr“ (Backlog #16, Design Screen 13): Liste mit Statistik, Rekorde (#33) und Quellen (Screen 14).
// Jede Unterseite hat oben links „‹ Mehr“; die Tab-Leiste bleibt sichtbar. Beim Öffnen lädt jede
// Unterseite den aktuellen Stand. Erneutes Antippen von „Mehr“ springt zur Liste.
import { h, icon, kachel } from './ui.js';
import { registerTabActivation } from './tabs.js';
import { initStatistik } from './statistik.js';
import { initRekorde } from './rekorde.js';

const UNTERSEITEN = [
  { id: 'statistik', label: 'Statistik', iconName: 'i-chart' },
  { id: 'rekorde', label: 'Rekorde', iconName: 'i-trophy' },
  { id: 'quellen', label: 'Quellen', iconName: 'i-doc' }
];

const LIZENZ_LINK = 'https://creativecommons.org/licenses/by-sa/4.0/';

const QUELLE_3D = '3D-Anatomie: Z-Anatomy (CC BY-SA 4.0), basierend auf BodyParts3D © The Database Center for Life Science; Datenaufbereitung: Svitylo 3D Anatomy Atlas. Für Gym-Tracker ausgewählt, zusammengefasst und vereinfacht; diese Modelldatei steht ebenfalls unter CC BY-SA 4.0.';

function navigation(zurueck) {
  return h('div', { class: 'navbar' },
    h('button', { class: 'link zurueck', type: 'button', onclick: zurueck },
      icon('i-back', 's24'),
      h('span', { text: 'Mehr' })));
}

function listeAnsicht(zeige) {
  return h('div', { class: 'view', id: 'mehr-liste' },
    h('div', { class: 'title-row' }, h('h1', { class: 'largetitle', text: 'Mehr' })),
    h('div', { class: 'list oben-12' }, UNTERSEITEN.map((u) =>
      h('button', { class: 'row', type: 'button', onclick: () => zeige(u.id) },
        kachel(u.iconName),
        h('div', { class: 'main t', text: u.label }),
        icon('i-chev', 's16 chev')))),
    h('div', { class: 'abstand-16' }));
}

function quellenInhalt() {
  return h('div', {},
    h('div', { class: 'title-row' }, h('h1', { class: 'largetitle', text: 'Quellen' })),
    h('div', { class: 'section-h', text: '3D-Muskelfigur' }),
    h('div', { class: 'list plain' },
      h('div', { class: 'row quelle-zeile' }, h('p', { class: 'quelle-text', text: QUELLE_3D })),
      h('a', { class: 'row', href: LIZENZ_LINK, target: '_blank', rel: 'noopener' },
        h('div', { class: 'main t quelle-link', text: 'Lizenz CC BY-SA 4.0' }),
        icon('i-chev', 's16 chev'))),
    h('div', { class: 'section-h', text: 'Muskelfigur (2D)' }),
    h('div', { class: 'list plain' },
      h('div', { class: 'row quelle-zeile' },
        h('p', { class: 'quelle-text', text: 'react-muscle-highlighter 1.2.0 · MIT-Lizenz' }))),
    h('div', { class: 'section-h', text: 'Software und Icons' }),
    h('div', { class: 'list plain' },
      h('div', { class: 'row' },
        h('div', { class: 'main' },
          h('div', { class: 't', text: 'three.js' }),
          h('div', { class: 'st', text: '3D-Darstellung · MIT' }))),
      h('div', { class: 'row' },
        h('div', { class: 'main' },
          h('div', { class: 't', text: 'Lucide' }),
          h('div', { class: 'st', text: 'Icons · ISC' })))),
    h('div', { class: 'abstand-unten' }));
}

/**
 * Baut die Unterseiten von Mehr in den Rahmen (#mehr-ansicht, von tabs.js angelegt) und
 * verbindet sie mit dem Tab. Statistik und Rekorde laden beim Öffnen die Daten neu.
 */
export function initMehr() {
  const rahmen = document.getElementById('mehr-ansicht');
  const ansichten = new Map();
  const slots = {};
  let aktuelle = 'liste';

  const zeige = (id) => {
    aktuelle = id;
    for (const [schluessel, ansicht] of ansichten) ansicht.hidden = schluessel !== id;
    if (id !== 'liste') aktualisierer[id]?.();
  };

  for (const u of UNTERSEITEN) {
    slots[u.id] = h('div');
    ansichten.set(u.id, h('div', { class: 'view', hidden: true, id: `${u.id}-ansicht` },
      navigation(() => zeige('liste')),
      slots[u.id]));
  }
  ansichten.set('liste', listeAnsicht(zeige));
  ansichten.get('liste').hidden = false;

  slots.quellen.replaceChildren(quellenInhalt());
  const aktualisierer = {
    statistik: initStatistik(slots.statistik),
    rekorde: initRekorde(slots.rekorde)
  };
  rahmen.replaceChildren(...ansichten.values());

  // Tab „Mehr“ öffnen: zuletzt offene Unterseite. Nochmal antippen: zurück zur Liste.
  registerTabActivation('mehr', ({ nochmal } = {}) => {
    if (nochmal) zeige('liste');
    else zeige(aktuelle);
  });
  // Datenänderungen (z. B. Körpergewicht geändert) auch dann, wenn die Unterseite offen ist.
  window.addEventListener('gym-daten-geaendert', () => {
    if (aktuelle !== 'liste') aktualisierer[aktuelle]?.();
  });
}
