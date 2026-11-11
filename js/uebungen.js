// Screen 05 „Übung hinzufügen“ und Screen 07 „Neue Übung“.
import * as db from './db.js';
import { GERAETE, MODI, MUSKELN, STANDARD_MODUS, geraet } from './startdaten.js';

// „Zeit“ gibt es nur für Übungen der Startliste (Backlog #24).
const EIGENE_MODI = MODI.filter((m) => m.id !== 'zeit');
import { kommaZahl, positiveZahl } from './format.js';
import { zuletztText } from './logik.js';
import { einmalig, h, icon, kachel, leerHinweis, oeffneSheet, sheetKopf, griff, zeigeAlert } from './ui.js';

export const FEHLER_F2 = {
  titel: 'Das hat nicht geklappt',
  text: 'Deine Daten wurden nicht verändert. Bitte versuche es noch einmal.',
  knoepfe: [{ id: 'ok', label: 'OK', fett: true }]
};

const normal = (t) => t.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/**
 * Übungsauswahl im laufenden Training. Segment: Art · Alle · Eigene, vorgewählt die Art.
 * `beiWahl(uebung)` läuft synchron im Tipp, damit das Satz-Sheet mit Tastatur öffnen kann.
 */
export function oeffneHinzufuegen({ art, uebungen, letztesMal, beiWahl, beiNeu }) {
  let liste = [...uebungen];
  let segment = art.id;
  let suche = '';
  const inhalt = h('div', { class: 'sheet-scroll' });
  const SEGMENTE = [[art.id, art.name], ['alle', 'Alle'], ['eigene', 'Eigene']];
  let schliessenRef = () => {};

  const zeile = (u) => {
    const unter = [geraet(u.geraet).label, zuletztText(u, letztesMal.get(u.id)) || 'noch nie'].join(' · ');
    return h('button', {
      class: 'row', type: 'button', 'data-uebung': u.id,
      onclick: () => { schliessenRef(); beiWahl(u); }
    },
    h('div', { class: 'main' }, h('div', { class: 't', text: u.name }), h('div', { class: 'st', text: unter })),
    icon('i-plus', 's24 plus'));
  };

  const zeichne = (zielId) => {
    const begriff = normal(suche.trim());
    const quelle = segment === 'alle' ? liste
      : segment === 'eigene' ? liste.filter((u) => u.eigen)
        : liste.filter((u) => u.artIds.includes(segment));
    const treffer = quelle
      .filter((u) => normal(u.name).includes(begriff))
      .sort((a, b) => a.name.localeCompare(b.name, 'de', { sensitivity: 'base' }));

    if (treffer.length > 0) {
      inhalt.replaceChildren(
        h('div', { class: 'section-h oben-16', text: SEGMENTE.find(([id]) => id === segment)[1] }),
        h('div', { class: 'list plain auf-weiss' }, treffer.map(zeile)),
        h('div', { class: 'abstand-16' }));
    } else {
      const keineEigenen = segment === 'eigene' && !begriff;
      inhalt.replaceChildren(h('div', { class: 'empty-liste' },
        leerHinweis({ headline: keineEigenen ? 'Noch keine eigenen Übungen' : 'Keine Treffer' })));
    }
    if (zielId) inhalt.querySelector(`[data-uebung="${CSS.escape(zielId)}"]`)?.scrollIntoView({ block: 'center' });
  };

  const eingabe = h('input', {
    type: 'search', placeholder: 'Suchen', 'aria-label': 'Suchen',
    autocomplete: 'off', autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false', enterkeyhint: 'search',
    oninput: (e) => { suche = e.target.value; zeichne(); }
  });

  const segKnoepfe = SEGMENTE.map(([id, label]) => {
    const b = h('button', {
      type: 'button', class: id === segment ? 'on' : '', text: label,
      onclick: () => {
        segment = id;
        segKnoepfe.forEach((k) => k.classList.toggle('on', k === b));
        zeichne();
      }
    });
    return b;
  });

  const nachAnlegen = (neu) => {
    liste = [...liste, neu];
    beiNeu(neu);
    suche = '';
    eingabe.value = '';
    if (segment !== 'alle' && segment !== 'eigene' && !neu.artIds.includes(segment)) {
      segment = 'alle';
      segKnoepfe.forEach((k, i) => k.classList.toggle('on', SEGMENTE[i][0] === 'alle'));
    }
    zeichne(neu.id);
  };

  oeffneSheet({
    klasse: 'voll',
    baue: (schliessen) => {
      schliessenRef = schliessen;
      return [
        griff(),
        sheetKopf('Übung hinzufügen', schliessen, 'mit-rand'),
        h('div', { class: 'abstand-10' }),
        h('label', { class: 'search' }, icon('i-search', 's16'), eingabe),
        h('div', { class: 'abstand-12' }),
        h('div', { class: 'seg' }, segKnoepfe),
        inhalt,
        h('div', { class: 'sheet-fuss' },
          h('button', { class: 'btn secondary', type: 'button', onclick: () => neueUebungEinmal(nachAnlegen) },
            icon('i-plus'), 'Neue Übung anlegen'))
      ];
    }
  });
  zeichne();
}

