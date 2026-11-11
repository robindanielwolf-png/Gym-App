// Screen 01/01c (Arten + Fortsetzen), 01a/01b (Trainingsvorschau) und 02 (laufendes Training):
// Vorschau, Check-in erst mit „Training starten“, Zurück, Art ändern, Verwerfen, Beenden, Auto-Ende.
// Das laufende Training steht sofort in IndexedDB.
import * as db from './db.js';
import { datumKurz, tageText, uhrzeit } from './format.js';
import {
  chipText, eintraegeVon, faelligesEnde, karteVorschlagText, letzteUebungen, letztesMalIndex, letztesTrainingDerArt,
  nachZeit, vorschauText, zuletztProArt
} from './logik.js';
import { alsNaechstesDran, neueRekorde, rekordHinweis } from './regeln.js';
import { oeffneSatz } from './satz.js';
import { setzeArten } from './tabs.js';
import { FEHLER_F2, oeffneHinzufuegen } from './uebungen.js';
import {
  einmalig, griff, h, icon, kachel, leerHinweis, oeffneSheet, randWischen, schliesseAlles, sheetKopf, zeigeAlert, zeigeHinweis
} from './ui.js';

const PRUEF_INTERVALL_MS = 60 * 1000;
const UEBERGANG_MS = 320;

let trainingAnsicht;
let trainingInhalt;
let vorschauAnsicht;
let vorschauInhalt;
let vorschauFuss;

let daten = null;
let laufend = null; // laufendes Training oder null
let lauf = null; // nur wenn 02 offen: { training, arten, uebungen: Map, letztesMal: Map }
let pruefTimer = null;
let kgGefragt = false; // automatische Abfrage des Körpergewichts schon gezeigt

export function initTraining(app) {
  trainingInhalt = h('div', { class: 'training-scroll' });
  trainingAnsicht = h('div', { class: 'push-ansicht training-ansicht', hidden: true }, trainingInhalt,
    h('div', { class: 'bottom-bar' },
      h('button', { class: 'btn primary', type: 'button', text: 'Training beenden', onclick: () => beenden() })));
  vorschauInhalt = h('div', { class: 'training-scroll' });
  vorschauFuss = h('div', { class: 'bottom-bar' });
  vorschauAnsicht = h('div', { class: 'push-ansicht vorschau-ansicht', hidden: true }, vorschauInhalt, vorschauFuss);
  app.append(vorschauAnsicht, trainingAnsicht);
  // Zurück per Wischen vom linken Rand: gleiches Ziel wie „‹ Training“.
  const darunter = () => [...app.children].filter((el) => !el.classList.contains('push-ansicht') && !el.hidden);
  randWischen(vorschauAnsicht, { darunter, beiZurueck: () => zurStartseite({ sofort: true }) });
  randWischen(trainingAnsicht, {
    darunter: () => [...darunter(), ...(vorschauAnsicht.hidden ? [] : [vorschauAnsicht])],
    beiZurueck: () => zurStartseite({ sofort: true })
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) pruefeAutoEnde(); });
}

/** Push von rechts (300 ms); bei „Bewegung reduzieren“ nur Überblenden (CSS). */
function zeigeEbene(el, an, { sofort = false } = {}) {
  if (an) {
    el.hidden = false;
    if (sofort) el.style.transition = 'none';
    el.getBoundingClientRect();
    el.classList.add('offen');
    if (sofort) { el.getBoundingClientRect(); el.style.transition = ''; }
  } else if (!el.hidden && sofort) {
    el.style.transition = 'none';
    el.classList.remove('offen');
    el.hidden = true;
    el.getBoundingClientRect();
    el.style.transition = '';
  } else if (!el.hidden) {
    el.classList.remove('offen');
    setTimeout(() => { if (!el.classList.contains('offen')) el.hidden = true; }, UEBERGANG_MS);
  }
}

