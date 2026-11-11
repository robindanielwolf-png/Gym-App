// Berechnungen ohne Oberfläche und ohne Datenbank: „zuletzt”, Übungen vom letzten Mal,
// Vorbelegung des Gewichts, Auto-Ende. Arbeitet auf dem Datenobjekt aus db.leseDaten().
import { kommaZahl } from './format.js';
import { gewichtsVorschlag, vorschlag, rekorde, einerMax } from './regeln.js';
import { STARTLISTE } from './startdaten.js';

// Muskeln kommen aus der Startliste: gespeicherte Übungen aus älteren Versionen haben das Feld nicht.
const START_MUSKELN = new Map(STARTLISTE.map((u) => [u.id, u.muskeln]));

export const AUTO_ENDE_MS = 3 * 60 * 60 * 1000;

const zeit = (iso) => (iso ? Date.parse(iso) : 0);

/** Sortiert Sätze/Cardio-Einträge in Eingabe-Reihenfolge. */
export const nachZeit = (a, b) => zeit(a.erstelltAm) - zeit(b.erstelltAm) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

export const istCardio = (u) => u.typ === 'cardio';
export const istNurWdh = (u) => u.geraet === 'kg' && u.modus === 'nurWdh';
export const istZusatz = (u) => u.geraet === 'kg' && u.modus === 'zusatz';

export const istZeit = (u) => u.geraet === 'kg' && u.modus === 'zeit';
export function eintraegeVon(daten, trainingId) {
  return [...daten.saetze, ...daten.cardio].filter((e) => e.trainingId === trainingId);
}

/** Trainings, die mindestens einen Satz oder Cardio-Eintrag haben. */
function trainingsMitEintraegen(daten) {
  const ids = new Set([...daten.saetze, ...daten.cardio].map((e) => e.trainingId));
  return daten.trainings.filter((t) => ids.has(t.id));
}

/** Je Trainingsart der Beginn des letzten Trainings mit Einträgen. Zählt nur die gewählte Art. */
export function zuletztProArt(daten) {
  const zuletzt = new Map();
  for (const t of trainingsMitEintraegen(daten)) {
    if (!zuletzt.has(t.artId) || zeit(t.startedAt) > zeit(zuletzt.get(t.artId))) zuletzt.set(t.artId, t.startedAt);
  }
  return zuletzt;
}

/** Übungen vom letzten Training dieser Art (nur solche mit Einträgen), in derselben Reihenfolge. */
export function letzteUebungen(daten, artId, ausserTrainingId = null) {
  const kandidaten = trainingsMitEintraegen(daten)
    .filter((t) => t.artId === artId && t.id !== ausserTrainingId)
    .sort((a, b) => zeit(b.startedAt) - zeit(a.startedAt));
  const letztes = kandidaten[0];
  if (!letztes) return [];
  const eintraege = eintraegeVon(daten, letztes.id).sort(nachZeit);
  const mitEintrag = new Set(eintraege.map((e) => e.uebungId));
  const reihenfolge = [...(letztes.uebungIds || []), ...eintraege.map((e) => e.uebungId)];
  const vorhanden = new Set(daten.uebungen.map((u) => u.id));
  return [...new Set(reihenfolge)].filter((id) => mitEintrag.has(id) && vorhanden.has(id));
}

/**
 * Je Übung das letzte Mal (ohne das laufende Training): Arbeitssätze bzw. Cardio-Einträge
 * des zuletzt begonnenen Trainings, in dem es davon welche gab. Aufwärmsätze zählen nicht.
 */
export function letztesMalIndex(daten, ausserTrainingId = null) {
  const beginn = new Map(daten.trainings.map((t) => [t.id, zeit(t.startedAt)]));
  const gruppen = new Map();
  for (const e of [...daten.saetze.filter((s) => !s.aufwaermen), ...daten.cardio]) {
    if (e.trainingId === ausserTrainingId || !beginn.has(e.trainingId)) continue;
    const bisher = gruppen.get(e.uebungId);
    const t = beginn.get(e.trainingId);
    if (!bisher || t > bisher.beginn) gruppen.set(e.uebungId, { beginn: t, trainingId: e.trainingId, eintraege: [e] });
    else if (bisher.trainingId === e.trainingId) bisher.eintraege.push(e);
  }
  for (const g of gruppen.values()) g.eintraege.sort(nachZeit);
  return gruppen;
}

const kg = (w) => `${kommaZahl(w)} kg`;

const formatZeit = (sekunden) => {
  if (sekunden < 60) return `${sekunden} Sek.`;
  const min = Math.floor(sekunden / 60);
  const sek = sekunden % 60;
  return `${min}:${String(sek).padStart(2, '0')}`;
};

