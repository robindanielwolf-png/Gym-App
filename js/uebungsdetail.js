// Übungsdetail (#10, Design Screen 06): Verlauf-Diagramm, zwei Rekorde, alle Trainings.
// Gezählt werden nur Arbeitssätze; ein Punkt im Diagramm = bester Satz eines Trainings.
import { datumKurz, datumLang, kommaZahl } from './format.js';
import { chipText, istCardio, istNurWdh, istZeit, istZusatz } from './logik.js';
import { einerMax, rekorde } from './regeln.js';
import { h, oeffneSheet, sheetKopf, griff, icon } from './ui.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const ZEITRAEUME = [{ id: 3, label: '3 Mon.' }, { id: 6, label: '6 Mon.' }, { id: 0, label: 'Alles' }];
const MONATE = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
const H = 230, L = 34, R = 10, O = 14, U = 34;

const zeit = (iso) => (iso ? Date.parse(iso) : 0);

function svg(tag, attrs = {}, text = null) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  if (text !== null) el.textContent = text;
  return el;
}

const sekText = (s) => (s < 60 ? `${s} s` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} min`);

/** Art der Übung: Beschriftung, Einheit und Wert eines Eintrags fürs Diagramm. */
export function messart(uebung) {
  if (istCardio(uebung)) return { titel: 'Dauer (min)', wert: (e) => e.dauerMin, text: (w) => `${kommaZahl(w)} min` };
  if (istZeit(uebung)) return { titel: 'Zeit (s) · Arbeitssätze', wert: (e) => e.wdh, text: sekText };
  if (istNurWdh(uebung)) return { titel: 'Wiederholungen · Arbeitssätze', wert: (e) => e.wdh, text: (w) => `${w} Wdh.` };
  if (istZusatz(uebung)) return { titel: 'Zusatzgewicht (kg) · Arbeitssätze', wert: (e) => e.gewicht ?? 0, text: (w) => `+${kommaZahl(w)} kg` };
  return { titel: 'Gewicht (kg) · Arbeitssätze', wert: (e) => e.gewicht ?? 0, text: (w) => `${kommaZahl(w)} kg` };
}

/** Trainings der Übung, älteste zuerst: { training, eintraege, wert }. */
export function trainingsDerUebung(daten, uebung, art) {
  const trainings = new Map(daten.trainings.map((t) => [t.id, t]));
  const gruppen = new Map();
  for (const e of [...daten.saetze, ...daten.cardio]) {
    if (e.uebungId !== uebung.id || e.aufwaermen || !trainings.has(e.trainingId)) continue;
    if (!gruppen.has(e.trainingId)) gruppen.set(e.trainingId, []);
    gruppen.get(e.trainingId).push(e);
  }
  return [...gruppen].map(([id, eintraege]) => ({
    training: trainings.get(id),
    eintraege: eintraege.sort((a, b) => zeit(a.erstelltAm) - zeit(b.erstelltAm)),
    wert: Math.max(...eintraege.map(art.wert))
  })).sort((a, b) => zeit(a.training.startedAt) - zeit(b.training.startedAt));
}

export function achse(min, max) {
  if (min === max) { min = Math.max(0, min - 1); max += 1; }
  const roh = (max - min) / 3;
  const p = 10 ** Math.floor(Math.log10(roh));
  const schritt = [1, 2, 2.5, 5, 10].map((f) => f * p).find((s) => s >= roh);
  const unten = Math.floor(min / schritt) * schritt;
  const oben = Math.ceil(max / schritt) * schritt;
  const ticks = [];
  for (let v = unten; v <= oben + schritt / 2; v += schritt) ticks.push(Math.round(v * 100) / 100);
  return { unten, oben, ticks };
}

function diagramm(punkte, art) {
  // 1 Einheit = 1 px: Breite = Bildschirm − Sheet- und Karten-Innenabstand (Design B1).
  const B = Math.max(280, document.documentElement.clientWidth - 56);
  const bild = svg('svg', { viewBox: `0 0 ${B} ${H}`, class: 'chart-svg', role: 'img', 'aria-label': art.titel });
  const t0 = zeit(punkte[0].training.startedAt);
  const t1 = zeit(punkte.at(-1).training.startedAt);
  const { unten, oben, ticks } = achse(Math.min(...punkte.map((p) => p.wert)), Math.max(...punkte.map((p) => p.wert)));
  const x = (t) => (t1 === t0 ? (L + B - R) / 2 : L + ((t - t0) / (t1 - t0)) * (B - R - L));
  const y = (v) => O + (1 - (v - unten) / (oben - unten)) * (H - O - U);

  const raster = svg('g', { class: 'chart-raster' });
  const beschriftung = svg('g', { class: 'chart-achse' });
  for (const v of ticks) {
    raster.append(svg('line', { x1: L, x2: B - R, y1: y(v), y2: y(v) }));
    beschriftung.append(svg('text', { x: L - 6, y: y(v) + 4, 'text-anchor': 'end' }, kommaZahl(v)));
  }
  const monate = [];
  const d = new Date(t0);
  for (let m = new Date(d.getFullYear(), d.getMonth() + 1, 1); m.getTime() <= t1; m.setMonth(m.getMonth() + 1)) monate.push(new Date(m));
  const jede = Math.max(1, Math.ceil(monate.length / 6));
  monate.filter((_, i) => i % jede === 0).forEach((m) =>
    beschriftung.append(svg('text', { x: x(m.getTime()), y: H - 12, 'text-anchor': 'middle' }, MONATE[m.getMonth()])));
  if (monate.length === 0) beschriftung.append(svg('text', { x: (L + B - R) / 2, y: H - 12, 'text-anchor': 'middle' }, datumKurz(punkte[0].training.startedAt)));

  const xy = punkte.map((p) => [x(zeit(p.training.startedAt)), y(p.wert)]);
  bild.append(raster, beschriftung,
    svg('polyline', { class: 'chart-linie', points: xy.map((p) => p.join(',')).join(' ') }),
    ...xy.map(([cx, cy]) => svg('circle', { class: 'chart-punkt', cx, cy, r: 3 })));

  const markierung = svg('g', { class: 'chart-markierung' });
  bild.append(markierung);
  const markiere = (i) => {
    const [cx, cy] = xy[i];
    const lx = Math.min(Math.max(cx - 55, 2), B - 112);
    const ly = cy > H / 2 ? cy - 58 : cy + 12;
    markierung.replaceChildren(
      svg('line', { class: 'chart-hilfslinie', x1: cx, x2: cx, y1: O - 4, y2: H - U + 6 }),
      svg('circle', { class: 'chart-auswahl', cx, cy, r: 6 }),
      svg('rect', { class: 'chart-label', x: lx, y: ly, width: 110, height: 44, rx: 10 }),
      svg('text', { class: 'chart-label-datum', x: lx + 55, y: ly + 18, 'text-anchor': 'middle' }, datumLang(punkte[i].training.startedAt)),
      svg('text', { class: 'chart-label-wert', x: lx + 55, y: ly + 36, 'text-anchor': 'middle' }, art.text(punkte[i].wert)));
  };
  const naechster = (ev) => {
    const r = bild.getBoundingClientRect();
    const px = ((ev.clientX - r.left) / r.width) * B;
    let best = 0;
    xy.forEach(([cx], i) => { if (Math.abs(cx - px) < Math.abs(xy[best][0] - px)) best = i; });
    markiere(best);
  };
  bild.addEventListener('pointerdown', naechster);
  bild.addEventListener('pointermove', (ev) => { if (ev.buttons || ev.pointerType === 'touch') naechster(ev); });
  return bild;
}

function kachel(titel, wert, einheit, unterzeile, plakette = null) {
  return h('div', { class: 'rekord-kachel' },
    h('div', { class: 'rk-titel' }, titel, plakette && h('span', { class: `rk-plakette${plakette === 'belegt' ? ' belegt' : ''}`, text: plakette })),
    h('div', { class: 'rk-wert' }, wert === null ? '–' : String(wert), wert !== null && einheit && h('small', { text: ` ${einheit}` })),
    unterzeile && h('div', { class: 'rk-unter', text: unterzeile }));
}

/** Datum des ersten Trainings, in dem ein passender Satz vorkommt. */
function wann(liste, passt) {
  const p = liste.find((x) => x.eintraege.some(passt));
  return p ? datumKurz(p.training.startedAt) : null;
}

function rekordKacheln(uebung, liste) {
  const alle = liste.flatMap((p) => p.eintraege);
  const r = rekorde(uebung, alle);
  const anzahl = kachel('Trainings', liste.length, '', liste.length ? `seit ${datumKurz(liste[0].training.startedAt)}` : null);
  if (r.art === 'cardio') {
    return [kachel('Längste Dauer', r.laengsteDauer && kommaZahl(r.laengsteDauer), 'min', null),
      kachel('Längste Strecke', r.laengsteStrecke && kommaZahl(r.laengsteStrecke), 'km', null)];
  }
  if (r.art === 'wdh') return [kachel('Meiste Wdh.', r.meisteWdh, '', r.meisteWdh && wann(liste, (e) => e.wdh === r.meisteWdh)), anzahl];
  if (r.art === 'zeit') return [kachel('Längste Zeit', r.laengsteZeit === null ? null : sekText(r.laengsteZeit), '', null), anzahl];
  if (r.art === 'zusatz') {
    const s = r.schwerstesZusatz;
    return [kachel('Schwerstes Zusatzgew. (≥ 6 Wdh.)', s && `+${kommaZahl(s.gewicht)}`, 'kg', s && `× ${s.wdh} Wdh. · ${wann(liste, (e) => e.gewicht === s.gewicht && e.wdh === s.wdh)}`),
      kachel('Meiste Wdh. ohne Zusatz', r.meisteWdhOhne, '', null)];
  }
  const s = r.schwerstes;
  const e = r.einerMax;
  const quelle = e && alle.find((x) => typeof x.gewicht === 'number' && einerMax(x).wert === e.wert && einerMax(x).belegt === e.belegt);
  return [kachel('Schwerstes (≥ 6 Wdh.)', s && kommaZahl(s.gewicht), 'kg', s && `× ${s.wdh} Wdh. · ${wann(liste, (x) => x.gewicht === s.gewicht && x.wdh === s.wdh)}`),
    kachel('1RM', e && kommaZahl(e.wert), 'kg', quelle && (e.belegt ? '1 Wdh.' : `aus ${kommaZahl(quelle.gewicht)} kg × ${quelle.wdh}`), e && (e.belegt ? 'belegt' : 'geschätzt'))];
}

function trainingsListe(uebung, liste) {
  const zeilen = h('div', { class: 'detail-trainings', hidden: true }, [...liste].reverse().map((p) =>
    h('div', { class: 'row' },
      h('div', { class: 'main' },
        h('div', { class: 't', text: datumLang(p.training.startedAt) }),
        h('div', { class: 'st', text: p.eintraege.map((e) => chipText(uebung, e)).join(' / ') })))));
  const pfeil = icon('i-chev', 'chev detail-pfeil');
  const kopf = h('button', {
    class: 'row', type: 'button', 'aria-expanded': 'false',
    onclick: () => {
      zeilen.hidden = !zeilen.hidden;
      kopf.setAttribute('aria-expanded', String(!zeilen.hidden));
      pfeil.classList.toggle('offen', !zeilen.hidden);
    }
  }, h('div', { class: 'main t', text: `Alle Trainings (${liste.length})` }), pfeil);
  return h('div', { class: 'list plain auf-weiss-karte' }, kopf, zeilen);
}

/** Öffnet das Übungsdetail als Sheet (aus Rekorde und aus Verlauf → Tag). */
export function oeffneUebungsdetail(daten, uebung) {
  const art = messart(uebung);
  const alle = trainingsDerUebung(daten, uebung, art);
  let monate = 6;
  const karte = h('div', { class: 'chart-karte' });

  const zeichne = () => {
    const ab = monate ? new Date(new Date().setMonth(new Date().getMonth() - monate)).getTime() : 0;
    const punkte = alle.filter((p) => zeit(p.training.startedAt) >= ab);
    karte.replaceChildren(
      h('div', { class: 'chart-kopf' }, h('span', { text: art.titel })),
      h('div', { class: 'seg chart-seg' }, ZEITRAEUME.map((z) =>
        h('button', { type: 'button', class: z.id === monate ? 'on' : '', text: z.label, onclick: () => { monate = z.id; zeichne(); } }))),
      punkte.length
        ? diagramm(punkte, art)
        : h('p', { class: 'chart-leer', text: alle.length ? 'Keine Trainings in diesem Zeitraum.' : 'Noch keine Arbeitssätze für diese Übung.' }));
  };
  zeichne();

  oeffneSheet({
    klasse: 'detail-sheet',
    zuruecktreten: true,
    baue: (zu) => [griff(), sheetKopf(uebung.name, zu),
      karte,
      h('div', { class: 'section-h detail-abschnitt', text: 'Rekorde' }),
      h('div', { class: 'rekord-kacheln' }, rekordKacheln(uebung, alle)),
      alle.length > 0 && trainingsListe(uebung, alle),
      h('div', { class: 'abstand-unten' })]
  });
}