const LEER_ENTWURF = {
  name: '', geraet: 'langhantel', stufe: 2.5, stufeManuell: false, modus: STANDARD_MODUS, artIds: [], muskelnP: [], muskelnS: []
};

const neueUebungEinmal = einmalig(oeffneNeueUebung);

async function oeffneNeueUebung(beiGesichert) {
  let arten;
  let entwurf;
  try {
    [arten, entwurf] = await Promise.all([db.alleTrainingsarten(), db.leseEntwurfUebung()]);
  } catch {
    zeigeAlert(FEHLER_F2);
    return;
  }
  const f = { ...LEER_ENTWURF, ...(entwurf || {}) };
  let speichert = false;

  // Halb Eingetipptes übersteht App-Schließen, Anruf und Sperren.
  const merke = () => { db.setzeEntwurfUebung({ ...f }).catch(() => {}); };

  const anlegenKnopf = h('button', { class: 'btn primary', type: 'button', text: 'Übung anlegen' });
  const geraetWert = h('div', { class: 'val' });
  const modusWert = h('div', { class: 'val' });
  const stufeWert = h('div', { class: 'val' });

  const modusZeile = h('button', {
    class: 'row', type: 'button', 'aria-label': 'Modus',
    onclick: () => oeffneAuswahl('Modus', EIGENE_MODI, f.modus, (id) => { f.modus = id; merke(); aktualisiere(); })
  }, h('div', { class: 'main t', text: 'Modus' }), modusWert, icon('i-chev', 's16 chev'));

  const stufeBereich = h('div', {},
    h('div', { class: 'section-h', text: 'Stufe für ±' }),
    h('div', { class: 'list plain' },
      h('button', {
        class: 'row', type: 'button', 'aria-label': 'Stufe',
        onclick: () => oeffneStufe(f.stufe, (wert) => {
          f.stufe = wert;
          f.stufeManuell = true;
          merke();
          aktualisiere();
        })
      }, h('div', { class: 'main t', text: 'Stufe' }), stufeWert, icon('i-chev', 's16 chev'))));

  const muskelText = (ids) => (ids.length ? ids.map((id) => MUSKELN.find((m) => m.id === id)?.label).filter(Boolean).join(', ') : 'keine');
  const hauptWert = h('div', { class: 'val muskel-wahl' });
  const hilfWert = h('div', { class: 'val muskel-wahl' });
  const muskelZeile = (titel, wert, feld, anderes) => h('button', {
    class: 'row', type: 'button', 'aria-label': titel,
    onclick: () => oeffneMuskelAuswahl(titel, f[feld], f[anderes], (ids) => { f[feld] = ids; merke(); aktualisiere(); })
  }, h('div', { class: 'main t', text: titel }), wert, icon('i-chev', 's16 chev'));
  const muskelBereich = h('div', {},
    h('div', { class: 'section-h', text: 'Muskeln (für die Muskelfigur)' }),
    h('div', { class: 'list plain' },
      muskelZeile('Hauptmuskeln', hauptWert, 'muskelnP', 'muskelnS'),
      muskelZeile('Mitarbeitende Muskeln', hilfWert, 'muskelnS', 'muskelnP')),
    h('p', { class: 'foot-links', text: 'Hauptmuskel zählt 1, mitarbeitender 0,5 je Satz. Ohne Auswahl färbt die Übung nichts ein.' }));

  const istGueltig = () => f.name.trim().length > 0 && f.artIds.length > 0;

  const aktualisiere = () => {
    const g = geraet(f.geraet);
    geraetWert.textContent = g.label;
    modusZeile.hidden = f.geraet !== 'kg';
    modusWert.textContent = MODI.find((m) => m.id === f.modus).label;
    stufeBereich.hidden = g.typ === 'cardio' || (f.geraet === 'kg' && f.modus === 'nurWdh');
    stufeWert.textContent = `${kommaZahl(f.stufe)} kg`;
    muskelBereich.hidden = g.typ === 'cardio';
    hauptWert.textContent = muskelText(f.muskelnP);
    hilfWert.textContent = muskelText(f.muskelnS);
    anlegenKnopf.disabled = !istGueltig();
  };

  const name = h('input', {
    type: 'text', class: 'zeile-eingabe', placeholder: 'Name', 'aria-label': 'Name',
    value: f.name, autocomplete: 'off', autocapitalize: 'sentences', enterkeyhint: 'done',
    oninput: (e) => { f.name = e.target.value; merke(); aktualisiere(); },
    onkeydown: (e) => { if (e.key === 'Enter') e.target.blur(); }
  });

  const artZeile = (a) => {
    const kreis = h('div', { class: 'check' });
    const zeichne = () => {
      const an = f.artIds.includes(a.id);
      kreis.classList.toggle('on', an);
      kreis.replaceChildren(...(an ? [icon('i-check', 's16 dick')] : []));
      knopf.setAttribute('aria-pressed', String(an));
    };
    const knopf = h('button', {
      class: 'row', type: 'button',
      onclick: () => {
        f.artIds = f.artIds.includes(a.id) ? f.artIds.filter((x) => x !== a.id) : [...f.artIds, a.id];
        zeichne();
        merke();
        aktualisiere();
      }
    }, kachel(a.icon), h('div', { class: 'main t', text: a.name }), kreis);
    zeichne();
    return knopf;
  };

  oeffneSheet({
    klasse: 'voll grau',
    baue: (schliessen) => {
      anlegenKnopf.addEventListener('click', async () => {
        if (speichert || !istGueltig()) return;
        speichert = true;
        const g = geraet(f.geraet);
        const neu = {
          id: `e-${crypto.randomUUID()}`,
          name: f.name.trim(),
          artIds: arten.filter((a) => f.artIds.includes(a.id)).map((a) => a.id),
          geraet: f.geraet,
          typ: g.typ,
          stufe: g.typ === 'cardio' ? null : f.stufe,
          modus: f.geraet === 'kg' ? f.modus : null,
          muskeln: g.typ === 'cardio' ? null : { p: [...f.muskelnP], s: [...f.muskelnS] },
          eigen: true,
          erstelltAm: new Date().toISOString()
        };
        try {
          await db.speichereUebung(neu);
        } catch {
          speichert = false;
          zeigeAlert(FEHLER_F2);
          return;
        }
        schliessen();
        beiGesichert(neu);
      });

      return [
        h('div', { class: 'grabber grabber-grau' }),
        h('div', { class: 'sheet-nav' },
          h('button', {
            class: 'link nav-seite', type: 'button', text: 'Abbrechen',
            onclick: () => { db.setzeEntwurfUebung(null).catch(() => {}); schliessen(); }
          }),
          h('b', { text: 'Neue Übung' }),
          h('span', { class: 'nav-seite' })),
        h('div', { class: 'sheet-scroll mit-fussleiste' },
          h('div', { class: 'section-h nah', text: 'Name' }),
          h('div', { class: 'list plain' }, h('div', { class: 'row' }, h('div', { class: 'main' }, name))),
          h('div', { class: 'section-h', text: 'Gerät' }),
          h('div', { class: 'list plain' },
            h('button', {
              class: 'row', type: 'button', 'aria-label': 'Gerät',
              onclick: () => oeffneAuswahl('Gerät', GERAETE, f.geraet, (id) => {
                f.geraet = id;
                const g = geraet(id);
                if (!f.stufeManuell && g.stufe !== null) f.stufe = g.stufe;
                merke();
                aktualisiere();
              })
            }, h('div', { class: 'main t', text: 'Gerät' }), geraetWert, icon('i-chev', 's16 chev')),
            modusZeile),
          stufeBereich,
          muskelBereich,
          h('div', { class: 'section-h', text: 'Trainingsarten (mehrere möglich)' }),
          h('div', { class: 'list' }, arten.map(artZeile))),
        h('div', { class: 'fussleiste' }, anlegenKnopf)
      ];
    }
  });
  aktualisiere();
}

