// Screen 01/01c (Arten + Fortsetzen), 01a/01b (Trainingsvorschau) und 02 (laufendes Training):
// Vorschau, Check-in erst mit „Training starten“, Zurück, Art ändern, Verwerfen, Beenden, Auto-Ende.
// Das laufende Training steht sofort in IndexedDB. 0.5.2: Speicherstatus, Rückfrage beim Beenden,
// Ende-Datum zuerst sicher schreiben, Nebenschritte danach ohne Sperre, kein Zurück-Wischen mehr.
// 0.5.3: „Training fortführen“ (#36) und dieselbe Ansicht im Modus „bearbeiten“ für beendete
// Trainings aus dem Verlauf (#37): ohne „läuft seit“, Vorschlag, Rekord-Hinweis und Entwurf, unten „Fertig“.
import * as db from './db.js';
import { datumKurz, tageText, tagKurz, uhrzeit } from './format.js';
import {
  FORTFUEHREN_MS, chipText, eintraegeVon, faelligesEnde, fortfuehrbar, karteVorschlagText, letzteUebungen, letztesMalIndex,
  letztesTrainingDerArt, nachZeit, vorschauText, zuletztProArt
} from './logik.js';
import { alsNaechstesDran, neueRekorde, rekordHinweis } from './regeln.js';
import { oeffneSatz } from './satz.js';
import { registerTabActivation, setzeArten, zeigeTab } from './tabs.js';
import { protokolliere } from './fehlerprotokoll.js';
import { zeigeTrainingsUebersicht } from './muskel-figur.js';
import { aktualisierePunkt, frageJetztSichern } from './sicherung-sheet.js';
import { FEHLER_F2, oeffneHinzufuegen } from './uebungen.js';
import {
  einmalig, griff, h, icon, kachel, leerHinweis, oeffneSheet, schliesseAlles, setzeUeberdeckt, sheetKopf, zeigeAlert,
  zeigeHinweis, zeigeSpeicherFehler
} from './ui.js';

const PRUEF_INTERVALL_MS = 60 * 1000;
const UEBERGANG_MS = 320;
const GESPEICHERT_SICHTBAR_MS = 2000;
// Farbe von „Ja“ im Alert „Willst du das Training wirklich beenden?“: vorerst blau (false).
// Für Rot (wie bei „Verwerfen“) hier true setzen.
const JA_BEENDEN_ROT = false;

let trainingAnsicht;
let trainingInhalt;
let vorschauAnsicht;
let vorschauInhalt;
let vorschauFuss;

let daten = null;
let laufend = null; // laufendes Training oder null
// nur wenn 02 offen: { modus: 'laufend' | 'bearbeiten', training, arten, uebungen: Map, letztesMal: Map,
// auswahl: Map („zuletzt“ in der Übungsauswahl) }
let lauf = null;
let fussKnopf;
const imBearbeiten = () => lauf?.modus === 'bearbeiten';
const LETZTER_SATZ_TEXT = 'Das ist der letzte Satz. Dann wird das Training gelöscht.';
let pruefTimer = null;
let fortfuehrenTimer = null; // blendet die Zeile „Training fortführen“ genau nach 60 Min. aus
// E10 (Entscheidung a): „letztes Mal“ je Übung wird beim ersten Öffnen des laufenden Trainings
// festgehalten und gilt bis zum Beenden bzw. App-Neustart (nur im Speicher der Sitzung).
let festVorschlag = null; // { trainingId, letztesMal: Map }
let kgGefragt = false; // automatische Abfrage des Körpergewichts schon gezeigt

