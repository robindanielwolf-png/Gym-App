// Muskelgruppen und Punkte-Regel für Muskelfigur und Statistik. Ohne Oberfläche und ohne Datenbank.
// Regel, Stufen und Testfälle M1–M13: Trainingsexperte, Muskeldaten.md.
import { MUSKELN, MUSKELN_JE_UEBUNG } from './startdaten.js';

export { MUSKELN };
export const MUSKELN_NACH = new Map(MUSKELN.map((m) => [m.id, m]));

const REFERENZ_ANFANG = { nurWdh: 20, zeit: 60 };
const GRENZEN = { training: [2.5, 5], tage7: [5, 10] };

const zeit = (iso) => (iso ? Date.parse(iso) : 0);
const rund = (x) => Math.round(x * 1000) / 1000;
const schnitt = (werte) => werte.reduce((a, b) => a + b, 0) / werte.length;

/** Muskeln einer Übung als [{ id, rolle: 'haupt' | 'hilf' }]; Cardio und eigene Übungen ohne Auswahl: []. */
export function muskelnVon(uebung) {
  const m = MUSKELN_JE_UEBUNG[uebung.id] || uebung.muskeln;
  if (!m) return [];
  return [...(m.p || []).map((id) => ({ id, rolle: 'haupt' })), ...(m.s || []).map((id) => ({ id, rolle: 'hilf' }))];
}

/**
 * Punkte je Muskel aus den Arbeitssätzen der angegebenen Trainings: Rolle (1 bzw. 0,5) × Satzfaktor.
 * Satzfaktor 1 bei Gewicht/Zusatzgewicht; bei „Nur Wdh.“ und „Zeit“ min(0,75; 0,5 × Wert ÷ Referenz),
 * Referenz = Ø Wert pro Arbeitssatz der letzten bis zu 5 Male davor, beim 1.–3. Mal 20 Wdh. bzw. 60 s.
 */
export function muskelPunkte(daten, trainingIds) {
  const gesucht = new Set(trainingIds);
  const beginn = new Map(daten.trainings.map((t) => [t.id, zeit(t.startedAt)]));
  const uebungen = new Map(daten.uebungen.map((u) => [u.id, u]));
  const proUebung = new Map();
  for (const s of daten.saetze) {
    if (s.aufwaermen || !beginn.has(s.trainingId)) continue;
    if (!proUebung.has(s.uebungId)) proUebung.set(s.uebungId, new Map());
    const male = proUebung.get(s.uebungId);
    if (!male.has(s.trainingId)) male.set(s.trainingId, []);
    male.get(s.trainingId).push(s);
  }

  const punkte = {};
  for (const [uebungId, male] of proUebung) {
    const uebung = uebungen.get(uebungId);
    const muskeln = uebung ? muskelnVon(uebung) : [];
    if (muskeln.length === 0) continue;
    const ohneGewicht = uebung.geraet === 'kg' && (uebung.modus === 'nurWdh' || uebung.modus === 'zeit');
    const reihe = [...male.keys()].sort((a, b) => beginn.get(a) - beginn.get(b));
    reihe.forEach((trainingId, i) => {
      if (!gesucht.has(trainingId)) return;
      let referenz = REFERENZ_ANFANG[uebung.modus] || 20;
      if (ohneGewicht && i >= 3) referenz = schnitt(reihe.slice(Math.max(0, i - 5), i).flatMap((t) => male.get(t).map((s) => s.wdh)));
      for (const satz of male.get(trainingId)) {
        const faktor = ohneGewicht ? Math.min(0.75, (0.5 * satz.wdh) / referenz) : 1;
        for (const { id, rolle } of muskeln) punkte[id] = (punkte[id] || 0) + (rolle === 'haupt' ? 1 : 0.5) * faktor;
      }
    });
  }
  for (const id of Object.keys(punkte)) punkte[id] = rund(punkte[id]);
  return punkte;
}

/** Farbstufe 0–3; zeitraum 'training' (ein Training) oder 'tage7' (Startseite). */
export function muskelStufe(punkte, zeitraum) {
  if (!(punkte > 0)) return 0;
  const [eins, zwei] = GRENZEN[zeitraum];
  if (punkte <= eins) return 1;
  return punkte <= zwei ? 2 : 3;
}

/** Trainings, die heute oder in den tage − 1 Kalendertagen davor begonnen haben. */
export function trainingsDerLetztenTage(daten, tage, jetzt = new Date()) {
  const ab = new Date(jetzt.getFullYear(), jetzt.getMonth(), jetzt.getDate() - (tage - 1)).getTime();
  return daten.trainings.filter((t) => zeit(t.startedAt) >= ab).map((t) => t.id);
}
