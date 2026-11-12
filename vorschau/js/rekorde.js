// Mehr → Rekorde (Backlog #33, Design Screen 09): Suche nach jeder Übung und bis zu 4 Hauptübungen mit Stern.
// Je Hauptübung: Rekordwert, Liniendiagramm über die Zeit und Umschalter Arbeitssatz-Max ↔ 1RM.
// Rechnung wie im Übungsdetail (uebungsdetail.js) und aus regeln.js (einerMax, rekorde).
import * as db from './db.js';
import { datumKurz, kommaZahl } from './format.js';
import { istCardio, istNurWdh, istZeit, istZusatz } from './logik.js';
import { einerMax, rekorde } from './regeln.js';
import { einmalig, griff, h, icon, leerHinweis, oeffneSheet, sheetKopf, zeigeHinweis } from './ui.js';
import { achse, messart, oeffneUebungsdetail, trainingsDerUebung } from './uebungsdetail.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
// Vorbelegung, solange noch nichts gewählt ist (IDs aus startdaten.js).
export const STANDARD_HAUPTUEBUNGEN = ['s-bankdruecken-frei', 's-kniebeuge', 's-kreuzheben', 's-klimmzuege'];
const HAUPT_MAX = 4;

const zeit = (iso) => (iso ? Date.parse(iso) : 0);

function svg(tag, attrs = {}) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

/** Gewichtsübungen ohne Zusatz, Wdh. und Zeit haben ein 1RM. */
const hatEinerMax = (u) => !istCardio(u) && !istNurWdh(u) && !istZeit(u) && !istZusatz(u);

/** Arten einer Übung: Arbeitssatz-Max (immer, wie im Übungsdetail) und 1RM (nur Gewichtsübungen). */
function artenVon(u) {
  return {
    basis: messart(u),
    einer: hatEinerMax(u) ? { titel: '1RM (kg)', wert: (e) => einerMax(e).wert, text: (w) => `${kommaZahl(w)} kg` } : null
  };
}

/** Punkte je Training, älteste zuerst; Werte von 0 zählen nicht (z. B. Zusatzgewicht ohne Zusatz). */
function punkteVon(daten, u, art) {
  return trainingsDerUebung(daten, u, art).filter((p) => p.wert > 0);
}

/** Liniendiagramm 315 × 112 (Design Screen 09), Achse wie im Übungsdetail. */
function minidiagramm(pk, art) {
  const B = 315, H = 112, L = 30, R = 308, O = 10, U = 88;
  const bild = svg('svg', { viewBox: `0 0 ${B} ${H}`, class: 'rk-chart', role: 'img', 'aria-label': art.titel });
  const werte = pk.map((p) => p.wert);
  const { unten, oben, ticks } = achse(Math.min(...werte), Math.max(...werte));
  const t0 = zeit(pk[0].training.startedAt);
  const t1 = zeit(pk.at(-1).training.startedAt);
  const x = (t) => (t1 === t0 ? (L + R) / 2 : L + ((t - t0) / (t1 - t0)) * (R - L));
  const y = (v) => O + (1 - (v - unten) / (oben - unten)) * (U - O);

  const raster = svg('g', { class: 'rk-raster' });
  const beschriftung = svg('g');
  for (const v of ticks) {
    raster.append(svg('line', { x1: L, x2: R, y1: y(v), y2: y(v) }));
    const text = svg('text', { x: L - 6, y: y(v) + 4, 'text-anchor': 'end' });
    text.textContent = kommaZahl(v);
    beschriftung.append(text);
  }
  const xy = pk.map((p) => [x(zeit(p.training.startedAt)), y(p.wert)]);
  const letzter = xy.at(-1);
  bild.append(raster, beschriftung,
    svg('polyline', { class: 'rk-linie', points: xy.map((p) => p.join(',')).join(' ') }),
    ...xy.map(([cx, cy]) => svg('circle', { class: 'rk-punkt', cx, cy, r: 2.6 })),
    svg('circle', { class: 'rk-letzter', cx: letzter[0], cy: letzter[1], r: 5 }));
  return bild;
}

/**
 * Füllt den Platz (slot) der Unterseite Mehr → Rekorde. Gibt die Funktion zurück, die beim Öffnen
 * und nach Datenänderungen die Daten neu lädt.
 */