/** Vorschau → Training: das Training schiebt sich darüber, die Vorschau verschwindet danach darunter. */
function vorschauUnterTrainingWeg() {
  if (vorschauAnsicht.hidden) return;
  setTimeout(() => {
    if (trainingAnsicht.classList.contains('offen')) zeigeEbene(vorschauAnsicht, false, { sofort: true });
  }, UEBERGANG_MS);
}

const sortierteArten = () => [...daten.trainingsarten].sort((a, b) => a.reihenfolge - b.reihenfolge);
const artVon = (id) => daten.trainingsarten.find((a) => a.id === id);
const merkeAnsicht = (wo) => { db.setzeLetzteAnsicht(wo).catch(() => {}); };

/**
 * Liest alles neu, wendet ein fälliges Auto-Ende an und zeigt den passenden Bildschirm.
 * Beim Start der App öffnet sie dort, wo man zuletzt war (Startseite, Vorschau einer Art oder
 * laufendes Training). Ein halb eingetippter Satz öffnet immer das Training. Ist noch nichts
 * gemerkt (Update von 0.2.0) und läuft ein Training, öffnet das Training wie bisher.
 */
export async function ladeUndZeige({ start = false, ziel = null } = {}) {
  let entwurf = null;
  let letzteAnsicht = null;
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
    if (start) [entwurf, letzteAnsicht] = await Promise.all([db.leseEntwurfSatz(), db.leseLetzteAnsicht()]);
    kgGefragt = await db.leseKoerpergewichtGefragt();
  } catch {
    zeigeAlert(FEHLER_F2);
    return;
  }

  laufend = daten.trainings.filter((t) => t.endedAt === null)
    .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt))[0] || null;

  clearInterval(pruefTimer);
  pruefTimer = laufend ? setInterval(pruefeAutoEnde, PRUEF_INTERVALL_MS) : null;

  zeichneStart();
  const entwurfPasst = Boolean(entwurf && laufend && entwurf.trainingId === laufend.id);
  let wohin = ziel;
  if (wohin === null) {
    if (!start) wohin = lauf ? 'training' : 'start';
    else if (entwurfPasst) wohin = 'training';
    else if (typeof letzteAnsicht !== 'string') wohin = laufend ? 'training' : 'start';
    else wohin = letzteAnsicht;
  }

  const vorschauArt = wohin.startsWith('vorschau:') ? artVon(wohin.slice('vorschau:'.length)) : null;
  if (vorschauArt && laufend?.artId === vorschauArt.id) wohin = 'training';

  if (wohin === 'training' && laufend) {
    oeffneTraining({ sofort: start });
    if (entwurfPasst) stelleEntwurfWiederHer(entwurf);
  } else if (vorschauArt) {
    lauf = null;
    zeigeEbene(trainingAnsicht, false);
    oeffneVorschau(vorschauArt, { sofort: start });
  } else {
    lauf = null;
    zeigeEbene(trainingAnsicht, false);
    zeigeEbene(vorschauAnsicht, false);
    merkeAnsicht('start');
  }
}

function zeichneStart() {
  const anzahl = laufend ? eintraegeVon(daten, laufend.id).length : 0;
  const lauft = laufend && {
    art: artVon(laufend.artId),
    nebentext: `seit ${uhrzeit(laufend.startedAt)}${anzahl ? ` · ${anzahl} ${anzahl === 1 ? 'Satz' : 'Sätze'}` : ''}`,
    beiFortsetzen: zumTraining
  };
  const zuletzt = zuletztProArt(daten);
  const naechste = laufend ? null : alsNaechstesDran(sortierteArten(), zuletzt);
  setzeArten(sortierteArten(), zuletzt, artAntippen, lauft || null,
    naechste && { ...naechste, beiTipp: () => oeffneVorschau(naechste.art) });
}

function artAntippen(art) {
  if (laufend && laufend.artId === art.id) zumTraining();
  else oeffneVorschau(art);
}

function zumTraining() {
  oeffneTraining();
}