export function initTraining(app) {
  trainingInhalt = h('div', { class: 'training-scroll' });
  fussKnopf = h('button', {
    class: 'btn primary', type: 'button', text: 'Training beenden',
    onclick: () => { if (imBearbeiten()) schliesseBearbeiten(); else beenden(); }
  });
  trainingAnsicht = h('div', { class: 'push-ansicht training-ansicht', hidden: true }, trainingInhalt,
    h('div', { class: 'bottom-bar' }, fussKnopf));
  vorschauInhalt = h('div', { class: 'training-scroll' });
  vorschauFuss = h('div', { class: 'bottom-bar' });
  vorschauAnsicht = h('div', { class: 'push-ansicht vorschau-ansicht', hidden: true }, vorschauInhalt, vorschauFuss);
  app.append(vorschauAnsicht, trainingAnsicht);
  // 0.5.2 (V6): kein Zurück-Wischen vom linken Rand mehr; zurück nur über „‹ Training“.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) return;
    pruefeAutoEnde();
    if (daten) zeichneStart();
  });
  // #36: Die Minuten bei „Training fortführen“ werden beim Öffnen des Tabs neu berechnet (kein Timer).
  registerTabActivation('training', () => { if (daten) zeichneStart(); });
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
  // Liegt Training oder Vorschau über den Tabs? Tabs laden dann nicht neu, die 3D-Figur pausiert.
  setzeUeberdeckt(trainingAnsicht.classList.contains('offen') || vorschauAnsicht.classList.contains('offen'));
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
export async function ladeUndZeige({ start = false, ziel = null, fehlerAlert = true } = {}) {
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
    // Liefert false; beim App-Start zeigt main.js die Meldung und versucht es erneut.
    if (fehlerAlert) zeigeAlert(FEHLER_F2);
    return false;
  }

  laufend = daten.trainings.filter((t) => t.endedAt === null)
    .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt))[0] || null;

  clearInterval(pruefTimer);
  pruefTimer = laufend ? setInterval(pruefeAutoEnde, PRUEF_INTERVALL_MS) : null;

  zeichneStart();
  // #37: Eine offene Bearbeiten-Ansicht bleibt offen und zeigt den neuen Stand.
  if (imBearbeiten() && ziel !== 'training') {
    const t = daten.trainings.find((x) => x.id === lauf.training.id);
    if (t?.endedAt && eintraegeVon(daten, t.id).length > 0) {
      lauf.training = t;
      lauf.uebungen = new Map(daten.uebungen.map((u) => [u.id, u]));
      zeichne();
    } else {
      schliesseBearbeiten();
    }
    return true;
  }
  const entwurfPasst = Boolean(entwurf && laufend && entwurf.trainingId === laufend.id);
  let wohin = ziel;
  if (wohin === null) {
    if (!start) wohin = lauf ? 'training' : 'start';
    else if (entwurfPasst) wohin = 'training';
    else if (typeof letzteAnsicht !== 'string') wohin = laufend ? 'training' : 'start';
    else wohin = letzteAnsicht;
  }
  // F5: Läuft beim App-Start ein Training, steht immer der Tab Training mit „<Art> läuft · Fortsetzen“
  // unter allem (nicht Start mit der 3D-Figur); „‹ Training“ führt dorthin zurück.
  if (start && laufend) zeigeTab('training');

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
  return true;
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
  const ff = laufend ? null : fortfuehrbar(daten);
  const ffArt = ff && artVon(ff.training.artId);
  clearTimeout(fortfuehrenTimer);
  fortfuehrenTimer = ff ? setTimeout(zeichneStart, Date.parse(ff.training.endedAt) + FORTFUEHREN_MS - Date.now() + 50) : null;
  setzeArten(sortierteArten(), zuletzt, artAntippen, lauft || null,
    naechste && { ...naechste, beiTipp: () => oeffneVorschau(naechste.art) },
    ffArt ? { art: ffArt, minuten: ff.minuten, beiTipp: () => fortfuehren(ff.training.id) } : null);
}

/**
 * #36: Ende-Datum entfernen, `fortgefuehrtAm` setzen – ein einziger Schreibvorgang, kein zweites
 * Training. Klappt das Schreiben nicht, bleibt das Training beendet und der Hinweis erscheint.
 */
