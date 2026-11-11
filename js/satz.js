// Screen 03 „Satz eintragen“ und Screen 04 „Cardio eintragen“, jeweils auch zum Ändern/Löschen.
import { ganzeZahl, kommaZahl, nichtNegativeZahl, positiveZahl } from './format.js';
import { chipText, istCardio, istNurWdh, istZusatz, letztesMalText, satzBeschreibung, vorbelegtesGewicht } from './logik.js';
import { aufwaermGewicht, vorschlag } from './regeln.js';
import { behaeltFokus, griff, h, icon, oeffneSheet, sheetKopf, zeigeAlert } from './ui.js';
import { FEHLER_F2 } from './uebungen.js';

const ERFOLG_MS = 1000;

/**
 * Öffnet das passende Sheet. Muss synchron im Tipp laufen, damit iOS die Tastatur zeigt.
 * kontext: { trainingId, heute(uebungId), letztesMal, speichere(store, eintrag), loesche(store, eintrag),
 *   merke(entwurf), pruefeRekord(store, eintrag), koerpergewicht(), setzeKoerpergewicht(kg),
 *   kgGefragt(), markiereKgGefragt() }
 */
export function oeffneSatz({ uebung, kontext, bearbeite = null, entwurf = null }) {
  if (istCardio(uebung)) oeffneCardio({ uebung, kontext, bearbeite, entwurf });
  else oeffneKraft({ uebung, kontext, bearbeite, entwurf });
}

function frageLoeschen(uebung, eintrag, nummer) {
  return zeigeAlert({
    titel: 'Satz löschen?',
    text: `Satz ${nummer} von ${uebung.name} ${satzBeschreibung(uebung, eintrag)} wird gelöscht.`,
    knoepfe: [{ id: 'nein', label: 'Abbrechen', fett: true }, { id: 'ja', label: 'Löschen', rot: true }]
  });
}

function bearbeitenKnoepfe({ uebung, kontext, store, bearbeite, nummer, schliessen, sichern }) {
  let laeuft = false;
  const sichernKnopf = h('button', { class: 'btn primary', type: 'button', text: 'Änderung sichern' });
  sichernKnopf.addEventListener('click', async () => {
    if (laeuft || sichernKnopf.disabled) return;
    laeuft = true;
    try {
      await sichern();
      schliessen();
    } catch {
      zeigeAlert(FEHLER_F2);
    } finally {
      laeuft = false;
    }
  });
  const loeschen = h('button', {
    class: 'btn danger-text', type: 'button', text: 'Satz löschen',
    onclick: async () => {
      if (laeuft) return;
      if (await frageLoeschen(uebung, bearbeite, nummer) !== 'ja') return;
      laeuft = true;
      try {
        await kontext.loesche(store, bearbeite);
        schliessen();
      } catch {
        zeigeAlert(FEHLER_F2);
      } finally {
        laeuft = false;
      }
    }
  });
  return { sichernKnopf, teile: [sichernKnopf, h('div', { class: 'abstand-8' }), loeschen] };
}

const kgText = (w) => `${kommaZahl(w)} kg`;

/** Kopfzeile 1 im Satz-Sheet: Vorschlag mit Änderung, Ziel-Wdh. oder „erstes Mal“. */
function vorschlagZeile(v) {
  if (v.art === 'erstes') return h('p', { class: 'hint', text: 'Noch kein Vorschlag – erstes Mal' });
  if (v.art === 'wdh') return h('p', { class: 'hint' }, 'Ziel ', h('b', { text: `${v.wert} Wdh.` }));
  const zahl = v.art === 'zusatz' ? (v.wert > 0 ? `+${kgText(v.wert)}` : 'ohne Zusatz') : kgText(v.wert);
  const diff = v.diff === 0 ? null : `(${v.diff > 0 ? '+' : '−'}${kgText(Math.abs(v.diff))})`;
  return h('p', { class: 'hint' }, 'Vorschlag ', h('b', { text: zahl }), diff && ' ', diff && h('span', { class: 'd', text: diff }));
}

/** Körpergewicht 30–250 kg, eine Nachkommastelle (mehr wird gerundet); sonst null. */
export function koerpergewichtAus(eingabe) {
  const text = String(eingabe).trim();
  if (!/^\d{1,3}([.,]\d+)?$/.test(text)) return null;
  const wert = Math.round(Number(text.replace(',', '.')) * 10) / 10;
  return wert >= 30 && wert <= 250 ? wert : null;
}