function zurStartseite({ sofort = false } = {}) {
  lauf = null;
  merkeAnsicht('start');
  zeichneStart();
  zeigeEbene(trainingAnsicht, false, { sofort });
  zeigeEbene(vorschauAnsicht, false, { sofort });
}

const zurueckKnopf = (aktion) => h('button', { class: 'link zurueck', type: 'button', onclick: () => aktion() },
  icon('i-back', 's24'), 'Training');

// ---------- Trainingsvorschau (01a/01b) ----------

function oeffneVorschau(art, { sofort = false } = {}) {
  const letztes = letztesTrainingDerArt(daten, art.id, laufend?.id);
  const uebungen = new Map(daten.uebungen.map((u) => [u.id, u]));
  const ids = letztes ? letzteUebungen(daten, art.id, laufend?.id) : [];
  const eintraege = letztes ? eintraegeVon(daten, letztes.id).sort(nachZeit) : [];

  const tage = letztes ? tageText(letztes.startedAt) : null;
  const untertitel = letztes
    ? `${tage === 'heute' || tage === 'gestern' ? tage : `zuletzt ${tage}`} · ${datumKurz(letztes.startedAt)}`
    : 'noch nie trainiert';

  vorschauInhalt.replaceChildren(
    h('div', { class: 'navbar' }, zurueckKnopf(zurStartseite)),
    h('h1', { class: 'largetitle', text: art.name }),
    h('div', { class: 'subtitle', text: untertitel }),
    ...(ids.length > 0
      ? [
        h('div', { class: 'section-h oben-12', text: `Übungen vom letzten Mal (${ids.length})` }),
        h('div', { class: 'list plain' }, ids.map((id) => {
          const u = uebungen.get(id);
          const text = vorschauText(u, eintraege.filter((e) => e.uebungId === id));
          return h('div', { class: 'row vorschau-zeile', 'data-uebung': id },
            h('div', { class: 'main' }, h('div', { class: 't', text: u.name }), text && h('div', { class: 'st', text })));
        }))
      ]
      : [
        h('div', { class: 'abstand-32' }),
        leerHinweis({ headline: `Noch kein ${art.name}-Training`, subhead: 'Nach dem Start fügst du deine Übungen hinzu.' })
      ]));

  if (laufend) {
    vorschauFuss.replaceChildren(
      h('p', { class: 'foot-mitte fuss-hinweis', text: `Es läuft schon ein ${artVon(laufend.artId).name}-Training. Die Art wechselst du dort über „Art ändern“.` }),
      h('button', { class: 'btn primary', type: 'button', text: 'Zum laufenden Training', onclick: zumTraining }));
  } else {
    vorschauFuss.replaceChildren(
      h('button', { class: 'btn primary', type: 'button', text: 'Training starten', onclick: () => starte(art) }));
  }
  vorschauInhalt.scrollTop = 0;
  merkeAnsicht(`vorschau:${art.id}`);
  zeigeEbene(vorschauAnsicht, true, { sofort });
}

/** Erst hier entsteht das Training (Check-in). */
const starte = einmalig(async (art) => {
  if (laufend) return;
  const training = {
    id: `t-${crypto.randomUUID()}`,
    artId: art.id,
    startedAt: new Date().toISOString(),
    endedAt: null,
    uebungIds: letzteUebungen(daten, art.id)
  };
  try {
    await db.speichereTraining(training);
  } catch {
    zeigeAlert(FEHLER_F2);
    return;
  }
  await ladeUndZeige({ ziel: 'training' });
});

// ---------- Laufendes Training (02) ----------

function oeffneTraining({ sofort = false } = {}) {
  if (!laufend) return;
  lauf = {
    training: laufend,
    arten: sortierteArten(),
    uebungen: new Map(daten.uebungen.map((u) => [u.id, u])),
    letztesMal: letztesMalIndex(daten, laufend.id)
  };
  merkeAnsicht('training');
  zeichne();
  zeigeEbene(trainingAnsicht, true, { sofort });
  vorschauUnterTrainingWeg();
}

