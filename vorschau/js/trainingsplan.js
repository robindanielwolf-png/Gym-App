// Trainingsplan (Backlog #39, 0.6.0): Auswahl-Sheet „Trainingsplan“ und Wert der Zeile im Tab Training.
// Vorgaben: Design (Trainingsplan-Auswahl, 17.11.2026). Regeln und Stand: Trainingsexperte, db.js.
import * as db from './db.js';
import { TRAININGSARTEN, VORLAGEN } from './startdaten.js';
import { griff, h, icon, oeffneSheet, sheetKopf, zeigeSpeicherFehler } from './ui.js';

const WECHSEL_MS = 200;

const artName = (id) => TRAININGSARTEN.find((a) => a.id === id)?.name ?? id;

export const vorlageVon = (id) => VORLAGEN.find((v) => v.id === id) ?? null;

/** Wert in der Zeile „Trainingsplan“: Name der gewählten Vorlage oder „Ohne Plan“. */
export const planWert = (plan) => vorlageVon(plan?.vorlage)?.name ?? 'Ohne Plan';

const untertitel = (v) => `${v.tage.length} Tage: ${v.tage.map(artName).join(', ')}`;

/**
 * Auswahl-Sheet. Ein Tipp wählt sofort (Häkchen wandert), nach 200 ms schließt das Sheet.
 * Tipp auf die aktive Zeile ändert nichts. Schließen ohne Tipp ändert nichts.
 * plan: { vorlage, stand } oder null. beiGeaendert(neuerPlan) nach dem Speichern.
 * zurueck: nach dem Schließen (Fokus zurück auf die Zeile).
 */
export function oeffnePlanWahl({ plan, beiGeaendert, zurueck }) {
  const aktuell = plan?.vorlage ?? null;
  const zeilen = [];
  let gewaehlt = false;
  let schliessen = null;

  const waehle = (id, knopf) => {
    if (gewaehlt) return;
    gewaehlt = true;
    if (id !== aktuell) {
      for (const z of zeilen) {
        z.setAttribute('aria-checked', String(z === knopf));
        z.setAttribute('tabindex', z === knopf ? '0' : '-1');
        z.querySelector('.haken-platz').replaceChildren(...(z === knopf ? [icon('i-check', 'haken')] : []));
      }
    }
    setTimeout(() => schliessen?.(), WECHSEL_MS);
    if (id === aktuell) return;
    // Der Stand je Vorlage bleibt erhalten, auch wenn die Vorlage wechselt oder „Ohne Plan“ gewählt wird.
    const neu = { vorlage: id, stand: plan?.stand ?? {} };
    db.setzeTrainingsplan(neu).then(() => beiGeaendert(neu), () => zeigeSpeicherFehler());
  };

  // Radio-Muster: nur die aktive Zeile ist per Tab erreichbar, Pfeiltasten hoch/runter bewegen den Fokus.
  // Die aktive Zeile ist die, die in der Anzeige „Wert“ steht (unbekannte Vorlage zählt als „Ohne Plan“).
  const aktivId = vorlageVon(aktuell) ? aktuell : null;
  const pfeile = (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const i = zeilen.indexOf(e.target);
    if (i < 0) return;
    e.preventDefault();
    const n = (i + (e.key === 'ArrowDown' ? 1 : -1) + zeilen.length) % zeilen.length;
    zeilen[n].focus();
  };

  const zeile = (id, titel, sub) => {
    const aktiv = id === aktivId;
    const knopf = h('button', {
      class: 'row plan-zeile-row', type: 'button', role: 'radio', 'aria-checked': String(aktiv),
      tabindex: aktiv ? '0' : '-1', 'data-plan': id ?? 'ohne', onclick: () => waehle(id, knopf)
    },
    h('div', { class: 'main' }, h('div', { class: 't', text: titel }), sub && h('div', { class: 'st', text: sub })),
    h('span', { class: 'haken-platz', 'aria-hidden': 'true' }, aktiv ? icon('i-check', 'haken') : null));
    zeilen.push(knopf);
    return knopf;
  };

  const { el } = oeffneSheet({
    klasse: 'plan-sheet',
    beiZu: zurueck,
    baue: (zu) => {
      schliessen = zu;
      const kopf = sheetKopf('Trainingsplan', zu);
      kopf.querySelector('h2').id = 'plan-titel';
      return [
        griff(),
        kopf,
        h('div', { role: 'radiogroup', 'aria-labelledby': 'plan-titel', onkeydown: pfeile },
          h('div', { class: 'list plain auf-weiss kein-rand oben-12' }, VORLAGEN.map((v) => zeile(v.id, v.name, untertitel(v)))),
          h('div', { class: 'list plain auf-weiss kein-rand oben-24' }, zeile(null, 'Ohne Plan', 'Vorschlag: was am längsten her ist'))),
        h('div', { class: 'sheet-boden' })
      ];
    }
  });
  el.setAttribute('aria-labelledby', 'plan-titel');
}
