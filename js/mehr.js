// Tab „Mehr“ (Backlog #16, Design Screen 13): Liste mit Statistik, Rekorde (#33), Fehlerprotokoll (0.5.2)
// und Quellen (Screen 14).
// Jede Unterseite hat oben links „‹ Mehr“; die Tab-Leiste bleibt sichtbar. Beim Öffnen lädt jede
// Unterseite den aktuellen Stand. Erneutes Antippen von „Mehr“ springt zur Liste.
import { h, icon, kachel, leerHinweis, zeigeAlert } from './ui.js';
import { registerTabUpdater } from './tab-events.js';
import { leereProtokoll, leseProtokoll } from './fehlerprotokoll.js';
import { initStatistik } from './statistik.js';
import { initRekorde } from './rekorde.js';

const UNTERSEITEN = [
  { id: 'statistik', label: 'Statistik', iconName: 'i-chart' },
  { id: 'rekorde', label: 'Rekorde', iconName: 'i-trophy' },
  { id: 'fehlerprotokoll', label: 'Fehlerprotokoll', iconName: 'i-alert' },
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

const zwei = (n) => String(n).padStart(2, '0');
/** 15.11. 19:42 */
const zeitText = (iso) => {
  const d = new Date(iso);
  return `${zwei(d.getDate())}.${zwei(d.getMonth() + 1)}. ${zwei(d.getHours())}:${zwei(d.getMinutes())}`;
};

const NICHT_ERLAUBT_TEXT = 'iOS kann die Daten nach längerer Nichtnutzung löschen. Öffne Gym-Tracker vom Home-Bildschirm und sichere regelmäßig.';

/** V3: Ob iOS dauerhaften Speicher erlaubt hat: true, false oder null (nicht prüfbar). */
async function speicherErlaubt() {
  try {
    if (typeof navigator.storage?.persisted !== 'function') return null;
    const ja = await navigator.storage.persisted();
    return typeof ja === 'boolean' ? ja : null;
  } catch {
    return null;
  }
}

function speicherZeile(erlaubt) {
  const [iconName, klasse, titel, text] = erlaubt === true
    ? ['i-check', 'speicher-ok', 'Dauerhafter Speicher erlaubt', 'iOS löscht die Trainingsdaten nicht automatisch. Trotzdem regelmäßig sichern.']
    : erlaubt === false
      ? ['i-alert', 'speicher-nein', 'Dauerhafter Speicher nicht erlaubt', NICHT_ERLAUBT_TEXT]
      : ['i-alert', 'speicher-nein', 'Nicht prüfbar', NICHT_ERLAUBT_TEXT];
  return h('div', { class: 'row speicher-zeile', 'data-speicher': erlaubt === null ? 'unbekannt' : String(erlaubt) },
    icon(iconName, klasse),
    h('div', { class: 'main' }, h('div', { class: 't fett', text: titel }), h('div', { class: 'st', text })));
}

/** Unterseite Fehlerprotokoll (Design 0.5.2, Punkt 4 und 5). Liefert die Aktualisierung. */
function initFehlerprotokoll(slot) {
  const speicher = h('div', { class: 'list' });
  const eintraege = h('div');
  slot.replaceChildren(
    h('div', { class: 'title-row' }, h('h1', { class: 'largetitle', text: 'Fehlerprotokoll' })),
    h('div', { class: 'section-h', text: 'Speicher' }),
    speicher,
    h('div', { class: 'section-h', text: 'Einträge' }),
    eintraege,
    h('div', { class: 'abstand-unten' }));

  const leeren = async () => {
    const wahl = await zeigeAlert({
      titel: 'Fehlerprotokoll leeren?',
      text: 'Die Einträge werden gelöscht.',
      textGrau: true,
      knoepfe: [{ id: 'nein', label: 'Nein', fett: true }, { id: 'ja', label: 'Ja', rot: true }]
    });
    if (wahl !== 'ja') return;
    leereProtokoll();
    zeichneEintraege();
  };

  const zeichneEintraege = () => {
    const liste = leseProtokoll();
    if (liste.length === 0) {
      eintraege.replaceChildren(h('div', { class: 'empty-liste' }, leerHinweis({
        iconName: 'i-alert',
        headline: 'Keine Fehler protokolliert',
        subhead: 'Hänger und nicht geklappte Speicherungen erscheinen hier mit Uhrzeit.'
      })));
      return;
    }
    eintraege.replaceChildren(
      h('div', { class: 'list plain' }, liste.map((e) =>
        h('div', { class: 'row protokoll-zeile' },
          h('div', { class: 'main' },
            h('div', { class: 'protokoll-zeit', text: zeitText(e.zeit) }),
            h('div', { class: 'protokoll-art', text: e.art }),
            e.text && h('div', { class: 'protokoll-text', text: e.text }))))),
      h('div', { class: 'abstand-8' }),
      h('button', { class: 'btn danger-text', type: 'button', text: 'Protokoll leeren', onclick: leeren }));
  };

  return async () => {
    zeichneEintraege();
    speicher.replaceChildren(speicherZeile(await speicherErlaubt()));
  };
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
    return id !== 'liste' ? aktualisierer[id]?.() : undefined;
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
    rekorde: initRekorde(slots.rekorde),
    fehlerprotokoll: initFehlerprotokoll(slots.fehlerprotokoll)
  };
  rahmen.replaceChildren(...ansichten.values());

  // Tab „Mehr“ öffnen: zuletzt offene Unterseite. Nochmal antippen: zurück zur Liste.
  // Nach Datenänderungen (ohne Argument) lädt nur die offene Unterseite neu, und nur wenn Mehr
  // sichtbar ist; sonst beim nächsten Öffnen (tab-events.js).
  registerTabUpdater('mehr', ({ nochmal } = {}) => {
    return nochmal ? zeige('liste') : zeige(aktuelle);
  });
  // Neuer Protokolleintrag, während die Seite offen ist.
  window.addEventListener('gym-fehlerprotokoll', () => {
    if (aktuelle === 'fehlerprotokoll' && !rahmen.hidden) aktualisierer.fehlerprotokoll();
  });
}