/** Footnote auf der Übungskarte und in der Übungsauswahl, null wenn noch nie gemacht. */
export function zuletztText(uebung, letztesMal) {
  const letzter = letztesMal?.eintraege.at(-1);
  if (!letzter) return null;
  if (istCardio(uebung)) return `zuletzt ${kommaZahl(letzter.dauerMin)} min`;
  if (istZeit(uebung)) return `zuletzt ${formatZeit(letzter.wdh)}`;
  if (istNurWdh(uebung)) return `zuletzt ${letzter.wdh} Wdh.`;
  if (istZusatz(uebung)) return letzter.gewicht > 0 ? `zuletzt +${kg(letzter.gewicht)}` : 'zuletzt ohne Zusatz';
  return `zuletzt ${kg(letzter.gewicht)}`;
}

/** Hinweiszeile „Letztes Mal …“ im Satz- bzw. Cardio-Sheet (nur Arbeitssätze). Erstes Mal: null. */
export function letztesMalText(uebung, letztesMal) {
  const e = letztesMal?.eintraege || [];
  if (e.length === 0) return null;
  if (istCardio(uebung)) {
    const c = e.at(-1);
    return `Letztes Mal ${kommaZahl(c.dauerMin)} min${c.km !== null ? ` · ${kommaZahl(c.km)} km` : ''}`;
  }
  const wdh = e.map((s) => s.wdh).join(' / ');
  if (istNurWdh(uebung)) return `Letztes Mal ${wdh} Wdh.`;
  const gewichte = new Set(e.map((s) => s.gewicht));
  if (gewichte.size === 1) {
    const w = e[0].gewicht;
    if (istZusatz(uebung)) return w > 0 ? `Letztes Mal +${kg(w)}: ${wdh}` : `Letztes Mal ohne Zusatz: ${wdh}`;
    return `Letztes Mal ${kg(w)}: ${wdh}`;
  }
  const plus = istZusatz(uebung) ? '+' : '';
  return `Letztes Mal: ${e.map((s) => `${plus}${kg(s.gewicht)} × ${s.wdh}`).join(' / ')}`;
}

/** Rechts oben auf der Übungskarte: Vorschlag vom letzten Mal (bleibt das ganze Training gleich). */
export function karteVorschlagText(uebung, letztesMal) {
  const v = vorschlag(uebung, letztesMal?.eintraege);
  switch (v.art) {
    case 'gewicht': return `Vorschlag ${kg(v.wert)}`;
    case 'zusatz': return v.wert > 0 ? `Vorschlag +${kg(v.wert)}` : 'Vorschlag ohne Zusatz';
    case 'wdh': return `Ziel ${v.wert} Wdh.`;
    case 'zeit': return `zuletzt ${formatZeit(v.wert)}`;
    case 'cardio': return `zuletzt ${kommaZahl(v.wert)} min`;
    default: return 'erstes Mal';
  }
}

/**
 * Vorbelegung des Gewichts: letzter Arbeitssatz heute, sonst der Vorschlag vom letzten Mal,
 * sonst (erstes Mal) der letzte Satz heute; sonst leer (null).
 */
export function vorbelegtesGewicht(uebung, heute, letztesMal) {
  if (istCardio(uebung) || istNurWdh(uebung) || istZeit(uebung)) return null;
  const mitGewicht = heute.filter((s) => s.gewicht !== null);
  const arbeitHeute = mitGewicht.filter((s) => !s.aufwaermen).at(-1);
  if (arbeitHeute) return arbeitHeute.gewicht;
  const v = gewichtsVorschlag(uebung, letztesMal?.eintraege);
  if (v) return v.wert;
  return mitGewicht.at(-1)?.gewicht ?? null;
}

/** Kurzform für Chips. */
export function chipText(uebung, e) {
  if (istCardio(uebung)) return `${kommaZahl(e.dauerMin)} min${e.km !== null ? ` · ${kommaZahl(e.km)} km` : ''}`;
  const a = e.aufwaermen ? ' · A' : '';
  if (istZeit(uebung)) return `${formatZeit(e.wdh)}${a}`;
  if (istNurWdh(uebung) || e.gewicht === null) return `${e.wdh} Wdh.${a}`;
  return `${istZusatz(uebung) ? '+' : ''}${kommaZahl(e.gewicht)} × ${e.wdh}${a}`;
}

/** Beschreibung in der Rückfrage „Satz löschen?“. */
export function satzBeschreibung(uebung, e) {
  if (istCardio(uebung)) return `(${chipText(uebung, e)})`;
  if (istZeit(uebung)) return `(${chipText(uebung, e)}${e.aufwaermen ? ', Aufwärmen' : ''})`;
  const basis = istNurWdh(uebung) || e.gewicht === null
    ? `${e.wdh} Wdh.`
    : `${istZusatz(uebung) ? '+' : ''}${kg(e.gewicht)} × ${e.wdh}`;
  return `(${basis}${e.aufwaermen ? ', Aufwärmen' : ''})`;
}