async function pruefeAutoEnde() {
  if (!laufend) return;
  if (!faelligesEnde(laufend, eintraegeVon(daten, laufend.id))) return;
  schliesseAlles();
  await ladeUndZeige({ ziel: 'start' });
}

const eintraege = () => eintraegeVon(daten, lauf.training.id);
const heute = (uebungId) => eintraege().filter((e) => e.uebungId === uebungId).sort(nachZeit);

function setzeTraining(training) {
  lauf.training = training;
  laufend = training;
  const i = daten.trainings.findIndex((t) => t.id === training.id);
  if (i >= 0) daten.trainings[i] = training;
}

function kontextFuer(uebung) {
  return {
    trainingId: lauf.training.id,
    letztesMal: lauf.letztesMal.get(uebung.id),
    heute,
    async speichere(store, eintrag) {
      await db.speichereEintrag(store, eintrag);
      const liste = daten[store];
      const i = liste.findIndex((e) => e.id === eintrag.id);
      if (i >= 0) liste[i] = eintrag; else liste.push(eintrag);
      zeichne();
    },
    async loesche(store, eintrag) {
      await db.loescheEintrag(store, eintrag.id);
      daten[store] = daten[store].filter((e) => e.id !== eintrag.id);
      zeichne();
    },
    merke(entwurf) {
      db.setzeEntwurfSatz(entwurf && { ...entwurf, trainingId: lauf.training.id }).catch(() => {});
    },
    /** Rekord-Hinweis nach einem neuen Arbeitssatz; nicht beim ersten Mal der Übung. */
    pruefeRekord(store, eintrag) {
      if (eintrag.aufwaermen || !lauf?.letztesMal.get(uebung.id)) return;
      const vorher = daten[store].filter((e) => e.uebungId === uebung.id && e.id !== eintrag.id);
      const hinweis = rekordHinweis(uebung, neueRekorde(uebung, vorher, eintrag));
      if (hinweis) zeigeHinweis({ ...hinweis, iconName: 'i-trophy', einzeilig: true });
    },
    koerpergewicht: aktuellesKoerpergewicht,
    setzeKoerpergewicht(kg) {
      const alt = daten.koerpergewicht;
      daten.koerpergewicht = [{ id: db.KOERPERGEWICHT_ID, kg }];
      kgGefragt = true;
      return db.speichereKoerpergewicht(kg).catch(() => {
        daten.koerpergewicht = alt;
        zeigeAlert(FEHLER_F2);
      });
    },
    kgGefragt: () => kgGefragt,
    markiereKgGefragt() {
      kgGefragt = true;
      db.setzeKoerpergewichtGefragt().catch(() => {});
    }
  };
}

function aktuellesKoerpergewicht() {
  const e = (daten.koerpergewicht || []).find((k) => k.id === db.KOERPERGEWICHT_ID) || (daten.koerpergewicht || []).at(-1);
  return typeof e?.kg === 'number' ? e.kg : null;
}

function oeffneSatzFuer(uebung, bearbeite = null, entwurf = null) {
  oeffneSatz({ uebung, kontext: kontextFuer(uebung), bearbeite, entwurf });
}

function stelleEntwurfWiederHer(entwurf) {
  const uebung = lauf?.uebungen.get(entwurf.uebungId);
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
  oeffneHinzufuegen({
    art: artVon(lauf.training.artId),
    uebungen: [...lauf.uebungen.values()],
    letztesMal: lauf.letztesMal,
    beiNeu: (u) => {
      lauf.uebungen.set(u.id, u);
      daten.uebungen.push(u);
    },
    beiWahl: (u) => {
      if (!lauf.training.uebungIds.includes(u.id)) {
        setzeTraining({ ...lauf.training, uebungIds: [...lauf.training.uebungIds, u.id] });
        speichereTraining();
        zeichne();
      }
      oeffneSatzFuer(u);
    }
  });
}

