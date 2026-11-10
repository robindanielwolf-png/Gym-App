// Screen 01 (Liste der Arten) und Screen 02 (laufendes Training): Check-in, Übungen,
// Art ändern, Verwerfen, Beenden, Auto-Ende. Das laufende Training steht sofort in IndexedDB.
import * as db from './db.js';
import { uhrzeit } from './format.js';
import {
  eintraegeVon, faelligesEnde, letzteUebungen, letztesMalIndex, nachZeit, zuletztProArt, zuletztText, chipText
} from './logik.js';
import { oeffneSatz } from './satz.js';
import { setzeArten } from './tabs.js';
import { FEHLER_F2, oeffneHinzufuegen } from './uebungen.js';
import { einmalig, griff, h, icon, kachel, leerHinweis, oeffneSheet, schliesseAlles, sheetKopf, zeigeAlert } from './ui.js';

const PRUEF_INTERVALL_MS = 60 * 1000;

let ansicht;
let inhalt;
let lauf = null; // { daten, training, arten, uebungen: Map, letztesMal: Map }
let startDaten = null;
let pruefTimer = null;

export function initTraining(app) {
  inhalt = h('div', { class: 'training-scroll' });
  ansicht = h('div', { class: 'training-ansicht', hidden: true }, inhalt,
    h('div', { class: 'bottom-bar' },
      h('button', { class: 'btn primary', type: 'button', text: 'Training beenden', onclick: () => beenden() })));
  app.append(ansicht);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) pruefeAutoEnde(); });
}

const sortierteArten = (daten) => [...daten.trainingsarten].sort((a, b) => a.reihenfolge - b.reihenfolge);

/** Liest alles neu, wendet ein fälliges Auto-Ende an und zeigt Start oder laufendes Training. */
export async function ladeUndZeige({ start = false } = {}) {
  let daten;
  try {
    daten = await db.leseDaten();
    let geaendert = false;
    for (const t of daten.trainings.filter((x) => x.endedAt === null)) {
      const ende = faelligesEnde(t, eintraegeVon(daten, t.id));
      if (!ende) continue;
      // Ohne jeden Satz wird verworfen, sonst endet das Training 3 Std. nach dem letzten Satz.
      if (ende.leer) await db.loescheTraining(t.id);
      else await db.speichereTraining({ ...t, endedAt: ende.endedAt });
      geaendert = true;
    }
    if (geaendert) daten = await db.leseDaten();
  } catch {
    zeigeAlert(FEHLER_F2);
    return;
  }

  const laufend = daten.trainings.filter((t) => t.endedAt === null)
    .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt))[0];

  if (laufend) {
    lauf = {
      daten,
      training: laufend,
      arten: sortierteArten(daten),
      uebungen: new Map(daten.uebungen.map((u) => [u.id, u])),
      letztesMal: letztesMalIndex(daten, laufend.id)
    };
    zeigeTraining();
    if (start) await stelleEntwurfWiederHer();
  } else {
    lauf = null;
    versteckeTraining();
    startDaten = daten;
    setzeArten(sortierteArten(daten), zuletztProArt(daten), starte);
  }
}

const starte = einmalig(async (art) => {
  if (!startDaten || lauf) return;
  const training = {
    id: `t-${crypto.randomUUID()}`,
    artId: art.id,
    startedAt: new Date().toISOString(),
    endedAt: null,
    uebungIds: letzteUebungen(startDaten, art.id)
  };
  try {
    await db.speichereTraining(training);
  } catch {
    zeigeAlert(FEHLER_F2);
    return;
  }
  await ladeUndZeige();
});

function zeigeTraining() {
  ansicht.hidden = false;
  zeichne();
  if (!pruefTimer) pruefTimer = setInterval(pruefeAutoEnde, PRUEF_INTERVALL_MS);
}

function versteckeTraining() {
  ansicht.hidden = true;
  inhalt.replaceChildren();
  clearInterval(pruefTimer);
  pruefTimer = null;
}

async function pruefeAutoEnde() {
  if (!lauf) return;
  if (!faelligesEnde(lauf.training, eintraegeVon(lauf.daten, lauf.training.id))) return;
  schliesseAlles();
  await ladeUndZeige();
}

const artVon = (id) => lauf.arten.find((a) => a.id === id);
const eintraege = () => eintraegeVon(lauf.daten, lauf.training.id);
const heute = (uebungId) => eintraege().filter((e) => e.uebungId === uebungId).sort(nachZeit);

function kontextFuer(uebung) {
  return {
    trainingId: lauf.training.id,
    letztesMal: lauf.letztesMal.get(uebung.id),
    heute,
    async speichere(store, eintrag) {
      await db.speichereEintrag(store, eintrag);
      const liste = lauf.daten[store];
      const i = liste.findIndex((e) => e.id === eintrag.id);
      if (i >= 0) liste[i] = eintrag; else liste.push(eintrag);
      zeichne();
    },
    async loesche(store, eintrag) {
      await db.loescheEintrag(store, eintrag.id);
      lauf.daten[store] = lauf.daten[store].filter((e) => e.id !== eintrag.id);
      zeichne();
    },
    merke(entwurf) {
      db.setzeEntwurfSatz(entwurf && { ...entwurf, trainingId: lauf.training.id }).catch(() => {});
    }
  };
}

function oeffneSatzFuer(uebung, bearbeite = null, entwurf = null) {
  oeffneSatz({ uebung, kontext: kontextFuer(uebung), bearbeite, entwurf });
}

