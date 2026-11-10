// Berechnungen ohne Oberfläche und ohne Datenbank: „zuletzt“, Übungen vom letzten Mal,
// Vorbelegung des Gewichts, Auto-Ende. Arbeitet auf dem Datenobjekt aus db.leseDaten().
import { kommaZahl } from './format.js';

export const AUTO_ENDE_MS = 3 * 60 * 60 * 1000;

const zeit = (iso) => (iso ? Date.parse(iso) : 0);

/** Sortiert Sätze/Cardio-Einträge in Eingabe-Reihenfolge. */
export const nachZeit = (a, b) => zeit(a.erstelltAm) - zeit(b.erstelltAm) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

export const istCardio = (u) => u.typ === 'cardio';
export const istNurWdh = (u) => u.geraet === 'kg' && u.modus === 'nurWdh';
export const istZusatz = (u) => u.geraet === 'kg' && u.modus === 'zusatz';

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

/** Footnote auf der Übungskarte und in der Übungsauswahl, null wenn noch nie gemacht. */
export function zuletztText(uebung, letztesMal) {
  const letzter = letztesMal?.eintraege.at(-1);
  if (!letzter) return null;
  if (istCardio(uebung)) return `zuletzt ${kommaZahl(letzter.dauerMin)} min`;
  if (istNurWdh(uebung)) return `zuletzt ${letzter.wdh} Wdh.`;
  if (istZusatz(uebung)) return letzter.gewicht > 0 ? `zuletzt +${kg(letzter.gewicht)}` : 'zuletzt ohne Zusatz';
  return `zuletzt ${kg(letzter.gewicht)}`;
}

/** Hinweiszeile im Satz- bzw. Cardio-Sheet. Cardio ohne letztes Mal: null. */
export function letztesMalText(uebung, letztesMal) {
  const e = letztesMal?.eintraege || [];
  if (istCardio(uebung)) {
    const c = e.at(-1);
    if (!c) return null;
    return `Letztes Mal ${kommaZahl(c.dauerMin)} min${c.km !== null ? ` · ${kommaZahl(c.km)} km` : ''}`;
  }
  if (e.length === 0) return 'Noch kein Vorschlag';
  const wdh = e.map((s) => s.wdh).join(' / ');
  if (istNurWdh(uebung)) return `Letztes Mal: ${wdh} Wdh.`;
  const gewichte = new Set(e.map((s) => s.gewicht));
  if (gewichte.size === 1) {
    const w = e[0].gewicht;
    if (istZusatz(uebung)) return w > 0 ? `Letztes Mal +${kg(w)}: ${wdh}` : `Letztes Mal ohne Zusatz: ${wdh}`;
    return `Letztes Mal ${kg(w)}: ${wdh}`;
  }
  const plus = istZusatz(uebung) ? '+' : '';
  return `Letztes Mal: ${e.map((s) => `${plus}${kg(s.gewicht)} × ${s.wdh}`).join(' / ')}`;
}

/** Gewicht des letzten Satzes dieser Übung: heute, sonst letztes Mal, sonst leer (null). */
export function vorbelegtesGewicht(uebung, heute, letztesMal) {
  if (istCardio(uebung) || istNurWdh(uebung)) return null;
  const heuteLetzter = heute.filter((s) => s.gewicht !== null).at(-1);
  if (heuteLetzter) return heuteLetzter.gewicht;
  return letztesMal?.eintraege.at(-1)?.gewicht ?? null;
}

/** Kurzform für Chips. */
export function chipText(uebung, e) {
  if (istCardio(uebung)) return `${kommaZahl(e.dauerMin)} min${e.km !== null ? ` · ${kommaZahl(e.km)} km` : ''}`;
  const a = e.aufwaermen ? ' · A' : '';
  if (istNurWdh(uebung) || e.gewicht === null) return `${e.wdh} Wdh.${a}`;
  return `${istZusatz(uebung) ? '+' : ''}${kommaZahl(e.gewicht)} × ${e.wdh}${a}`;
}

/** Beschreibung in der Rückfrage „Satz löschen?“. */
export function satzBeschreibung(uebung, e) {
  if (istCardio(uebung)) return `(${chipText(uebung, e)})`;
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