/**
 * Sheet „Dein Körpergewicht“ (erstes Mal, mit „Später“) bzw. „Körpergewicht“ (Ändern).
 * Liegt über dem Satz-Sheet. Muss synchron im Tipp laufen (Tastatur).
 */
function oeffneKoerpergewicht({ kontext, aendern, beiZu }) {
  const vorher = kontext.koerpergewicht();
  const feld = h('input', {
    class: 'zahl', type: 'text', inputmode: 'decimal', autocomplete: 'off', maxlength: '6',
    'aria-label': 'Körpergewicht', value: aendern && vorher !== null ? kommaZahl(vorher) : ''
  });
  const speichern = h('button', { class: 'btn primary', type: 'button', text: 'Speichern' });
  const pruefe = () => { speichern.disabled = koerpergewichtAus(feld.value) === null; };
  feld.addEventListener('input', pruefe);
  if (!aendern) kontext.markiereKgGefragt();

  const { schliessen } = oeffneSheet({
    klasse: 'kg-sheet',
    zuruecktreten: true,
    beiZu,
    baue: (zu) => {
      speichern.addEventListener('click', () => {
        const wert = koerpergewichtAus(feld.value);
        if (wert === null) return;
        kontext.setzeKoerpergewicht(wert);
        zu();
      });
      return [
        griff(),
        sheetKopf(aendern ? 'Körpergewicht' : 'Dein Körpergewicht', zu),
        !aendern && h('p', { class: 'hint', text: 'Die App zeigt es bei Körpergewicht-Übungen an. Ändern jederzeit über die Zeile „Körpergewicht“ im Satz-Fenster.' }),
        h('div', { class: 'field-label', text: 'Körpergewicht' }),
        h('label', { class: 'repfield' }, feld, h('span', { class: 'ph', text: 'kg' })),
        h('p', { class: 'foot-mitte kg-fuss', text: '30–250 kg, eine Nachkommastelle (z. B. 78,5)' }),
        h('div', { class: 'abstand-12' }),
        speichern,
        !aendern && h('button', { class: 'btn plain', type: 'button', text: 'Später', onclick: () => zu() })
      ];
    }
  });
  pruefe();
  feld.focus();
  if (aendern) feld.select();
  return schliessen;
}

