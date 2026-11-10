const MONATE = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
const zwei = (n) => String(n).padStart(2, '0');

/** 8. Nov 2026 */
export function datumLang(iso) {
  const d = new Date(iso);
  return `${d.getDate()}. ${MONATE[d.getMonth()]} ${d.getFullYear()}`;
}

/** 10. Nov 2026, 18:42 */
export function datumZeit(iso) {
  const d = new Date(iso);
  return `${datumLang(iso)}, ${zwei(d.getHours())}:${zwei(d.getMinutes())}`;
}

export function letzteSicherungText(iso, jetzt = new Date()) {
  if (!iso) return 'noch nie';
  const d = new Date(iso);
  const tag = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const tage = Math.round((tag(jetzt) - tag(d)) / 86400000);
  if (tage <= 0) return 'heute';
  if (tage === 1) return 'gestern';
  return `vor ${tage} Tagen`;
}

export function inhaltText({ trainings, eigene }) {
  if (trainings === 1) return '1 Training';
  if (trainings === 0 && eigene === 1) return '0 Trainings und 1 eigene Übung';
  if (trainings === 0 && eigene > 1) return `0 Trainings und ${eigene} eigene Übungen`;
  return `${trainings} Trainings`;
}

export const kommaZahl = (wert) => String(wert).replace('.', ',');

/** Zahl größer 0 aus einer Eingabe mit Komma oder Punkt, sonst null. */
export function positiveZahl(eingabe) {
  const text = eingabe.trim();
  if (!/^\d+([.,]\d+)?$/.test(text)) return null;
  const wert = Number(text.replace(',', '.'));
  return wert > 0 ? wert : null;
}