const fortfuehren = einmalig(async (trainingId) => {
  if (laufend || lauf) return;
  // F4: Beim Antippen erneut prüfen; nach 60 Min. wird nichts geschrieben und die Zeile verschwindet.
  const ff = fortfuehrbar(daten);
  if (ff?.training.id !== trainingId) {
    zeichneStart();
    zeigeHinweis({ titel: 'Zu spät zum Fortführen', text: 'Das Training ist seit über 60 Min. beendet.', iconName: 'i-alert', einzeilig: true });
    return;
  }
  const training = ff.training;
  festVorschlag = null;
  const neu = { ...training, endedAt: null, fortgefuehrtAm: new Date().toISOString() };
  try {
    await db.speichereTraining(neu);
  } catch {
    zeigeSpeicherFehler();
    return;
  }
  const i = daten.trainings.findIndex((t) => t.id === neu.id);
  if (i >= 0) daten.trainings[i] = neu;
  laufend = neu;
  clearInterval(pruefTimer);
  pruefTimer = setInterval(pruefeAutoEnde, PRUEF_INTERVALL_MS);
  zeichneStart();
  oeffneTraining();
  // Verlauf, Start und Mehr laden beim nächsten Öffnen (das Training ist jetzt wieder laufend).
  window.dispatchEvent(new Event('gym-daten-veraltet'));
}, 'Training fortführen');

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

const zurueckKnopf = (aktion, label = 'Training') => h('button', { class: 'link zurueck', type: 'button', onclick: () => aktion() },
  icon('i-back', 's24'), label);

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

// id des Trainings, das gerade angelegt wird: Nach einem Fehler nutzt der nächste Tipp dieselbe id,
// falls die Datenbank doch noch geschrieben hat, entsteht so kein zweites Training.
let startId = null;

/** Erst hier entsteht das Training (Check-in). Nie ein zweites laufendes Training. */
const starte = einmalig(async (art) => {
  if (laufend) return;
  let schonLaufend;
  try {
    schonLaufend = (await db.leseDaten()).trainings.some((t) => t.endedAt === null);
  } catch {
    zeigeSpeicherFehler();
    return;
  }
  if (schonLaufend) {
    await ladeUndZeige({ ziel: 'training' });
    return;
  }
  startId ||= `t-${crypto.randomUUID()}`;
  const training = {
    id: startId,
    artId: art.id,
    startedAt: new Date().toISOString(),
    endedAt: null,
    uebungIds: letzteUebungen(daten, art.id)
  };
  try {
    await db.speichereTraining(training);
  } catch {
    zeigeSpeicherFehler();
    return;
  }
  startId = null;
  await ladeUndZeige({ ziel: 'training' });
}, 'Training starten');

// ---------- Speicherstatus im laufenden Training (V2, Design 0.5.2 Punkt 1) ----------

const speicherstatus = h('span', { class: 'speicherstatus', role: 'status' });
let statusTimer = null;
let offeneSpeicherungen = 0;
let statusTrainingId = null;

/** zustand: 'speichert' | 'gespeichert' | 'fehler' | 'leer'. Das Element bleibt immer im DOM (kein Springen). */
function setzeSpeicherstatus(zustand) {
  clearTimeout(statusTimer);
  speicherstatus.classList.remove('blendet');
  speicherstatus.dataset.zustand = zustand;
  if (zustand === 'leer') {
    speicherstatus.classList.remove('sichtbar');
    return;
  }
  const [iconName, text] = {
    speichert: ['i-sync', 'wird gespeichert …'],
    gespeichert: ['i-check', 'gespeichert'],
    fehler: ['i-x', 'nicht gespeichert']
  }[zustand];
  speicherstatus.replaceChildren(icon(iconName, zustand === 'speichert' ? 's14 spin' : 's14'), text);
  speicherstatus.classList.add('sichtbar');
  if (zustand === 'gespeichert') {
    statusTimer = setTimeout(() => {
      speicherstatus.classList.add('blendet');
      speicherstatus.classList.remove('sichtbar');
    }, GESPEICHERT_SICHTBAR_MS);
  }
}

/** Führt eine Speicherung aus und zeigt dabei den Status; Fehler werden weitergegeben. */
async function mitSpeicherstatus(arbeit) {
  offeneSpeicherungen++;
  setzeSpeicherstatus('speichert');
  try {
    const ergebnis = await arbeit();
    offeneSpeicherungen--;
    if (offeneSpeicherungen === 0) setzeSpeicherstatus('gespeichert');
    return ergebnis;
  } catch (e) {
    offeneSpeicherungen--;
    setzeSpeicherstatus('fehler');
    throw e;
  }
}

// ---------- Laufendes Training (02) ----------