function karte(uebung) {
  const wert = karteVorschlagText(uebung, lauf.letztesMal.get(uebung.id));
  return h('div', { class: 'ex', 'data-uebung': uebung.id },
    h('div', { class: 'top' }, h('b', { text: uebung.name }), h('small', { text: wert })),
    h('div', { class: 'sets' },
      heute(uebung.id).map((e) => h('button', {
        class: `chip ${e.aufwaermen ? 'warm' : ''}`.trim(), type: 'button', text: chipText(uebung, e),
        onclick: () => oeffneSatzFuer(uebung, e)
      })),
      h('button', { class: 'chip add', type: 'button', text: '+ Satz', onclick: () => oeffneSatzFuer(uebung) })));
}

function zeichne() {
  if (!lauf) return;
  const t = lauf.training;
  const art = artVon(t.artId);
  const uebungen = t.uebungIds.map((id) => lauf.uebungen.get(id)).filter(Boolean);
  const hinzuKnopf = h('button', { class: 'btn secondary', type: 'button', onclick: hinzufuegen }, icon('i-plus'), 'Übung hinzufügen');

  trainingInhalt.replaceChildren(
    h('div', { class: 'navbar' },
      zurueckKnopf(zurStartseite),
      h('button', { class: 'link', type: 'button', text: 'Art ändern', onclick: artAendern })),
    h('h1', { class: 'largetitle', text: art.name }),
    h('div', { class: 'subtitle running' }, h('span', { class: 'dot' }), `läuft seit ${uhrzeit(t.startedAt)}`),
    ...(uebungen.length === 0
      ? [
        h('div', { class: 'abstand-32' }),
        leerHinweis({ headline: 'Noch keine Übungen', subhead: `Füge die erste Übung für ${art.name} hinzu.` }),
        h('div', { class: 'abstand-16' }),
        h('div', { class: 'rand-16' }, hinzuKnopf)
      ]
      : [...uebungen.map(karte), h('div', { class: 'rand-hinzu' }, hinzuKnopf)]));
}

/** V1: jede Verwerfen-Aktion nur nach Rückfrage. Liefert true, wenn verworfen wurde. */
async function frageUndVerwerfe() {
  const wahl = await zeigeAlert({
    titel: 'Willst du das Training wirklich verwerfen?',
    text: 'Du hast noch keinen Satz eingetragen. Das Training wird nicht gespeichert.',
    knoepfe: [{ id: 'nein', label: 'Nein', fett: true }, { id: 'ja', label: 'Ja', rot: true }]
  });
  if (wahl !== 'ja' || !lauf) return false;
  try {
    await db.loescheTraining(lauf.training.id);
  } catch {
    zeigeAlert(FEHLER_F2);
    return false;
  }
  schliesseAlles();
  merkeAnsicht('start');
  await ladeUndZeige({ ziel: 'start' });
  return true;
}

const beenden = einmalig(async () => {
  if (!lauf) return;
  if (eintraege().length === 0) {
    await frageUndVerwerfe();
    return;
  }
  try {
    await db.speichereTraining({ ...lauf.training, endedAt: new Date().toISOString() });
  } catch {
    zeigeAlert(FEHLER_F2);
    return;
  }
  merkeAnsicht('start');
  await ladeUndZeige({ ziel: 'start' });
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
            setzeTraining({
              ...lauf.training,
              artId: a.id,
              uebungIds: hatEintraege ? lauf.training.uebungIds : letzteUebungen(daten, a.id, lauf.training.id)
            });
            speichereTraining();
            setTimeout(() => { schliessen(); zeichne(); }, 200);
          }
        }, kachel(a.icon), h('div', { class: 'main t', text: a.name }),
        a.id === lauf.training.artId && icon('i-check', 'haken')))),
      hatEintraege
        ? h('p', { class: 'foot-links', text: 'Deine Sätze bleiben erhalten.' })
        : h('button', {
          class: 'btn danger-text verwerfen', type: 'button', text: 'Training verwerfen',
          onclick: () => { frageUndVerwerfe(); }
        }),
      h('div', { class: 'sheet-boden' })
    ]
  });
}
