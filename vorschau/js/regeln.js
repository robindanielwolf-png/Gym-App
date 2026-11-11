// Trainingslogik ohne Oberfläche und ohne Datenbank: Gewichtsvorschlag, Ziel-Wdh., Aufwärmgewicht,
// Rekorde und „Als Nächstes dran“. Regeln und Testfälle: Agent Trainingsexperte.
// Nur Arbeitssätze zählen; Aufwärmsätze werden hier immer herausgefiltert.

const rund = (x, stellen = 3) => Math.round(x * 10 ** stellen) / 10 ** stellen;

const istCardio = (u) => u.typ === 'cardio';
const istKoerpergewicht = (u) => u.geraet === 'kg';
const istNurWdh = (u) => istKoerpergewicht(u) && u.modus === 'nurWdh';
const istZusatz = (u) => istKoerpergewicht(u) && u.modus === 'zusatz';
const istZeit = (u) => istKoerpergewicht(u) && u.modus === 'zeit';

const arbeit = (saetze) => (saetze || []).filter((s) => !s.aufwaermen);

/**
 * Gewichtsvorschlag aus den Sätzen vom letzten Mal (in Reihenfolge). Gilt für Übungen mit Gewicht
 * und für das Zusatzgewicht. Liefert { wert, basis } oder null (erstes Mal, Cardio, Nur Wdh.).
 */
export function gewichtsVorschlag(uebung, saetzeLetztesMal) {
  if (istCardio(uebung) || istNurWdh(uebung)) return null;
  const s = arbeit(saetzeLetztesMal).filter((x) => typeof x.gewicht === 'number');
  if (s.length === 0) return null;
  const stufe = uebung.stufe || 2.5;
  const basis = Math.max(...s.map((x) => x.gewicht));
  let wert = basis;
  if (s.every((x) => x.gewicht === basis && x.wdh >= 10)) wert = basis + stufe;
  else if (s.slice(0, -1).some((x) => x.wdh < 6)) wert = Math.max(0, basis - stufe);
  return { wert: rund(wert), basis };
}

/** Nur Wdh.: beste Wdh. eines Arbeitssatzes vom letzten Mal + 1, sonst null. */
export function zielWdh(uebung, saetzeLetztesMal) {
  if (!istNurWdh(uebung)) return null;
  const s = arbeit(saetzeLetztesMal);
  if (s.length === 0) return null;
  return Math.max(...s.map((x) => x.wdh)) + 1;
}

/**
 * Vorschlag für Karte und Satz-Fenster.
 * { art: 'gewicht' | 'zusatz' | 'wdh' | 'cardio' | 'erstes', wert, diff }
 */
export function vorschlag(uebung, eintraegeLetztesMal) {
  const e = eintraegeLetztesMal || [];
  if (istCardio(uebung)) return e.length ? { art: 'cardio', wert: e.at(-1).dauerMin, diff: 0 } : { art: 'erstes', wert: null, diff: 0 };
  if (istZeit(uebung)) {
    const s = arbeit(e);
    // Ziel-Zeit = längster Arbeitssatz vom letzten Mal + 5 s (Trainingsexperte).
    return s.length ? { art: 'zeit', wert: Math.max(...s.map((x) => x.wdh)) + 5, diff: 0 } : { art: 'erstes', wert: null, diff: 0 };
  }
  if (istNurWdh(uebung)) {
    const ziel = zielWdh(uebung, e);
    return ziel === null ? { art: 'erstes', wert: null, diff: 0 } : { art: 'wdh', wert: ziel, diff: 0 };
  }
  const v = gewichtsVorschlag(uebung, e);
  if (!v) return { art: 'erstes', wert: null, diff: 0 };
  return { art: istZusatz(uebung) ? 'zusatz' : 'gewicht', wert: v.wert, diff: rund(v.wert - v.basis) };
}

/**
 * Aufwärmgewicht: 65 % des Arbeitsgewichts, auf ein Vielfaches der Stufe abgerundet.
 * Ergibt das Abrunden 0, bei Körpergewicht-Übungen und ohne Gewicht: null.
 */