/** „nicht gespeichert“ bleibt beim Wiederöffnen stehen, bis der nächste Versuch läuft (Design A3); nur bei einem anderen Training beginnt der Status leer. */
function statusFuer(trainingId) {
  const anderesTraining = statusTrainingId !== trainingId;
  statusTrainingId = trainingId;
  if (offeneSpeicherungen === 0 && (anderesTraining || speicherstatus.dataset.zustand !== 'fehler')) setzeSpeicherstatus('leer');
}

function oeffneTraining({ sofort = false } = {}) {
  if (!laufend) return;
  if (festVorschlag?.trainingId !== laufend.id) festVorschlag = { trainingId: laufend.id, letztesMal: letztesMalIndex(daten, laufend.id) };
  const { letztesMal } = festVorschlag;
  lauf = {
    modus: 'laufend',
    training: laufend,
    arten: sortierteArten(),
    uebungen: new Map(daten.uebungen.map((u) => [u.id, u])),
    letztesMal,
    auswahl: letztesMal
  };
  merkeAnsicht('training');
  statusFuer(laufend.id);
  zeichne();
  zeigeEbene(trainingAnsicht, true, { sofort });
  vorschauUnterTrainingWeg();
}

/**
 * #37: Beendetes Training aus dem Verlauf in der Trainings-Ansicht bearbeiten. Es bleibt beendet
 * (startedAt, endedAt, fortgefuehrtAm unverändert). Kein Vorschlag (leeres letztesMal).
 */
export const oeffneBearbeiten = einmalig(async (trainingId) => {
  if (lauf) return;
  let frisch;
  try {
    frisch = await db.leseDaten();
  } catch {
    zeigeAlert(FEHLER_F2);
    return;
  }
  daten = frisch;
  laufend = daten.trainings.filter((t) => t.endedAt === null)
    .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt))[0] || null;
  const training = daten.trainings.find((t) => t.id === trainingId);
  if (!training?.endedAt || !artVon(training.artId)) return;
  lauf = {
    modus: 'bearbeiten',
    training,
    arten: sortierteArten(),
    uebungen: new Map(daten.uebungen.map((u) => [u.id, u])),
    letztesMal: new Map(),
    auswahl: letztesMalIndex(daten)
  };
  statusFuer(training.id);
  zeichneStart();
  zeichne();
  trainingInhalt.scrollTop = 0;
  zeigeEbene(trainingAnsicht, true);
}, 'Training bearbeiten');

/** „‹ Verlauf“ und „Fertig“: ohne Rückfrage, alles ist schon gespeichert. */
function schliesseBearbeiten() {
  if (!imBearbeiten()) return;
  lauf = null;
  zeichneStart();
  zeigeEbene(trainingAnsicht, false);
}

async function pruefeAutoEnde() {
  if (!laufend) return;
  if (!faelligesEnde(laufend, eintraegeVon(daten, laufend.id))) return;
  // Eine offene Bearbeiten-Ansicht (anderes Training) bleibt offen.
  if (!imBearbeiten()) schliesseAlles();
  await ladeUndZeige({ ziel: 'start' });
}

const eintraege = () => eintraegeVon(daten, lauf.training.id);
const heute = (uebungId) => eintraege().filter((e) => e.uebungId === uebungId).sort(nachZeit);

function setzeTraining(training) {
  lauf.training = training;
  if (!imBearbeiten()) laufend = training;
  const i = daten.trainings.findIndex((t) => t.id === training.id);
  if (i >= 0) daten.trainings[i] = training;
}