export function initRekorde(slot) {
  let daten = null;
  let haupt = [];
  const modusWahl = new Map(); // Übungs-ID → 'einer', sonst Arbeitssatz-Max
  const eingabe = h('input', {
    type: 'search',
    placeholder: 'Übung suchen',
    'aria-label': 'Übung suchen',
    oninput: () => zeichne()
  });
  const inhalt = h('div');
  slot.replaceChildren(
    h('div', { class: 'title-row' }, h('h1', { class: 'largetitle', text: 'Rekorde' })),
    h('div', { class: 'search rk-suche' }, icon('i-search', 's16'), eingabe),
    inhalt);

  const umschalten = async (u) => {
    let neu;
    if (haupt.includes(u.id)) {
      neu = haupt.filter((id) => id !== u.id);
    } else if (haupt.length >= HAUPT_MAX) {
      zeigeHinweis({ titel: 'Höchstens 4 Hauptübungen', text: 'Wähle zuerst eine ab (Stern antippen).', iconName: 'i-star' });
      return;
    } else {
      neu = [...haupt, u.id];
    }
    haupt = neu;
    zeichne();
    try {
      await db.setzeHauptuebungen(neu);
    } catch (e) {
      console.error('Hauptübungen konnten nicht gespeichert werden:', e);
    }
  };

  const stern = (u) => {
    const an = haupt.includes(u.id);
    return h('button', {
      class: `rk-stern${an ? ' on' : ''}`,
      type: 'button',
      'aria-label': an ? `${u.name} nicht mehr als Hauptübung` : `${u.name} als Hauptübung`,
      'aria-pressed': String(an),
      onclick: () => umschalten(u)
    }, icon('i-star', 's24'));
  };

  /** Kopfzeile der Karte: Rekordwert und Zusatz, wie in Screen 09. */
  const kopfText = (u, a, modus, pk, alle) => {
    if (modus === 'einer') {
      const r = rekorde(u, alle).einerMax;
      if (!r) return { wert: '–', unter: 'Noch kein Arbeitssatz' };
      const quelle = alle.find((e) => { const m = einerMax(e); return m.wert === r.wert && m.belegt === r.belegt; });
      const unter = r.belegt ? 'belegt · 1 Wdh.' : `geschätzt${quelle ? ` · aus ${kommaZahl(quelle.gewicht)} × ${quelle.wdh}` : ''}`;
      return { wert: `${kommaZahl(r.wert)} kg`, unter };
    }
    if (pk.length === 0) return { wert: '–', unter: 'Noch kein Arbeitssatz' };
    const best = pk.reduce((b, p) => (p.wert > b.wert || (p.wert === b.wert && zeit(p.training.startedAt) > zeit(b.training.startedAt)) ? p : b));
    const datum = datumKurz(best.training.startedAt);
    const satz = best.eintraege.find((e) => a.basis.wert(e) === best.wert);
    const mitWdh = hatEinerMax(u) || istZusatz(u);
    return { wert: a.basis.text(best.wert), unter: mitWdh && satz ? `× ${satz.wdh} · ${datum}` : datum };
  };

  const karte = (u) => {
    const a = artenVon(u);
    const modus = a.einer && modusWahl.get(u.id) === 'einer' ? 'einer' : 'max';
    const art = modus === 'einer' ? a.einer : a.basis;
    const alle = trainingsDerUebung(daten, u, a.basis).flatMap((p) => p.eintraege);
    const pk = punkteVon(daten, u, art);
    const k = kopfText(u, a, modus, pk, alle);
    const umschalter = a.einer && h('div', { class: 'seg rk-seg' },
      [['max', 'Arbeitssatz-Max'], ['einer', '1RM']].map(([id, text]) => h('button', {
        type: 'button',
        class: id === modus ? 'on' : '',
        text,
        onclick: () => { modusWahl.set(u.id, id); zeichne(); }
      })));
    return h('div', { class: 'rk-karte' },
      h('div', { class: 'rk-kopf' },
        h('button', { class: 'rk-name', type: 'button', text: u.name, onclick: () => oeffneUebungsdetail(daten, u) }),
        stern(u)),
      h('div', { class: 'rk-wert', text: k.wert }),
      h('div', { class: 'rk-unter', text: k.unter }),
      pk.length > 0 && h('div', { class: 'rk-grafik', onclick: () => oeffneUebungsdetail(daten, u) }, minidiagramm(pk, art)),
      umschalter);
  };

  const hauptTeil = () => {
    const liste = haupt.map((id) => daten.uebungen.find((u) => u.id === id)).filter(Boolean);
    return [
      h('div', { class: 'section-h', text: 'Hauptübungen' }),
      liste.length
        ? h('div', { class: 'rk-liste' }, liste.map(karte))
        : leerHinweis({ iconName: 'i-star', headline: 'Noch keine Hauptübung', subhead: 'Suche eine Übung und tippe auf den Stern.' }),
      h('p', { class: 'foot-links', text: 'Bis zu 4 Hauptübungen. Stern antippen zum Wählen oder Abwählen.' })
    ];
  };

  const sucheTeil = (text) => {
    const treffer = daten.uebungen
      .filter((u) => u.name.toLowerCase().includes(text))
      .sort((a, b) => a.name.localeCompare(b.name, 'de'));
    if (treffer.length === 0) return [leerHinweis({ iconName: 'i-search', headline: 'Keine Übung gefunden' })];
    return [h('div', { class: 'list oben-16' }, treffer.map((u) =>
      h('div', { class: 'row rk-zeile' },
        h('button', { class: 'rk-name-knopf', type: 'button', onclick: () => oeffneUebungsdetail(daten, u), text: u.name }),
        stern(u))))];
  };

  const koerpergewichtZeile = () => {
    const kg = (daten.koerpergewicht || [])[0]?.kg || null;
    return h('div', { class: 'list oben-16' },
      h('button', { class: 'row', type: 'button', onclick: () => oeffneKoerpergewichtEdit(kg) },
        h('div', { class: 'main' },
          h('div', { class: 't', text: 'Körpergewicht' }),
          h('div', { class: 'val', text: kg !== null ? `${kommaZahl(kg)} kg` : '–' })),
        h('span', { class: 'weiter' }, icon('i-chev', 's16 chev'))));
  };

  function zeichne() {
    if (!daten) return;
    const text = eingabe.value.trim().toLowerCase();
    const teil = text ? sucheTeil(text) : hauptTeil();
    inhalt.replaceChildren(...teil, koerpergewichtZeile(), h('div', { class: 'abstand-16' }));
  }

  /** Körpergewicht bearbeiten (wie bisher auf dem Tab Rekorde). */
  function oeffneKoerpergewichtEdit(aktuellesKg) {
    const { schliessen } = oeffneSheet({
      klasse: 'kg-sheet',
      fokusBleibt: true,
      baue: (zu) => [
        griff(),
        sheetKopf('Körpergewicht', zu),
        h('div', { class: 'sheet-content' },
          h('div', { class: 'sheet-item' },
            h('label', { text: 'Gewicht (kg)' }),
            h('input', {
              id: 'kg-eingabe',
              type: 'number',
              step: '0.1',
              min: '0',
              value: aktuellesKg ? kommaZahl(aktuellesKg) : '',
              placeholder: 'z.B. 78,5',
              onchange: async (e) => {
                const wert = e.target.value.trim();
                if (!wert) return;
                const neuesKg = parseFloat(wert.replace(',', '.'));
                if (isNaN(neuesKg) || neuesKg <= 0) return;
                try {
                  await db.speichereKoerpergewicht(neuesKg);
                  window.dispatchEvent(new Event('gym-daten-geaendert'));
                  schliessen();
                } catch (err) {
                  console.error('Fehler beim Speichern des Körpergewichts:', err);
                }
              }
            })))
      ]
    });
  }

  const aktualisiere = einmalig(async () => {
    try {
      const [geladen, gespeichert] = await Promise.all([db.leseDaten(), db.leseHauptuebungen()]);
      daten = geladen;
      const ids = gespeichert ?? STANDARD_HAUPTUEBUNGEN;
      haupt = ids.filter((id) => daten.uebungen.some((u) => u.id === id)).slice(0, HAUPT_MAX);
      zeichne();
    } catch (e) {
      console.error('Rekorde konnten nicht geladen werden:', e);
    }
  });
  return aktualisiere;
}