/** Mehrfachauswahl der 16 Muskelgruppen; Muskeln der anderen Rolle sind nicht wählbar. */
function oeffneMuskelAuswahl(titel, gewaehlt, gesperrt, beiFertig) {
  const auswahl = new Set(gewaehlt);
  const zeile = (m) => {
    const kreis = h('div', { class: 'check' });
    const zeichne = () => {
      kreis.classList.toggle('on', auswahl.has(m.id));
      kreis.replaceChildren(...(auswahl.has(m.id) ? [icon('i-check', 's16 dick')] : []));
    };
    zeichne();
    const andereRolle = gesperrt.includes(m.id);
    return h('button', {
      class: 'row', type: 'button', disabled: andereRolle,
      onclick: () => { if (auswahl.has(m.id)) auswahl.delete(m.id); else auswahl.add(m.id); zeichne(); }
    }, h('div', { class: 'main' }, h('div', { class: 't', text: m.label }),
      andereRolle && h('div', { class: 'st', text: 'schon bei der anderen Rolle gewählt' })), kreis);
  };
  oeffneSheet({
    klasse: 'voll',
    beiZu: () => beiFertig(MUSKELN.map((m) => m.id).filter((id) => auswahl.has(id))),
    baue: (schliessen) => [
      griff(),
      sheetKopf(titel, schliessen, 'mit-rand'),
      h('div', { class: 'sheet-scroll' },
        h('div', { class: 'list plain auf-weiss oben-12' }, MUSKELN.map(zeile)),
        h('div', { class: 'abstand-16' })),
      h('div', { class: 'sheet-fuss' }, h('button', { class: 'btn primary', type: 'button', text: 'Fertig', onclick: schliessen }))
    ]
  });
}