function oeffneKraft({ uebung, kontext, bearbeite, entwurf }) {
  const nurWdh = istNurWdh(uebung);
  const zusatz = istZusatz(uebung);
  const koerper = nurWdh || zusatz;
  const heute = () => kontext.heute(uebung.id);
  const nummer = bearbeite ? heute().findIndex((s) => s.id === bearbeite.id) + 1 : heute().length + 1;
  const vor = vorschlag(uebung, kontext.letztesMal?.eintraege);
  // Aufwärmgewicht erst ab dem 2. Mal einer Übung; im ganzen ersten Training markiert der Schalter nur.
  const mitAufwaermGewicht = !koerper && !bearbeite && vor.art !== 'erstes';
  const vorbelegt = () => { const g = vorbelegtesGewicht(uebung, heute(), kontext.letztesMal); return g === null ? '' : kommaZahl(g); };

  const start = entwurf || (bearbeite
    ? { gewicht: bearbeite.gewicht === null ? '' : kommaZahl(bearbeite.gewicht), wdh: String(bearbeite.wdh), aufwaermen: bearbeite.aufwaermen }
    : { gewicht: vorbelegt(), wdh: '', aufwaermen: false });

  let aufwaermen = Boolean(start.aufwaermen);
  // Gewicht vor dem Einschalten des Aufwärm-Schalters (kommt beim Ausschalten/nach dem Speichern zurück).
  let arbeitsgewicht = mitAufwaermGewicht && typeof start.arbeitsgewicht === 'string' ? start.arbeitsgewicht : null;
  let speichert = false;
  let sichernBearbeiten = null;
  let erfolgTimer = null;

  const gewicht = h('input', {
    class: 'bignum-feld', type: 'text', inputmode: 'decimal', autocomplete: 'off',
    placeholder: '–', 'aria-label': zusatz ? 'Zusatzgewicht' : 'Gewicht', value: start.gewicht
  });
  const wdh = h('input', {
    class: 'zahl', type: 'text', inputmode: 'numeric', pattern: '[0-9]*', autocomplete: 'off',
    maxlength: '4', 'aria-label': 'Wiederholungen', value: start.wdh,
    placeholder: !bearbeite && vor.art === 'wdh' ? String(vor.wert) : false
  });
  const schalter = h('button', { class: 'switch', type: 'button', role: 'switch', 'aria-label': 'Aufwärmsatz' });
  const warmWert = h('span', { class: 'w' });
  const chips = h('div', { class: 'sets im-sheet' });
  const speichern = behaeltFokus(h('button', { class: 'btn primary', type: 'button' }));
  const gewichtLabel = h('div', { class: 'field-label' });
  const plus = h('span', { class: 'plus', text: '+', 'aria-hidden': 'true' });
  // Unsichtbarer Spiegel der Zahl: Das Feld wird so breit wie sein Inhalt (Zahl, „+“ und „kg“ als Gruppe).
  const mass = h('span', { class: 'bignum-mass', 'aria-hidden': 'true' });
  const bignum = h('label', { class: 'bignum' }, plus, gewicht, h('small', { text: 'kg' }), mass);
  const minus = behaeltFokus(h('button', { class: 'pm', type: 'button', 'aria-label': 'Weniger', onclick: () => schritt(-1) }, icon('i-minus')));
  const kgWert = h('span', { class: 'r' });
  const kgZeile = koerper && h('button', { class: 'srow', type: 'button', 'aria-label': 'Körpergewicht' },
    h('span', { class: 'l', text: 'Körpergewicht' }), kgWert);

  const gueltig = () => ganzeZahl(wdh.value) !== null && (nurWdh || nichtNegativeZahl(gewicht.value) !== null);

  const merke = () => kontext.merke({
    uebungId: uebung.id, satzId: bearbeite?.id || null,
    gewicht: gewicht.value, wdh: wdh.value, aufwaermen, arbeitsgewicht
  });

  // +2 px Luft für die Schreibmarke; offsetWidth ist unabhängig von Sheet-Transformationen.
  const passeBreite = () => {
    mass.textContent = gewicht.value || gewicht.placeholder;
    gewicht.style.width = `${mass.offsetWidth + 2}px`;
  };

  const zeigeKoerpergewicht = () => {
    if (!kgZeile) return;
    const kg = kontext.koerpergewicht();
    kgWert.classList.toggle('add', kg === null);
    kgWert.replaceChildren(kg === null ? 'eintragen' : kgText(kg), icon('i-chev', 's16 chev'));
  };

  const aktualisiere = () => {
    const wert = nichtNegativeZahl(gewicht.value);
    // Grauer Aufwärm-Modus nur, wenn der Schalter wirklich ein Aufwärmgewicht gesetzt hat.
    const warmModus = aufwaermen && arbeitsgewicht !== null;
    schalter.setAttribute('aria-checked', String(aufwaermen));
    schalter.classList.toggle('on', aufwaermen);
    passeBreite();
    plus.hidden = !(zusatz && wert !== null && wert > 0);
    const ohne = zusatz && wert === 0;
    minus.classList.toggle('off', ohne);
    gewichtLabel.textContent = zusatz ? `Zusatzgewicht${ohne ? ' · ohne' : ''}` : `Gewicht${warmModus ? ' · Aufwärmen 65 %' : ''}`;
    bignum.classList.toggle('warm', warmModus);
    const warm = mitAufwaermGewicht && !aufwaermen ? aufwaermGewicht(uebung, wert) : null;
    warmWert.textContent = warm === null ? '' : kgText(warm);
    warmWert.hidden = warm === null;
    if (!bearbeite && !speichern.classList.contains('erfolg')) {
      speichern.textContent = aufwaermen ? 'Aufwärmsatz speichern' : `Satz ${heute().length + 1} speichern`;
    }
    speichern.disabled = !gueltig();
    if (sichernBearbeiten) sichernBearbeiten.disabled = !gueltig();
    if (!bearbeite) {
      chips.replaceChildren(...heute().map((s, i) =>
        h('span', { class: `chip ${s.aufwaermen ? 'warm' : ''}`.trim(), text: `${i + 1} · ${chipText(uebung, s)}` })));
      chips.hidden = heute().length === 0;
    }
  };

  function schritt(richtung) {
    const stufe = uebung.stufe || 2.5;
    const wert = nichtNegativeZahl(gewicht.value);
    if (wert === null) {
      // Leeres Feld: „+“ setzt eine Stufe; „−“ setzt bei Zusatzgewicht 0 (= ohne), sonst nichts.
      if (richtung > 0) gewicht.value = kommaZahl(stufe);
      else if (zusatz) gewicht.value = '0';
      else return;
    } else {
      if (richtung < 0 && zusatz && wert === 0) return;
      gewicht.value = kommaZahl(Math.max(0, Math.round((wert + richtung * stufe) * 1000) / 1000));
    }
    merke();
    aktualisiere();
  }

  const schalteAufwaermen = () => {
    aufwaermen = !aufwaermen;
    if (mitAufwaermGewicht) {
      if (aufwaermen) {
        const warm = aufwaermGewicht(uebung, nichtNegativeZahl(gewicht.value));
        if (warm !== null) {
          arbeitsgewicht = gewicht.value;
          gewicht.value = kommaZahl(warm);
        }
      } else if (arbeitsgewicht !== null) {
        gewicht.value = arbeitsgewicht;
        arbeitsgewicht = null;
      }
    }
    merke();
    aktualisiere();
  };

  gewicht.addEventListener('input', () => { merke(); aktualisiere(); });
  wdh.addEventListener('input', () => { merke(); aktualisiere(); });
  schalter.addEventListener('click', schalteAufwaermen);
  behaeltFokus(schalter);

  const oeffneKg = (aendern) => oeffneKoerpergewicht({
    kontext,
    aendern,
    beiZu: () => { zeigeKoerpergewicht(); wdh.focus(); }
  });
  if (kgZeile) kgZeile.addEventListener('click', () => oeffneKg(kontext.koerpergewicht() !== null));

  const werte = () => ({
    gewicht: nurWdh ? null : nichtNegativeZahl(gewicht.value),
    wdh: ganzeZahl(wdh.value),
    aufwaermen
  });

  const gewichtTeil = nurWdh ? [] : [
    gewichtLabel,
    h('div', { class: 'stepper' },
      minus,
      bignum,
      behaeltFokus(h('button', { class: 'pm', type: 'button', 'aria-label': 'Mehr', onclick: () => schritt(1) }, icon('i-plus'))))
  ];

  const kopf = bearbeite
    ? [h('p', { class: 'hint', text: `Satz ${nummer} ändern` })]
    : [vorschlagZeile(vor), (() => { const t = letztesMalText(uebung, kontext.letztesMal); return t && h('p', { class: 'hint', text: t }); })()];

  oeffneSheet({
    klasse: 'mit-boden satz-sheet',
    beiZu: () => kontext.merke(null),
    baue: (schliessen) => {
      let aktion;
      if (bearbeite) {
        const k = bearbeitenKnoepfe({
          uebung, kontext, store: 'saetze', bearbeite, nummer, schliessen,
          sichern: () => kontext.speichere('saetze', { ...bearbeite, ...werte() })
        });
        aktion = k.teile;
        sichernBearbeiten = k.sichernKnopf;
      } else {
        speichern.addEventListener('click', async () => {
          if (speichert || !gueltig()) return;
          speichert = true;
          const neu = {
            id: `satz-${crypto.randomUUID()}`,
            trainingId: kontext.trainingId,
            uebungId: uebung.id,
            ...werte(),
            erstelltAm: new Date().toISOString()
          };
          try {
            await kontext.speichere('saetze', neu);
          } catch {
            speichert = false;
            zeigeAlert(FEHLER_F2);
            return;
          }
          kontext.pruefeRekord?.('saetze', neu);
          // Wdh. ist jetzt leer, ein zweiter Tipp speichert also nichts doppelt. Wer in der
          // Bestätigungssekunde schon neue Wdh. eintippt, kann sofort den nächsten Satz speichern.
          speichert = false;
          wdh.value = '';
          if (aufwaermen && arbeitsgewicht !== null) {
            // Nach dem Aufwärmsatz steht wieder das Arbeitsgewicht im Feld.
            gewicht.value = arbeitsgewicht;
          }
          aufwaermen = false;
          arbeitsgewicht = null;
          clearTimeout(erfolgTimer);
          speichern.classList.add('erfolg');
          speichern.replaceChildren(icon('i-check'), `Satz ${heute().length} gespeichert`);
          aktualisiere();
          erfolgTimer = setTimeout(() => {
            speichern.classList.remove('erfolg');
            aktualisiere();
          }, ERFOLG_MS);
        });
        aktion = [speichern];
      }
      // Titel und ✕ oben und der Knopf unten bleiben stehen; ist es zu eng (Tastatur), scrollt nur die Mitte.
      return [
        griff(),
        sheetKopf(uebung.name, schliessen),
        h('div', { class: 'satz-mitte' },
          ...kopf,
          chips,
          ...gewichtTeil,
          h('div', { class: 'field-label', text: 'Wiederholungen' }),
          h('label', { class: 'repfield' }, wdh, h('span', { class: 'ph', text: 'Wdh.' })),
          kgZeile && h('div', { class: 'abstand-8' }),
          kgZeile,
          h('div', { class: `toggle-row ${kgZeile ? 'mit-linie' : ''}`.trim() },
            h('span', { text: 'Aufwärmsatz' }), h('div', { class: 'rt' }, warmWert, schalter))),
        h('div', { class: 'satz-aktion' }, ...aktion)
      ];
    }
  });
  zeigeKoerpergewicht();
  aktualisiere();
  // Neuer Satz: Fokus auf Wdh. (Zahlentastatur). Ändern: keine Tastatur, beide Knöpfe sichtbar.
  if (!bearbeite) wdh.focus();
  // Körpergewicht-Übung zum ersten Mal ohne gespeicherten Wert: einmalig automatisch fragen.
  if (koerper && !bearbeite && !entwurf && kontext.koerpergewicht() === null && !kontext.kgGefragt()) oeffneKg(false);
}

