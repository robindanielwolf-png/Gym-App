// Aufbau und Prüfung der Sicherungsdatei. Ohne Zugriff auf Oberfläche oder Datenbank.
import { SCHEMA_VERSION, STORE_SEIT_SCHEMA, DATEN_STORES, ergaenzeDaten } from './db.js';
import { GERAETE, MODI, STARTLISTE } from './startdaten.js';
import { APP_VERSION } from './version.js';

const FORMAT = 'gym-tracker-sicherung';
const GERAETE_IDS = new Set(GERAETE.map((g) => g.id));
const MODUS_IDS = new Set(MODI.map((m) => m.id));

export function baueSicherung(daten, jetzt = new Date()) {
  return { format: FORMAT, schemaVersion: SCHEMA_VERSION, appVersion: APP_VERSION, exportiertAm: jetzt.toISOString(), daten };
}

export function dateiname(jetzt = new Date()) {
  const zwei = (n) => String(n).padStart(2, '0');
  return `gym-tracker-sicherung-${jetzt.getFullYear()}-${zwei(jetzt.getMonth() + 1)}-${zwei(jetzt.getDate())}.json`;
}

export function zaehle(daten) {
  return { trainings: daten.trainings.length, eigene: daten.uebungen.filter((u) => u.eigen).length };
}

/** Leer heißt: keine Trainings, keine eigenen Übungen, keine geänderte Stufe, kein Körpergewicht. */
export function istLeer(daten) {
  const start = new Map(STARTLISTE.map((u) => [u.id, u.stufe]));
  const { trainings, eigene } = zaehle(daten);
  if (trainings > 0 || eigene > 0 || (daten.koerpergewicht || []).length > 0) return false;
  return daten.uebungen.every((u) => !start.has(u.id) || start.get(u.id) === u.stufe);
}

const istText = (w) => typeof w === 'string' && w.length > 0;
const istZahl = (w) => typeof w === 'number' && Number.isFinite(w);
const istObjekt = (w) => typeof w === 'object' && w !== null && !Array.isArray(w);
const istDatum = (w) => istText(w) && !Number.isNaN(Date.parse(w));
const datumOderNull = (w) => w === null || istDatum(w);

function eindeutigeIds(liste) {
  const ids = new Set();
  for (const e of liste) {
    if (!istObjekt(e) || !istText(e.id) || ids.has(e.id)) return null;
    ids.add(e.id);
  }
  return ids;
}

function datenGueltig(d) {
  const ids = {};
  for (const name of DATEN_STORES) {
    ids[name] = eindeutigeIds(d[name]);
    if (!ids[name]) return false;
  }

  const arten = d.trainingsarten.every((a) => istText(a.name) && istZahl(a.reihenfolge));
  const uebungen = d.uebungen.every((u) =>
    istText(u.name) && Array.isArray(u.artIds) && u.artIds.every((a) => ids.trainingsarten.has(a))
    && GERAETE_IDS.has(u.geraet) && typeof u.eigen === 'boolean'
    && (u.typ === 'cardio' ? u.stufe === null : u.typ === 'kraft' && istZahl(u.stufe) && u.stufe > 0)
    && (u.geraet === 'kg' ? MODUS_IDS.has(u.modus) : u.modus === null));
  const trainings = d.trainings.every((t) =>
    ids.trainingsarten.has(t.artId) && istDatum(t.startedAt) && datumOderNull(t.endedAt)
    && Array.isArray(t.uebungIds) && t.uebungIds.every((u) => ids.uebungen.has(u)));
  // Höchstens ein laufendes Training.
  const laufend = d.trainings.filter((t) => t.endedAt === null).length <= 1;
  const verweist = (e) => ids.trainings.has(e.trainingId) && ids.uebungen.has(e.uebungId) && datumOderNull(e.erstelltAm);
  const saetze = d.saetze.every((s) =>
    verweist(s) && (s.gewicht === null || (istZahl(s.gewicht) && s.gewicht >= 0))
    && Number.isInteger(s.wdh) && s.wdh > 0 && typeof s.aufwaermen === 'boolean');
  const cardio = d.cardio.every((c) =>
    verweist(c) && istZahl(c.dauerMin) && c.dauerMin > 0 && (c.km === null || (istZahl(c.km) && c.km >= 0)));

  const koerpergewicht = d.koerpergewicht.every((k) => istZahl(k.kg) && k.kg > 0);

  return arten && uebungen && trainings && laufend && saetze && cardio && koerpergewicht;
}

/** Prüft den vollständigen Dateiinhalt. Liefert die aufbereiteten Daten oder null. */
export function pruefeSicherung(text) {
  let datei;
  try {
    datei = JSON.parse(text.replace(/^﻿/, ''));
  } catch {
    return null;
  }
  if (!istObjekt(datei) || datei.format !== FORMAT) return null;
  const { schemaVersion, exportiertAm, daten } = datei;
  if (!Number.isInteger(schemaVersion) || schemaVersion < 1 || schemaVersion > SCHEMA_VERSION) return null;
  if (!istDatum(exportiertAm) || !istObjekt(daten)) return null;

  for (const name of DATEN_STORES) {
    if (STORE_SEIT_SCHEMA[name] > schemaVersion) daten[name] = daten[name] ?? [];
    if (!Array.isArray(daten[name])) return null;
  }
  for (const name of DATEN_STORES) {
    if (!daten[name].every(istObjekt)) return null;
  }

  ergaenzeDaten(daten, schemaVersion);
  if (!datenGueltig(daten)) return null;
  return { exportiertAm, daten };
}