function kontextFuer(uebung) {
  const bearbeiten = imBearbeiten();
  return {
    trainingId: lauf.training.id,
    letztesMal: lauf.letztesMal.get(uebung.id),
    ohneVorschlag: bearbeiten,
    heute,
    async speichere(store, eintrag) {
      await mitSpeicherstatus(() => db.speichereEintrag(store, eintrag));
      const liste = daten[store];
      const i = liste.findIndex((e) => e.id === eintrag.id);
      if (i >= 0) liste[i] = eintrag; else liste.push(eintrag);
      zeichne();
      // F3: Nur das Training ist schon aktuell; Start, Verlauf und Mehr laden beim nächsten Öffnen.
      window.dispatchEvent(new Event('gym-daten-veraltet'));
    },
    async loesche(store, eintrag) {
      // #37 (E-R5): Der letzte Satz eines beendeten Trainings löscht nach der Rückfrage das Training.
      if (bearbeiten && istLetzterEintrag(eintrag)) {
        const id = lauf.training.id;
        await db.loescheTraining(id);
        daten.trainings = daten.trainings.filter((t) => t.id !== id);
        daten.saetze = daten.saetze.filter((e) => e.trainingId !== id);
        daten.cardio = daten.cardio.filter((e) => e.trainingId !== id);
        schliesseBearbeiten();
        window.dispatchEvent(new Event('gym-daten-veraltet'));
        return;
      }
      await db.loescheEintrag(store, eintrag.id);
      daten[store] = daten[store].filter((e) => e.id !== eintrag.id);
      zeichne();
      window.dispatchEvent(new Event('gym-daten-veraltet'));
    },
    loeschZusatz: (store, eintrag) => (bearbeiten && istLetzterEintrag(eintrag) ? LETZTER_SATZ_TEXT : null),
    merke(entwurf) {
      // Der Entwurfspeicher gehört nur zum laufenden Training (Design 0.5.3, Punkt 2).
      if (bearbeiten) return;
      db.setzeEntwurfSatz(entwurf && { ...entwurf, trainingId: lauf.training.id }).catch(() => {});
    },
    /** Rekord-Hinweis nach einem neuen Arbeitssatz; nicht beim ersten Mal der Übung, nie beim Bearbeiten. */
    pruefeRekord(store, eintrag) {
      if (bearbeiten || eintrag.aufwaermen || !lauf?.letztesMal.get(uebung.id)) return;
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
        zeigeSpeicherFehler();
      });
    },
    kgGefragt: () => bearbeiten || kgGefragt,
    markiereKgGefragt() {
      kgGefragt = true;
      db.setzeKoerpergewichtGefragt().catch(() => {});
    }
  };
}