export function aufwaermGewicht(uebung, arbeitsgewicht) {
  if (istCardio(uebung) || istKoerpergewicht(uebung)) return null;
  if (typeof arbeitsgewicht !== 'number' || !(arbeitsgewicht > 0)) return null;
  const stufe = uebung.stufe || 2.5;
  const stufen = Math.floor(rund((arbeitsgewicht * 65) / (stufe * 100), 6));
  // Abgerundet auf die Stufe; ergibt das 0, gibt es kein Aufwärmgewicht (Schalter markiert nur).
  if (stufen < 1) return null;
  return rund(stufen * stufe);
}

// ---------- Rekorde ----------

/** 1RM eines Satzes: genau 1 Wdh. = belegt, sonst geschätzt nach Epley; auf 0,1 kg gerundet. */
export function einerMax(satz) {
  if (satz.wdh === 1) return { wert: rund(satz.gewicht, 1), belegt: true };
  return { wert: rund(satz.gewicht * (1 + satz.wdh / 30), 1), belegt: false };
}

/**
 * Rekorde einer Übung aus ihren Sätzen (Kraft) bzw. Cardio-Einträgen. Aufwärmsätze zählen nicht.
 * Jeder Wert ist null, solange es keinen passenden Satz gibt.
 * - Gewicht: schwerstes ({ gewicht, wdh }, ≥ 6 Wdh.), einerMax ({ wert, belegt })
 * - Nur Wdh.: meisteWdh
 * - Zusatzgewicht: meisteWdhOhne (Wdh. ohne Zusatz), schwerstesZusatz ({ gewicht, wdh }, ≥ 6 Wdh.)
 * - Cardio: laengsteDauer (min), laengsteStrecke (km)
 */
export function rekorde(uebung, eintraege) {
  if (istCardio(uebung)) {
    const c = eintraege || [];
    const dauer = c.map((x) => x.dauerMin);
    const km = c.map((x) => x.km).filter((x) => typeof x === 'number' && x > 0);
    return {
      art: 'cardio',
      laengsteDauer: dauer.length ? Math.max(...dauer) : null,
      laengsteStrecke: km.length ? Math.max(...km) : null
    };
  }
  const s = arbeit(eintraege);
  if (istNurWdh(uebung)) {
    return { art: 'wdh', meisteWdh: s.length ? Math.max(...s.map((x) => x.wdh)) : null };
  }
  const mitGewicht = s.filter((x) => typeof x.gewicht === 'number');
  const schwerster = (liste) => liste.reduce((best, x) => (!best || x.gewicht > best.gewicht
    || (x.gewicht === best.gewicht && x.wdh > best.wdh) ? { gewicht: x.gewicht, wdh: x.wdh } : best), null);
  if (istZeit(uebung)) {
    const zeiten = s.filter((x) => typeof x.wdh === 'number');
    return { art: 'zeit', laengsteZeit: zeiten.length ? Math.max(...zeiten.map((x) => x.wdh)) : null };
  }
  if (istZusatz(uebung)) {
    const ohne = mitGewicht.filter((x) => x.gewicht === 0);
    return {
      art: 'zusatz',
      meisteWdhOhne: ohne.length ? Math.max(...ohne.map((x) => x.wdh)) : null,
      schwerstesZusatz: schwerster(mitGewicht.filter((x) => x.gewicht > 0 && x.wdh >= 6))
    };
  }
  let best = null;
  for (const x of mitGewicht) {
    const e = einerMax(x);
    if (!best || e.wert > best.wert || (e.wert === best.wert && e.belegt && !best.belegt)) best = e;
  }
  return { art: 'gewicht', schwerstes: schwerster(mitGewicht.filter((x) => x.wdh >= 6)), einerMax: best };
}

const formatZeit = (sekunden) => {
  if (sekunden < 60) return `${sekunden} Sek.`;
  const min = Math.floor(sekunden / 60);
  const sek = sekunden % 60;
  return `${min}:${String(sek).padStart(2, '0')}`;
};

const zahl = (w) => String(w).replace('.', ',');

/**
 * Neue Rekorde durch genau einen neuen Eintrag: vergleicht alle früheren Arbeitssätze der Übung
 * (`vorher`, ohne den neuen) mit `vorher + neu`. Nur echt größer zählt; Aufwärmsätze nie.
 * Liefert eine Liste { lang, kurz } (lang = Text bei einem Rekord, kurz = Teil bei zweien).
 */