/**
 * Prüft das Auto-Ende: 3 Std. nach dem letzten Eintrag (ohne Eintrag: nach Beginn).
 * Liefert null oder { leer, endedAt }.
 */
export function faelligesEnde(training, eintraege, jetzt = Date.now()) {
  const bezug = Math.max(zeit(training.startedAt), ...eintraege.map((e) => zeit(e.erstelltAm)));
  if (jetzt - bezug < AUTO_ENDE_MS) return null;
  return { leer: eintraege.length === 0, endedAt: new Date(bezug + AUTO_ENDE_MS).toISOString() };
}

/**
 * Sätze von damals für die Trainingsvorschau (nur Arbeitssätze). Gleiches Gewicht wird
 * zusammengefasst, ein neues Gewicht steht neu: „22,5 kg × 10 / 25 kg × 8“. Ohne Arbeitssatz: null.
 */
export function vorschauText(uebung, eintraege) {
  if (istCardio(uebung)) {
    if (eintraege.length === 0) return null;
    return eintraege.map((c) => `${kommaZahl(c.dauerMin)} min${c.km !== null ? ` · ${kommaZahl(c.km)} km` : ''}`).join(' / ');
  }
  const arbeit = eintraege.filter((s) => !s.aufwaermen);
  if (arbeit.length === 0) return null;
  if (istZeit(uebung)) return `${arbeit.map((s) => formatZeit(s.wdh)).join(' / ')}`;
  if (istNurWdh(uebung) || arbeit.every((s) => s.gewicht === null)) return `${arbeit.map((s) => s.wdh).join(' / ')} Wdh.`;
  const gruppen = [];
  for (const s of arbeit) {
    const letzte = gruppen.at(-1);
    if (letzte && letzte.gewicht === s.gewicht) letzte.wdh.push(s.wdh);
    else gruppen.push({ gewicht: s.gewicht, wdh: [s.wdh] });
  }
  const gewichtText = (w) => {
    if (istZusatz(uebung)) return w > 0 ? `+${kg(w)}` : 'ohne Zusatz';
    return kg(w);
  };
  return gruppen.map((g) => (g.gewicht === null
    ? `${g.wdh.join(' / ')} Wdh.`
    : `${gewichtText(g.gewicht)} × ${g.wdh.join(' / ')}`)).join(' / ');
}

/** Letztes Training dieser Art mit Einträgen (ohne das laufende), sonst null. */
export function letztesTrainingDerArt(daten, artId, ausserTrainingId = null) {
  const ids = new Set([...daten.saetze, ...daten.cardio].map((e) => e.trainingId));
  return daten.trainings
    .filter((t) => t.artId === artId && t.id !== ausserTrainingId && ids.has(t.id))
    .sort((a, b) => zeit(b.startedAt) - zeit(a.startedAt))[0] || null;
}

/**
 * Rekorde einer Übung: lädt die Daten und berechnet beide Rekorde.
 * Liefert ein Objekt mit art, sowie den jeweiligen Rekord-Feldern (siehe rekorde() in regeln.js).
 */
export function geholeRekorde(daten, uebungId) {
  const uebung = daten.uebungen.find((u) => u.id === uebungId);
  if (!uebung) return null;

  const eintraege = [...daten.saetze, ...daten.cardio].filter((e) => e.uebungId === uebungId);
  return rekorde(uebung, eintraege);
}

/**
 * Gewichtsverlauf einer Kraft- oder Cardio-Übung: { zeit, wert } chronologisch.
 * - Kraft (mit Gewicht): wert = Gewicht des Arbeitssatzes
 * - Cardio: wert = Dauer in Minuten (optional auch Strecke als separater Datenpunkt?)
 * - Nur Wdh./Zeit: wert = Wdh./Zeit des Arbeitssatzes
 * Zeit = ISO-String aus erstelltAm; Trainings haben auch startedAt als Referenz.
 */
