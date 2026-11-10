// Übungsliste (wie Screen 05, ohne Trainingsbezug) und „Neue Übung“ (Screen 07).
import * as db from './db.js';
import { GERAETE, geraet } from './startdaten.js';
import { kommaZahl, positiveZahl } from './format.js';
import { einmalig, h, icon, kachel, leerHinweis, oeffneSheet, sheetKopf, griff, zeigeAlert } from './ui.js';

const FEHLER_F2 = {
  titel: 'Das hat nicht geklappt',
  text: 'Deine Daten wurden nicht verändert. Bitte versuche es noch einmal.',
  knoepfe: [{ id: 'ok', label: 'OK', fett: true }]
};

const normal = (t) => t.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

export const oeffneUebungen = einmalig(async () => {
  let uebungen;
  try {
    uebungen = await db.alleUebungen();
  } catch {
    zeigeAlert(FEHLER_F2);
    return;
  }

  let segment = 'alle';
  let suche = '';
  const inhalt = h('div', { class: 'sheet-scroll' });

  const zeile = (u) => h('div', { class: 'row', 'data-uebung': u.id },
    h('div', { class: 'main' },
      h('div', { class: 't', text: u.name }),
      h('div', { class: 'st', text: geraet(u.geraet).label })));

  const zeichne = (zielId) => {
    const begriff = normal(suche.trim());
    const quelle = segment === 'eigene' ? uebungen.filter((u) => u.eigen) : uebungen;
    const treffer = quelle
      .filter((u) => normal(u.name).includes(begriff))
      .sort((a, b) => a.name.localeCompare(b.name, 'de', { sensitivity: 'base' }));

    if (treffer.length > 0) {
      inhalt.replaceChildren(
        h('div', { class: 'section-h oben-16', text: segment === 'eigene' ? 'Eigene' : 'Alle' }),
        h('div', { class: 'list plain auf-weiss' }, treffer.map(zeile)));
    } else {
      inhalt.replaceChildren(h('div', { class: 'empty-liste' },
        leerHinweis({ headline: begriff ? 'Keine Treffer' : 'Noch keine eigenen Übungen' })));
    }
    if (zielId) inhalt.querySelector(`[data-uebung="${CSS.escape(zielId)}"]`)?.scrollIntoView({ block: 'center' });
  };

  const eingabe = h('input', {
    type: 'search', placeholder: 'Suchen', 'aria-label': 'Suchen',
    autocomplete: 'off', autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false', enterkeyhint: 'search',
    oninput: (e) => { suche = e.target.value; zeichne(); }
  });

  const segKnoepfe = [['alle', 'Alle'], ['eigene', 'Eigene']].map(([id, label]) => {
    const b = h('button', {
      type: 'button',
      class: id === segment ? 'on' : '',
      text: label,
      onclick: () => {
        segment = id;
        segKnoepfe.forEach((k) => k.classList.toggle('on', k === b));
        zeichne();
      }
    });
    return b;
  });

  const nachAnlegen = (neu) => {
    uebungen = [...uebungen, neu];
    suche = '';
    eingabe.value = '';
    zeichne(neu.id);
  };

  oeffneSheet({
    klasse: 'voll',
    baue: (schliessen) => [
      griff(),
      sheetKopf('Übungen', schliessen, 'mit-rand'),
      h('div', { class: 'abstand-10' }),
      h('label', { class: 'search' }, icon('i-search', 's16'), eingabe),
      h('div', { class: 'abstand-12' }),
      h('div', { class: 'seg' }, segKnoepfe),
      inhalt,
      h('div', { class: 'sheet-fuss' },
        h('button', { class: 'btn secondary', type: 'button', onclick: () => neueUebungEinmal(nachAnlegen) },
          icon('i-plus'), 'Neue Übung anlegen'))
    ]
  });
  zeichne();
});

const LEER_ENTWURF = { name: '', geraet: 'langhantel', stufe: 2.5, stufeManuell: false, artIds: [] };

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

  const sichernKnopf = h('button', { class: 'link fett', type: 'button', text: 'Sichern' });
  const geraetWert = h('div', { class: 'val' });
  const stufeWert = h('div', { class: 'val' });
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

  const istGueltig = () => f.name.trim().length > 0 && f.artIds.length > 0;

  const aktualisiere = () => {
    const g = geraet(f.geraet);
    geraetWert.textContent = g.label;
    stufeBereich.hidden = g.typ === 'cardio';
    stufeWert.textContent = `${kommaZahl(f.stufe)} kg`;
    sichernKnopf.disabled = !istGueltig();
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
      sichernKnopf.addEventListener('click', async () => {
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
            class: 'link', type: 'button', text: 'Abbrechen',
            onclick: () => { db.setzeEntwurfUebung(null).catch(() => {}); schliessen(); }
          }),
          h('b', { text: 'Neue Übung' }),
          sichernKnopf),
        h('div', { class: 'sheet-scroll' },
          h('div', { class: 'section-h nah', text: 'Name' }),
          h('div', { class: 'list plain' }, h('div', { class: 'row' }, h('div', { class: 'main' }, name))),
          h('div', { class: 'section-h', text: 'Gerät' }),
          h('div', { class: 'list plain' },
            h('button', {
              class: 'row', type: 'button', 'aria-label': 'Gerät',
              onclick: () => oeffneGeraet(f.geraet, (id) => {
                f.geraet = id;
                const g = geraet(id);
                if (!f.stufeManuell && g.stufe !== null) f.stufe = g.stufe;
                merke();
                aktualisiere();
              })
            }, h('div', { class: 'main t', text: 'Gerät' }), geraetWert, icon('i-chev', 's16 chev'))),
          stufeBereich,
          h('div', { class: 'section-h', text: 'Trainingsarten (mehrere möglich)' }),
          h('div', { class: 'list' }, arten.map(artZeile)),
          h('div', { class: 'abstand-unten' }))
      ];
    }
  });
  aktualisiere();
}

function oeffneGeraet(aktuell, beiWahl) {
  let gewaehlt = false;
  oeffneSheet({
    baue: (schliessen) => [
      griff(),
      sheetKopf('Gerät', schliessen),
      h('div', { class: 'list plain auf-weiss kein-rand oben-12' }, GERAETE.map((g) =>
        h('button', {
          class: 'row', type: 'button',
          onclick: (e) => {
            if (gewaehlt) return;
            gewaehlt = true;
            e.currentTarget.parentElement.querySelectorAll('.haken').forEach((x) => x.remove());
            e.currentTarget.append(icon('i-check', 'haken'));
            beiWahl(g.id);
            setTimeout(schliessen, 200);
          }
        }, h('div', { class: 'main t', text: g.label }), g.id === aktuell && icon('i-check', 'haken')))),
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