function istLetzterEintrag(eintrag) {
  const alle = eintraege();
  return alle.length === 1 && alle[0].id === eintrag.id;
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

/** Speichert Übungsliste bzw. Art des laufenden Trainings; bei Fehler gilt wieder `alt`. */
async function speichereTraining(neu, alt) {
  try {
    await mitSpeicherstatus(() => db.speichereTraining(neu));
    // Bearbeiten: Art/Übungen eines beendeten Trainings geändert, Verlauf und Start laden beim Öffnen.
    if (lauf?.modus === 'bearbeiten') window.dispatchEvent(new Event('gym-daten-veraltet'));
  } catch {
    if (lauf?.training === neu) {
      setzeTraining(alt);
      zeichne();
    }
    zeigeSpeicherFehler();
  }
}

function hinzufuegen() {
  oeffneHinzufuegen({
    art: artVon(lauf.training.artId),
    uebungen: [...lauf.uebungen.values()],
    letztesMal: lauf.auswahl,
    beiNeu: (u) => {
      lauf.uebungen.set(u.id, u);
      daten.uebungen.push(u);
    },
    beiWahl: (u) => {
      if (!lauf.training.uebungIds.includes(u.id)) {
        const alt = lauf.training;
        setzeTraining({ ...alt, uebungIds: [...alt.uebungIds, u.id] });
        speichereTraining(lauf.training, alt);
        zeichne();
      }
      oeffneSatzFuer(u);
    }
  });
}

function karte(uebung) {
  const wert = imBearbeiten() ? null : karteVorschlagText(uebung, lauf.letztesMal.get(uebung.id));
  return h('div', { class: 'ex', 'data-uebung': uebung.id },
    h('div', { class: 'top' }, h('b', { text: uebung.name }), wert && h('small', { text: wert })),
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
  const bearbeiten = imBearbeiten();
  fussKnopf.textContent = bearbeiten ? 'Fertig' : 'Training beenden';

  trainingInhalt.replaceChildren(
    h('div', { class: 'navbar' },
      bearbeiten ? zurueckKnopf(schliesseBearbeiten, 'Verlauf') : zurueckKnopf(zurStartseite),
      h('button', { class: 'link', type: 'button', text: 'Art ändern', onclick: artAendern })),
    h('h1', { class: 'largetitle', text: art.name }),
    bearbeiten
      ? h('div', { class: 'subtitle bearbeiten' },
        h('span', { class: 'laeuft-seit', text: `${tagKurz(t.startedAt)} · ${uhrzeit(t.startedAt)}–${uhrzeit(t.endedAt)}` }), speicherstatus)
      : h('div', { class: 'subtitle running' }, h('span', { class: 'dot' }),
        h('span', { class: 'laeuft-seit', text: `läuft seit ${uhrzeit(t.startedAt)}` }), speicherstatus),
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

/**
 * „Training beenden“: mit mindestens einem Satz erst die Rückfrage (Design 0.5.2, Punkt 3), ohne Satz
 * die Verwerfen-Frage. Antippen außerhalb = Nein. Nur „Ja“ beendet.
 */
async function beenden() {
  if (!lauf) return;
  if (eintraege().length === 0) {
    await frageUndVerwerfe();
    return;
  }
  const wahl = await zeigeAlert({
    titel: 'Willst du das Training wirklich beenden?',
    text: 'Das Training wird gespeichert.',
    aussenNein: true,
    textGrau: true,
    knoepfe: [{ id: 'nein', label: 'Nein', fett: true }, { id: 'ja', label: 'Ja', rot: JA_BEENDEN_ROT }]
  });
  if (wahl !== 'ja' || !lauf) return;
  await beendenSpeichern();
}

/**
 * F5: Zuerst nur das Ende-Datum sicher schreiben. Klappt das nicht, bleibt das Training laufend und
 * es kommt der Hinweis „Speichern hat nicht geklappt – nochmal tippen“. Danach stellt die Oberfläche
 * ohne weitere Datenbank-Arbeit auf Start um; Nebenschritte laufen außerhalb der Sperre.
 */
const beendenSpeichern = einmalig(async () => {
  if (!lauf) return;
  const training = lauf.training;
  const art = artVon(training.artId);
  const alle = eintraege();
  const anzahlUebungen = new Set(alle.map((e) => e.uebungId)).size;
  const gespeichert = `${art?.name || 'Das Training'} mit ${anzahlUebungen} ${anzahlUebungen === 1 ? 'Übung' : 'Übungen'} und ${alle.length} ${alle.length === 1 ? 'Satz' : 'Sätzen'} ist gespeichert.`;
  const beendet = { ...training, endedAt: new Date().toISOString() };
  try {
    await mitSpeicherstatus(() => db.speichereTraining(beendet));
  } catch {
    zeigeSpeicherFehler();
    return;
  }
  // Ab hier ist das Training beendet. Nur noch der Speicher im Arbeitsspeicher wird angepasst.
  const i = daten.trainings.findIndex((t) => t.id === beendet.id);
  if (i >= 0) daten.trainings[i] = beendet;
  laufend = null;
  festVorschlag = null;
  clearInterval(pruefTimer);
  pruefTimer = null;
  zurStartseite();
  window.dispatchEvent(new Event('gym-daten-veraltet'));
  nachDemBeenden(beendet.id, gespeichert);
}, 'Training beenden');

/** Muskel-Übersicht, „Jetzt sichern?“ und Punkt am Glas-Knopf: dürfen nie die App sperren. */
async function nachDemBeenden(trainingId, gespeichert) {
  try {
    await zeigeTrainingsUebersicht(daten, trainingId);
  } catch (e) {
    protokolliere('Nach dem Beenden', `Muskel-Übersicht: ${e?.name || 'Fehler'}`);
  }
  try {
    await frageJetztSichern(gespeichert);
  } catch (e) {
    protokolliere('Nach dem Beenden', `Jetzt sichern?: ${e?.name || 'Fehler'}`);
  }
  aktualisierePunkt().catch(() => {});
}

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
            const alt = lauf.training;
            setzeTraining({
              ...alt,
              artId: a.id,
              uebungIds: hatEintraege ? alt.uebungIds : letzteUebungen(daten, a.id, alt.id)
            });
            speichereTraining(lauf.training, alt);
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