/** Auswahl-Sheet mit Häkchen (Gerät, Modus). Antippen wählt und schließt nach 200 ms. */
function oeffneAuswahl(titel, werte, aktuell, beiWahl) {
  let gewaehlt = false;
  oeffneSheet({
    baue: (schliessen) => [
      griff(),
      sheetKopf(titel, schliessen),
      h('div', { class: 'list plain auf-weiss kein-rand oben-12' }, werte.map((w) =>
        h('button', {
          class: 'row', type: 'button',
          onclick: (e) => {
            if (gewaehlt) return;
            gewaehlt = true;
            e.currentTarget.parentElement.querySelectorAll('.haken').forEach((x) => x.remove());
            e.currentTarget.append(icon('i-check', 'haken'));
            beiWahl(w.id);
            setTimeout(schliessen, 200);
          }
        }, h('div', { class: 'main t', text: w.label }), w.id === aktuell && icon('i-check', 'haken')))),
      h('div', { class: 'sheet-boden' })
    ]
  });
}

function oeffneStufe(aktuell, beiWahl) {
  const uebernehmen = h('button', { class: 'btn primary', type: 'button', text: 'Übernehmen' });
  const feld = h('input', {
    class: 'zahl', type: 'text', inputmode: 'decimal', 'aria-label': 'Stufe',
    value: kommaZahl(aktuell), autocomplete: 'off',
    oninput: () => { uebernehmen.disabled = positiveZahl(feld.value) === null; }
  });

  oeffneSheet({
    baue: (schliessen) => {
      uebernehmen.addEventListener('click', () => {
        const wert = positiveZahl(feld.value);
        if (wert === null) return;
        beiWahl(wert);
        schliessen();
      });
      return [
        griff(),
        sheetKopf('Stufe', schliessen),
        h('div', { class: 'abstand-12' }),
        h('label', { class: 'repfield' }, feld, h('span', { class: 'ph', text: 'kg' })),
        h('div', { class: 'abstand-16' }),
        uebernehmen,
        h('div', { class: 'sheet-boden' })
      ];
    }
  });
  feld.focus();
  feld.select();
}
