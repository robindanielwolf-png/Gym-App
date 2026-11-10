// Screen 03 „Satz eintragen“ und Screen 04 „Cardio eintragen“, jeweils auch zum Ändern/Löschen.
import { ganzeZahl, kommaZahl, nichtNegativeZahl, positiveZahl } from './format.js';
import { chipText, istCardio, istNurWdh, istZusatz, letztesMalText, satzBeschreibung, vorbelegtesGewicht } from './logik.js';
import { behaeltFokus, griff, h, icon, oeffneSheet, sheetKopf, zeigeAlert } from './ui.js';
import { FEHLER_F2 } from './uebungen.js';

const ERFOLG_MS = 1000;

/**
 * Öffnet das passende Sheet. Muss synchron im Tipp laufen, damit iOS die Tastatur zeigt.
 * kontext: { heute(uebungId), letztesMal, speichere(store, eintrag), loesche(store, eintrag), merke(entwurf) }
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

function oeffneKraft({ uebung, kontext, bearbeite, entwurf }) {
  const nurWdh = istNurWdh(uebung);
  const zusatz = istZusatz(uebung);
  const heute = () => kontext.heute(uebung.id);
  const nummer = bearbeite ? heute().findIndex((s) => s.id === bearbeite.id) + 1 : heute().length + 1;

  const start = entwurf || (bearbeite
    ? { gewicht: bearbeite.gewicht === null ? '' : kommaZahl(bearbeite.gewicht), wdh: String(bearbeite.wdh), aufwaermen: bearbeite.aufwaermen }
    : { gewicht: (() => { const g = vorbelegtesGewicht(uebung, heute(), kontext.letztesMal); return g === null ? '' : kommaZahl(g); })(), wdh: '', aufwaermen: false });

  let aufwaermen = Boolean(start.aufwaermen);
  let speichert = false;
  let sichernBearbeiten = null;
  let erfolgTimer = null;

  const gewicht = h('input', {
    class: 'bignum-feld', type: 'text', inputmode: 'decimal', autocomplete: 'off',
    placeholder: '–', 'aria-label': zusatz ? 'Zusatzgewicht' : 'Gewicht', value: start.gewicht
  });
  const wdh = h('input', {
    class: 'zahl', type: 'text', inputmode: 'numeric', pattern: '[0-9]*', autocomplete: 'off',
    maxlength: '4', 'aria-label': 'Wiederholungen', value: start.wdh
  });
  const schalter = h('button', { class: 'switch', type: 'button', role: 'switch', 'aria-label': 'Aufwärmsatz' });
  const chips = h('div', { class: 'sets im-sheet' });
  const speichern = behaeltFokus(h('button', { class: 'btn primary', type: 'button' }));

  const gueltig = () => ganzeZahl(wdh.value) !== null && (nurWdh || nichtNegativeZahl(gewicht.value) !== null);

  const merke = () => kontext.merke({
    uebungId: uebung.id, satzId: bearbeite?.id || null,
    gewicht: gewicht.value, wdh: wdh.value, aufwaermen
  });

  const passeBreite = () => { gewicht.style.width = `${Math.max(1, gewicht.value.length || 1) + 0.6}ch`; };

  const aktualisiere = () => {
    schalter.setAttribute('aria-checked', String(aufwaermen));
    schalter.classList.toggle('on', aufwaermen);
    passeBreite();
    if (!bearbeite && !speichern.classList.contains('erfolg')) {
      speichern.textContent = `Satz ${heute().length + 1} speichern`;
    }
    speichern.disabled = !gueltig();
    if (sichernBearbeiten) sichernBearbeiten.disabled = !gueltig();
    if (!bearbeite) {
      chips.replaceChildren(...heute().map((s, i) =>
        h('span', { class: `chip ${s.aufwaermen ? 'warm' : ''}`.trim(), text: `${i + 1} · ${chipText(uebung, s)}` })));
      chips.hidden = heute().length === 0;
    }
  };

  const schritt = (richtung) => {
    const stufe = uebung.stufe || 2.5;
    const wert = nichtNegativeZahl(gewicht.value);
    if (wert === null) {
      // Leeres Feld: „+“ setzt eine Stufe; „−“ setzt bei Zusatzgewicht 0 (= ohne), sonst nichts.
      if (richtung > 0) gewicht.value = kommaZahl(stufe);
      else if (zusatz) gewicht.value = '0';
      else return;
    } else {
      gewicht.value = kommaZahl(Math.max(0, Math.round((wert + richtung * stufe) * 1000) / 1000));
    }
    merke();
    aktualisiere();
  };

  gewicht.addEventListener('input', () => { merke(); aktualisiere(); });
  wdh.addEventListener('input', () => { merke(); aktualisiere(); });
  schalter.addEventListener('click', () => { aufwaermen = !aufwaermen; merke(); aktualisiere(); });
  behaeltFokus(schalter);

  const werte = () => ({
    gewicht: nurWdh ? null : nichtNegativeZahl(gewicht.value),
    wdh: ganzeZahl(wdh.value),
    aufwaermen
  });

  const gewichtTeil = nurWdh ? [] : [
    h('div', { class: 'field-label', text: zusatz ? 'Zusatzgewicht' : 'Gewicht' }),
    h('div', { class: 'stepper' },
      behaeltFokus(h('button', { class: 'pm', type: 'button', 'aria-label': 'Weniger', onclick: () => schritt(-1) }, icon('i-minus'))),
      h('label', { class: 'bignum' }, gewicht, h('small', { text: 'kg' })),
      behaeltFokus(h('button', { class: 'pm', type: 'button', 'aria-label': 'Mehr', onclick: () => schritt(1) }, icon('i-plus'))))
  ];

  oeffneSheet({
    klasse: 'mit-boden',
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
          // Wdh. ist jetzt leer, ein zweiter Tipp speichert also nichts doppelt. Wer in der
          // Bestätigungssekunde schon neue Wdh. eintippt, kann sofort den nächsten Satz speichern.
          speichert = false;
          wdh.value = '';
          aufwaermen = false;
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
      return [
        griff(),
        sheetKopf(uebung.name, schliessen),
        h('p', { class: 'hint', text: bearbeite ? `Satz ${nummer} ändern` : letztesMalText(uebung, kontext.letztesMal) }),
        chips,
        ...gewichtTeil,
        h('div', { class: 'field-label', text: 'Wiederholungen' }),
        h('label', { class: 'repfield' }, wdh, h('span', { class: 'ph', text: 'Wdh.' })),
        h('div', { class: 'toggle-row' }, h('span', { text: 'Aufwärmsatz' }), schalter),
        h('div', { class: 'abstand-8' }),
        ...aktion
      ];
    }
  });
  aktualisiere();
  // Neuer Satz: Fokus auf Wdh. (Zahlentastatur). Ändern: keine Tastatur, beide Knöpfe sichtbar.
  if (!bearbeite) wdh.focus();
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
          try {
            await kontext.speichere('cardio', {
              id: `cardio-${crypto.randomUUID()}`,
              trainingId: kontext.trainingId,
              uebungId: uebung.id,
              ...werte(),
              erstelltAm: new Date().toISOString()
            });
          } catch {
            speichert = false;
            zeigeAlert(FEHLER_F2);
            return;
          }
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