async function stelleEntwurfWiederHer() {
  let entwurf;
  try {
    entwurf = await db.leseEntwurfSatz();
  } catch {
    return;
  }
  if (!entwurf || entwurf.trainingId !== lauf.training.id) return;
  const uebung = lauf.uebungen.get(entwurf.uebungId);
  if (!uebung) return;
  const bearbeite = entwurf.satzId ? eintraege().find((e) => e.id === entwurf.satzId) : null;
  if (entwurf.satzId && !bearbeite) return;
  oeffneSatzFuer(uebung, bearbeite, entwurf);
}

async function speichereTraining() {
  try {
    await db.speichereTraining(lauf.training);
  } catch {
    zeigeAlert(FEHLER_F2);
    await ladeUndZeige();
  }
}

function hinzufuegen() {
  const art = artVon(lauf.training.artId);
  oeffneHinzufuegen({
    art,
    uebungen: [...lauf.uebungen.values()],
    letztesMal: lauf.letztesMal,
    beiNeu: (u) => {
      lauf.uebungen.set(u.id, u);
      lauf.daten.uebungen.push(u);
    },
    beiWahl: (u) => {
      if (!lauf.training.uebungIds.includes(u.id)) {
        lauf.training = { ...lauf.training, uebungIds: [...lauf.training.uebungIds, u.id] };
        speichereTraining();
        zeichne();
      }
      oeffneSatzFuer(u);
    }
  });
}

function karte(uebung) {
  const zuletzt = zuletztText(uebung, lauf.letztesMal.get(uebung.id));
  return h('div', { class: 'ex', 'data-uebung': uebung.id },
    h('div', { class: 'top' }, h('b', { text: uebung.name }), zuletzt && h('small', { text: zuletzt })),
    h('div', { class: 'sets' },
      heute(uebung.id).map((e) => h('button', {
        class: `chip ${e.aufwaermen ? 'warm' : ''}`.trim(), type: 'button', text: chipText(uebung, e),
        onclick: () => oeffneSatzFuer(uebung, e)
      })),
      h('button', { class: 'chip add', type: 'button', text: '+ Satz', onclick: () => oeffneSatzFuer(uebung) })));
}

function zeichne() {
  const t = lauf.training;
  const art = artVon(t.artId);
  const uebungen = t.uebungIds.map((id) => lauf.uebungen.get(id)).filter(Boolean);
  const hinzuKnopf = h('button', { class: 'btn secondary', type: 'button', onclick: hinzufuegen }, icon('i-plus'), 'Übung hinzufügen');

  inhalt.replaceChildren(
    h('div', { class: 'navbar' },
      h('span', { class: 'running' }, h('span', { class: 'dot' }), `läuft seit ${uhrzeit(t.startedAt)}`),
      h('button', { class: 'link', type: 'button', text: 'Art ändern', onclick: artAendern })),
    h('h1', { class: 'largetitle', text: art.name }),
    ...(uebungen.length === 0
      ? [
        h('div', { class: 'abstand-32' }),
        leerHinweis({ headline: 'Noch keine Übungen', subhead: `Füge die erste Übung für ${art.name} hinzu.` }),
        h('div', { class: 'abstand-16' }),
        h('div', { class: 'rand-16' }, hinzuKnopf)
      ]
      : [...uebungen.map(karte), h('div', { class: 'rand-hinzu' }, hinzuKnopf)]));
}

async function verwerfen() {
  try {
    await db.loescheTraining(lauf.training.id);
  } catch {
    zeigeAlert(FEHLER_F2);
    return;
  }
  await ladeUndZeige();
}

const beenden = einmalig(async () => {
  if (!lauf) return;
  if (eintraege().length === 0) {
    const wahl = await zeigeAlert({
      titel: 'Training verwerfen?',
      text: 'Du hast noch keinen Satz eingetragen. Das Training wird nicht gespeichert.',
      knoepfe: [{ id: 'weiter', label: 'Weiter trainieren', fett: true }, { id: 'weg', label: 'Verwerfen', rot: true }]
    });
    if (wahl === 'weg') await verwerfen();
    return;
  }
  try {
    await db.speichereTraining({ ...lauf.training, endedAt: new Date().toISOString() });
  } catch {
    zeigeAlert(FEHLER_F2);
    return;
  }
  await ladeUndZeige();
});

function artAendern() {
  const hatEintraege = eintraege().length > 0;
  let gewaehlt = false;
  oeffneSheet({
    baue: (schliessen) => [
      griff(),
      sheetKopf('Art ändern', schliessen),
      h('div', { class: 'list auf-weiss kein-rand oben-12' }, lauf.arten.map((a) =>
        h('button', {
          class: 'row', type: 'button', 'data-art': a.id,
          onclick: (e) => {
            if (gewaehlt || a.id === lauf.training.artId) return;
            gewaehlt = true;
            e.currentTarget.parentElement.querySelectorAll('.haken').forEach((x) => x.remove());
            e.currentTarget.append(icon('i-check', 'haken'));
            // Ohne Satz: Übungen vom letzten Training der neuen Art; mit Sätzen bleiben die Karten.
            lauf.training = {
              ...lauf.training,
              artId: a.id,
              uebungIds: hatEintraege ? lauf.training.uebungIds : letzteUebungen(lauf.daten, a.id, lauf.training.id)
            };
            speichereTraining();
            setTimeout(() => { schliessen(); zeichne(); }, 200);
          }
        }, kachel(a.icon), h('div', { class: 'main t', text: a.name }),
        a.id === lauf.training.artId && icon('i-check', 'haken')))),
      hatEintraege
        ? h('p', { class: 'foot-links', text: 'Deine Sätze bleiben erhalten.' })
        : h('button', {
          class: 'btn danger-text verwerfen', type: 'button', text: 'Training verwerfen',
          onclick: () => { schliessen(); verwerfen(); }
        }),
      h('div', { class: 'sheet-boden' })
    ]
  });
}