function oeffneCardio({ uebung, kontext, bearbeite, entwurf }) {
  const heute = () => kontext.heute(uebung.id);
  const nummer = bearbeite ? heute().findIndex((s) => s.id === bearbeite.id) + 1 : heute().length + 1;
  const start = entwurf || (bearbeite
    ? { dauer: kommaZahl(bearbeite.dauerMin), km: bearbeite.km === null ? '' : kommaZahl(bearbeite.km) }
    : { dauer: '', km: '' });
  let speichert = false;

  const dauer = h('input', {
    class: 'zahl', type: 'text', inputmode: 'numeric', pattern: '[0-9]*', autocomplete: 'off',
    maxlength: '4', 'aria-label': 'Dauer', value: start.dauer
  });
  const km = h('input', {
    class: 'zahl', type: 'text', inputmode: 'decimal', autocomplete: 'off',
    placeholder: '–', 'aria-label': 'Strecke', value: start.km
  });
  const speichern = h('button', { class: 'btn primary', type: 'button', text: 'Speichern' });

  const kmWert = () => (km.value.trim() === '' ? null : positiveZahl(km.value));
  const gueltig = () => ganzeZahl(dauer.value) !== null && (km.value.trim() === '' || kmWert() !== null);
  const werte = () => ({ dauerMin: ganzeZahl(dauer.value), km: kmWert() });
  const merke = () => kontext.merke({ uebungId: uebung.id, satzId: bearbeite?.id || null, dauer: dauer.value, km: km.value });

  let pruefe = () => { speichern.disabled = !gueltig(); };
  [dauer, km].forEach((f) => f.addEventListener('input', () => { merke(); pruefe(); }));

  oeffneSheet({
    klasse: 'mit-boden',
    beiZu: () => kontext.merke(null),
    baue: (schliessen) => {
      let aktion;
      if (bearbeite) {
        const k = bearbeitenKnoepfe({
          uebung, kontext, store: 'cardio', bearbeite, nummer, schliessen,
          sichern: () => kontext.speichere('cardio', { ...bearbeite, ...werte() })
        });
        pruefe = () => { k.sichernKnopf.disabled = !gueltig(); };
        aktion = k.teile;
      } else {
        speichern.addEventListener('click', async () => {
          if (speichert || !gueltig()) return;
          speichert = true;
          const neu = {
            id: `cardio-${crypto.randomUUID()}`,
            trainingId: kontext.trainingId,
            uebungId: uebung.id,
            ...werte(),
            erstelltAm: new Date().toISOString()
          };
          try {
            await kontext.speichere('cardio', neu);
          } catch {
            speichert = false;
            zeigeAlert(FEHLER_F2);
            return;
          }
          kontext.pruefeRekord?.('cardio', neu);
          schliessen();
        });
        aktion = [speichern];
      }
      const hinweis = bearbeite ? `Satz ${nummer} ändern` : letztesMalText(uebung, kontext.letztesMal);
      return [
        griff(),
        sheetKopf(uebung.name, schliessen),
        hinweis && h('p', { class: 'hint', text: hinweis }),
        h('div', { class: 'field-label', text: 'Dauer' }),
        h('label', { class: 'repfield' }, dauer, h('span', { class: 'ph', text: 'min' })),
        h('div', { class: 'field-label', text: 'Strecke (optional)' }),
        h('label', { class: 'repfield' }, km, h('span', { class: 'ph', text: 'km' })),
        h('div', { class: 'abstand-16' }),
        ...aktion
      ];
    }
  });
  pruefe();
  if (!bearbeite) dauer.focus();
}