export function neueRekorde(uebung, vorher, neu) {
  if (!neu || neu.aufwaermen) return [];
  const a = rekorde(uebung, vorher);
  const b = rekorde(uebung, [...(vorher || []), neu]);
  const groesser = (x, y) => y !== null && (x === null || y > x);
  const liste = [];
  if (b.art === 'cardio') {
    if (groesser(a.laengsteDauer, b.laengsteDauer)) liste.push({ lang: `Längste Dauer: ${zahl(b.laengsteDauer)} min`, kurz: `${zahl(b.laengsteDauer)} min` });
    if (groesser(a.laengsteStrecke, b.laengsteStrecke)) liste.push({ lang: `Längste Strecke: ${zahl(b.laengsteStrecke)} km`, kurz: `${zahl(b.laengsteStrecke)} km` });
  } else if (b.art === 'wdh') {
    if (groesser(a.meisteWdh, b.meisteWdh)) liste.push({ lang: `Meiste Wdh.: ${b.meisteWdh}`, kurz: `${b.meisteWdh} Wdh.` });
  } else if (b.art === 'zeit') {
    if (groesser(a.laengsteZeit, b.laengsteZeit)) liste.push({ lang: `Längste Zeit: ${formatZeit(b.laengsteZeit)}`, kurz: `${formatZeit(b.laengsteZeit)}` });
  } else if (b.art === 'zusatz') {
    if (groesser(a.meisteWdhOhne, b.meisteWdhOhne)) liste.push({ lang: `Meiste Wdh. ohne Zusatz: ${b.meisteWdhOhne}`, kurz: `${b.meisteWdhOhne} Wdh. ohne Zusatz` });
    if (b.schwerstesZusatz && groesser(a.schwerstesZusatz?.gewicht ?? null, b.schwerstesZusatz.gewicht)) {
      const t = `+${zahl(b.schwerstesZusatz.gewicht)} kg × ${b.schwerstesZusatz.wdh}`;
      liste.push({ lang: `Schwerstes Zusatzgewicht: ${t}`, kurz: t });
    }
  } else {
    if (b.schwerstes && groesser(a.schwerstes?.gewicht ?? null, b.schwerstes.gewicht)) {
      const t = `${zahl(b.schwerstes.gewicht)} kg × ${b.schwerstes.wdh}`;
      liste.push({ lang: `Schwerstes Gewicht: ${t}`, kurz: t });
    }
    if (b.einerMax && groesser(a.einerMax?.wert ?? null, b.einerMax.wert)) {
      const label = b.einerMax.belegt ? 'belegt' : 'geschätzt';
      liste.push({ lang: `1RM: ${zahl(b.einerMax.wert)} kg (${label})`, kurz: `1RM ${zahl(b.einerMax.wert)} kg (${label})` });
    }
  }
  return liste;
}

/** Text für den Rekord-Hinweis oder null. */
export function rekordHinweis(uebung, liste) {
  if (!liste || liste.length === 0) return null;
  if (liste.length === 1) return { titel: `Neuer Rekord · ${uebung.name}`, text: liste[0].lang };
  return { titel: `${liste.length} neue Rekorde · ${uebung.name}`, text: liste.map((r) => r.kurz).join(' · ') };
}

// ---------- Als Nächstes dran ----------

const tagNummer = (iso) => {
  const d = new Date(iso);
  return Math.round(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / 86400000);
};

/**
 * Vorschlagbare Art, die am längsten her ist (nach Kalendertagen). Noch nie trainierte Arten
 * werden übersprungen, Gleichstand → Reihenfolge der Liste. zuletzt: Map artId → ISO-Beginn
 * (nur die gewählte Art zählt). Liefert { art, zuletzt } oder null.
 */
export function alsNaechstesDran(arten, zuletzt) {
  let best = null;
  for (const art of [...arten].sort((a, b) => a.reihenfolge - b.reihenfolge)) {
    if (!art.vorschlagbar || art.ausgeblendet) continue;
    const iso = zuletzt.get(art.id);
    if (!iso) continue;
    if (!best || tagNummer(iso) < tagNummer(best.zuletzt)) best = { art, zuletzt: iso };
  }
  return best;
}