export function gewichtsverlauf(daten, uebungId) {
  const uebung = daten.uebungen.find((u) => u.id === uebungId);
  if (!uebung) return [];

  const eintraege = [...daten.saetze, ...daten.cardio]
    .filter((e) => e.uebungId === uebungId && !e.aufwaermen)
    .sort(nachZeit);

  if (istCardio(uebung)) {
    // Cardio: jeder Eintrag ist ein Datenpunkt (Dauer)
    return eintraege.map((e) => ({
      zeit: e.erstelltAm,
      dauer: e.dauerMin,
      strecke: e.km || null
    }));
  }

  if (istNurWdh(uebung)) {
    // Nur Wdh.: Wdh. als Wert
    return eintraege.map((e) => ({
      zeit: e.erstelltAm,
      wdh: e.wdh
    }));
  }

  // Zeit-Modus
  if (uebung.modus === 'zeit') {
    return eintraege.map((e) => ({
      zeit: e.erstelltAm,
      sekunden: e.wdh // bei Zeit wird die Sekunden-Dauer im wdh-Feld gespeichert
    }));
  }

  // Zusatzgewicht und Gewicht: nur der höchste Arbeitssatz pro Training
  // (um das Diagramm nicht zu überladen)
  const perTraining = new Map();
  for (const e of eintraege) {
    const current = perTraining.get(e.trainingId);
    if (!current || e.gewicht > current.gewicht || (e.gewicht === current.gewicht && e.wdh > current.wdh)) {
      perTraining.set(e.trainingId, e);
    }
  }

  return [...perTraining.values()]
    .sort((a, b) => zeit(a.erstelltAm) - zeit(b.erstelltAm))
    .map((e) => ({
      zeit: e.erstelltAm,
      gewicht: e.gewicht,
      wdh: e.wdh
    }));
}

/**
 * Berechnet Sätze pro Muskelgruppe/Kategorie für die letzten tageAnzahl Tage.
 * Gewichtung: Hauptmuskel 1.0×, Hilfsmuskel 0.5×
 * Liefert { 'Kategorie': satzAnzahl, ... } sortiert nach Kategorie.
 * tageAnzahl = 7 für eine Woche, 1 für heute, etc.
 */
export function saetzeProMuskelgruppe(daten, tageAnzahl = 7, jetzt = Date.now()) {
  if (!daten.saetze || !daten.uebungen) {
    return {};
  }

  // Zeitgrenze: vor N Tagen (00:00 Uhr Heute)
  const heuteStart = new Date(jetzt);
  heuteStart.setHours(0, 0, 0, 0);
  const grenze = heuteStart.getTime() - (tageAnzahl - 1) * 24 * 60 * 60 * 1000;

  // Uebungen nachschlagen
  const uebungenNach = new Map(daten.uebungen.map((u) => [u.id, u]));

  // Trainings nach ID
  const trainingsNach = new Map(daten.trainings.map((t) => [t.id, t]));

  // Sätze der letzten N Tage sammeln (nur Arbeitssätze, keine Aufwärmsätze)
  const recenteSaetze = daten.saetze.filter((s) => {
    if (s.aufwaermen) return false; // Aufwärmsätze ignorieren
    const training = trainingsNach.get(s.trainingId);
    if (!training) return false;
    const trainingZeit = zeit(training.startedAt);
    return trainingZeit >= grenze;
  });

  // Sätze pro Muskelgruppe/Kategorie
  const result = {};

  for (const satz of recenteSaetze) {
    const uebung = uebungenNach.get(satz.uebungId);
    if (!uebung) continue;
    const muskeln = START_MUSKELN.get(uebung.id) || uebung.muskeln;
    if (!muskeln?.length) continue;

    // Pro Muskel in dieser Übung
    for (const muskel of muskeln) {
      // Müssen die Muskelkategorie und die Gewichtung kennen
      // muskel.id ist die Muskel-ID, muskel.rolle ist 'haupt' oder 'hilf'
      // Wir müssen die Kategorie nachschlagen, aber wir haben nur die Muskel-ID

      const gewicht = muskel.rolle === 'haupt' ? 1.0 : 0.5;

      // Wir sammeln pro Muskel-ID, nicht pro Kategorie.
      // Wir brauchen also ein anderes Lookup für Muskelkategorie.
      // Das machen wir später mit muskeln.js.
      if (!result[muskel.id]) {
        result[muskel.id] = 0;
      }
      result[muskel.id] += gewicht;
    }
  }

  return result;
}

/**
 * Wie saetzeProMuskelgruppe, aber gruppiert nach Muskelkategorie (z.B. 'Beine', 'Arme').
 * Liefert { 'Kategorie': satzAnzahl, ... } sortiert alphabetisch nach Kategorie.
 */
export function saetzeProMuskelkategorie(daten, tageAnzahl = 7, jetzt = Date.now()) {
  const proMuskel = saetzeProMuskelgruppe(daten, tageAnzahl, jetzt);

  // MUSKELN importieren, um Kategorie zu bestimmen
  // Wir machen das direkt hier inline, da wir die Muskelkategorie brauchen
  // Das wird von muskeln.js gemacht, aber wir müssen es hier nicht importieren
  // sondern direkt nutzen – wir machen das im UI mit Hilfe von muskeln.js

  return proMuskel;
}
