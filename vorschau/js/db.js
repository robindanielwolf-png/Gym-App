// IndexedDB: Stores, Migrationen, Startdaten und die atomaren Schreibvorgänge.
import { DB_NAME } from './umgebung.js';
import { TRAININGSARTEN, STARTLISTE, STANDARD_MODUS, startModus } from './startdaten.js';

export const SCHEMA_VERSION = 2;

// Datenbereiche, die in die Sicherung gehören, mit dem Schema, in dem sie dazukamen.
// plaene bleibt bis zum Trainingsplan (V2) leer. koerpergewicht enthält ab 0.3.0 höchstens
// einen Eintrag (id KOERPERGEWICHT_ID); der Verlauf kommt in V2 dazu.
export const STORE_SEIT_SCHEMA = {
  trainingsarten: 1,
  uebungen: 1,
  trainings: 1,
  saetze: 1,
  cardio: 1,
  plaene: 1,
  koerpergewicht: 1
};
export const DATEN_STORES = Object.keys(STORE_SEIT_SCHEMA);

const META = 'meta';
const KOPIE = 'interneKopie';
const KOPIE_ID = 'letzte';
const ALLE_STORES = [...DATEN_STORES, META, KOPIE];

const META_LETZTE_SICHERUNG = 'letzteSicherung';
const META_ENTWURF_UEBUNG = 'entwurfUebung';
const META_ENTWURF_SATZ = 'entwurfSatz';
const META_ANSICHT = 'letzteAnsicht';
const META_KG_GEFRAGT = 'koerpergewichtGefragt';
const META_VERSION = 'geseheneVersion';

export const KOERPERGEWICHT_ID = 'aktuell';

// Migrationen ergänzen nur: `struktur` legt neue Stores oder Indizes an, `felder` setzt je
// Store fehlende Felder auf einen Standardwert. Die Funktionen laufen beim Datenbank-Upgrade,
// beim Import älterer Sicherungen und beim Wiederherstellen einer älteren internen Kopie.
export const MIGRATIONEN = [
  {
    ziel: 1,
    struktur(db) {
      db.createObjectStore(META, { keyPath: 'key' });
      db.createObjectStore(KOPIE, { keyPath: 'id' });
      db.createObjectStore('trainingsarten', { keyPath: 'id' });

      const uebungen = db.createObjectStore('uebungen', { keyPath: 'id' });
      uebungen.createIndex('artIds', 'artIds', { multiEntry: true });

      const trainings = db.createObjectStore('trainings', { keyPath: 'id' });
      trainings.createIndex('artId', 'artId');
      trainings.createIndex('startedAt', 'startedAt');

      for (const name of ['saetze', 'cardio']) {
        const store = db.createObjectStore(name, { keyPath: 'id' });
        store.createIndex('trainingId', 'trainingId');
        store.createIndex('uebungId', 'uebungId');
      }

      db.createObjectStore('plaene', { keyPath: 'id' });
      db.createObjectStore('koerpergewicht', { keyPath: 'id' });
    }
  },
  {
    // 0.2.0: Modus für Körpergewicht-Übungen, Reihenfolge der Übungen im Training,
    // Zeitpunkt je Satz/Cardio-Eintrag. Die Übung Liegestütze ergänzt `initialisiere`.
    ziel: 2,
    felder: {
      uebungen(u) {
        if (!('modus' in u)) u.modus = u.geraet === 'kg' ? (startModus(u.id) || STANDARD_MODUS) : null;
      },
      trainings(t) {
        if (!('uebungIds' in t)) t.uebungIds = [];
      },
      saetze(s) {
        if (!('erstelltAm' in s)) s.erstelltAm = null;
      },
      cardio(c) {
        if (!('erstelltAm' in c)) c.erstelltAm = null;
      }
    }
  }
];

/** Bringt Sicherungsdaten vom Schema `von` auf den aktuellen Stand, ohne etwas zu entfernen. */
export function ergaenzeDaten(daten, von, migrationen = MIGRATIONEN) {
  for (const m of migrationen) {
    if (m.ziel <= von || !m.felder) continue;
    for (const [store, ergaenze] of Object.entries(m.felder)) {
      (daten[store] || []).forEach(ergaenze);
    }
  }
  return daten;
}

const anfrage = (r) => new Promise((ok, fehler) => {
  r.onsuccess = () => ok(r.result);
  r.onerror = () => fehler(r.error);
});

const fertig = (t) => new Promise((ok, fehler) => {
  t.oncomplete = () => ok();
  t.onerror = () => fehler(t.error);
  t.onabort = () => fehler(t.error || new DOMException('Transaktion abgebrochen', 'AbortError'));
});

export function oeffneDatenbank(name = DB_NAME, migrationen = MIGRATIONEN) {
  const version = Math.max(...migrationen.map((m) => m.ziel));
  return new Promise((ok, fehler) => {
    const r = indexedDB.open(name, version);
    r.onupgradeneeded = (e) => {
      const db = r.result;
      const t = r.transaction;
      for (const m of migrationen) {
        if (m.ziel <= e.oldVersion) continue;
        m.struktur?.(db, t);
        for (const [store, ergaenze] of Object.entries(m.felder || {})) {
          t.objectStore(store).openCursor().onsuccess = (ev) => {
            const cursor = ev.target.result;
            if (!cursor) return;
            ergaenze(cursor.value);
            cursor.update(cursor.value);
            cursor.continue();
          };
        }
      }
      t.objectStore(META).put({ key: 'schemaVersion', wert: version });
    };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => fehler(r.error);
    r.onblocked = () => fehler(new DOMException('Datenbank blockiert', 'InvalidStateError'));
  });
}

let verbindung = null;

function datenbank() {
  if (!verbindung) {
    verbindung = oeffneDatenbank().then((db) => {
      // Eine neue Version in einem anderen Fenster darf nicht blockiert werden.
      db.onversionchange = () => { db.close(); verbindung = null; };
      db.onclose = () => { verbindung = null; };
      return db;
    }).catch((e) => { verbindung = null; throw e; });
  }
  return verbindung;
}

/** Führt `arbeit` in einer Transaktion aus. Bei jedem Fehler bleibt alles unverändert. */
async function mitTransaktion(stores, modus, arbeit) {
  for (let versuch = 0; ; versuch++) {
    const db = await datenbank();
    let t;
    try {
      t = db.transaction(stores, modus);
    } catch (e) {
      // iOS kann die Verbindung schließen, wenn die App im Hintergrund war.
      if (versuch === 0 && e.name === 'InvalidStateError') { verbindung = null; continue; }
      throw e;
    }
    const abgeschlossen = fertig(t);
    try {
      const ergebnis = await arbeit(t);
      await abgeschlossen;
      return ergebnis;
    } catch (e) {
      try { t.abort(); } catch { /* bereits abgebrochen */ }
      await abgeschlossen.catch(() => {});
      throw e;
    }
  }
}

/** Legt fehlende Trainingsarten und Übungen der Startliste an, ohne vorhandene zu ändern. */
export function initialisiere() {
  return mitTransaktion(['trainingsarten', 'uebungen'], 'readwrite', async (t) => {
    for (const [name, eintraege] of [['trainingsarten', TRAININGSARTEN], ['uebungen', STARTLISTE]]) {
      const store = t.objectStore(name);
      const vorhanden = new Set(await anfrage(store.getAllKeys()));
      for (const e of eintraege) if (!vorhanden.has(e.id)) store.add(e);
    }
  });
}

const leseAlles = async (t) => {
  const listen = await Promise.all(DATEN_STORES.map((s) => anfrage(t.objectStore(s).getAll())));
  return Object.fromEntries(DATEN_STORES.map((s, i) => [s, listen[i]]));
};

const leseMeta = async (t, key) => (await anfrage(t.objectStore(META).get(key)))?.wert ?? null;

const schreibeMeta = (t, key, wert) => {
  const store = t.objectStore(META);
  if (wert === null || wert === undefined) store.delete(key);
  else store.put({ key, wert });
};

function ersetzeDaten(t, daten) {
  for (const name of DATEN_STORES) {
    const store = t.objectStore(name);
    store.clear();
    for (const eintrag of daten[name]) store.put(eintrag);
  }
}

function mitStartdaten(daten) {
  const ergaenze = (liste, startwerte) => {
    const ids = new Set(liste.map((e) => e.id));
    return [...liste, ...startwerte.filter((e) => !ids.has(e.id))];
  };
  return {
    ...daten,
    trainingsarten: ergaenze(daten.trainingsarten, TRAININGSARTEN),
    uebungen: ergaenze(daten.uebungen, STARTLISTE)
  };
}

/** Aktueller Stand für das Sicherungs-Sheet. */
export function leseStand() {
  return mitTransaktion([...DATEN_STORES, META, KOPIE], 'readonly', async (t) => {
    const [daten, letzteSicherung, kopie] = await Promise.all([
      leseAlles(t),
      leseMeta(t, META_LETZTE_SICHERUNG),
      anfrage(t.objectStore(KOPIE).get(KOPIE_ID))
    ]);
    return { daten, letzteSicherung, kopie: kopie || null };
  });
}

export function setzeLetzteSicherung(iso) {
  return mitTransaktion([META], 'readwrite', (t) => {
    schreibeMeta(t, META_LETZTE_SICHERUNG, iso);
  });
}

/**
 * Ersetzt alle Daten durch den Inhalt einer geprüften Sicherung. Interne Kopie und Ersetzen
 * laufen in einer einzigen Transaktion: Scheitert ein Schritt, bleibt der alte Stand vollständig.
 */
export function importiere(daten, exportiertAm, { mitKopie }) {
  return mitTransaktion(ALLE_STORES, 'readwrite', async (t) => {
    if (mitKopie) {
      const [alt, letzteSicherung] = await Promise.all([leseAlles(t), leseMeta(t, META_LETZTE_SICHERUNG)]);
      t.objectStore(KOPIE).put({
        id: KOPIE_ID,
        erstelltAm: new Date().toISOString(),
        schemaVersion: SCHEMA_VERSION,
        letzteSicherung,
        daten: alt
      });
    }
    ersetzeDaten(t, mitStartdaten(daten));
    schreibeMeta(t, META_LETZTE_SICHERUNG, exportiertAm);
  });
}

/** Stellt die interne Kopie wieder her und entfernt sie danach. */
export function machImportRueckgaengig() {
  return mitTransaktion(ALLE_STORES, 'readwrite', async (t) => {
    const kopie = await anfrage(t.objectStore(KOPIE).get(KOPIE_ID));
    if (!kopie) throw new Error('Keine interne Kopie vorhanden');
    ersetzeDaten(t, ergaenzeDaten(kopie.daten, kopie.schemaVersion));
    schreibeMeta(t, META_LETZTE_SICHERUNG, kopie.letzteSicherung);
    t.objectStore(KOPIE).delete(KOPIE_ID);
    return kopie;
  });
}

export function alleUebungen() {
  return mitTransaktion(['uebungen'], 'readonly', (t) => anfrage(t.objectStore('uebungen').getAll()));
}

export function alleTrainingsarten() {
  return mitTransaktion(['trainingsarten'], 'readonly', async (t) => {
    const arten = await anfrage(t.objectStore('trainingsarten').getAll());
    return arten.sort((a, b) => a.reihenfolge - b.reihenfolge);
  });
}

export function speichereUebung(uebung) {
  return mitTransaktion(['uebungen', META], 'readwrite', (t) => {
    t.objectStore('uebungen').add(uebung);
    schreibeMeta(t, META_ENTWURF_UEBUNG, null);
  });
}

export function leseEntwurfUebung() {
  return mitTransaktion([META], 'readonly', (t) => leseMeta(t, META_ENTWURF_UEBUNG));
}

export function setzeEntwurfUebung(entwurf) {
  return mitTransaktion([META], 'readwrite', (t) => {
    schreibeMeta(t, META_ENTWURF_UEBUNG, entwurf);
  });
}

/** Alle Trainingsdaten auf einmal (für Start, Training und Sicherung). */
export function leseDaten() {
  return mitTransaktion(DATEN_STORES, 'readonly', leseAlles);
}

export function speichereTraining(training) {
  return mitTransaktion(['trainings'], 'readwrite', (t) => {
    t.objectStore('trainings').put(training);
  });
}

/** Löscht ein Training samt Sätzen und Cardio-Einträgen (nur für leere Trainings genutzt). */
export function loescheTraining(id) {
  return mitTransaktion(['trainings', 'saetze', 'cardio', META], 'readwrite', async (t) => {
    for (const name of ['saetze', 'cardio']) {
      const keys = await anfrage(t.objectStore(name).index('trainingId').getAllKeys(id));
      keys.forEach((k) => t.objectStore(name).delete(k));
    }
    t.objectStore('trainings').delete(id);
    schreibeMeta(t, META_ENTWURF_SATZ, null);
  });
}

/** Speichert einen Satz bzw. Cardio-Eintrag; gleichzeitig wird der Eingabe-Entwurf gelöscht. */
export function speichereEintrag(store, eintrag) {
  return mitTransaktion([store, META], 'readwrite', (t) => {
    t.objectStore(store).put(eintrag);
    schreibeMeta(t, META_ENTWURF_SATZ, null);
  });
}

export function loescheEintrag(store, id) {
  return mitTransaktion([store, META], 'readwrite', (t) => {
    t.objectStore(store).delete(id);
    schreibeMeta(t, META_ENTWURF_SATZ, null);
  });
}

export function leseEntwurfSatz() {
  return mitTransaktion([META], 'readonly', (t) => leseMeta(t, META_ENTWURF_SATZ));
}

export function setzeEntwurfSatz(entwurf) {
  return mitTransaktion([META], 'readwrite', (t) => {
    schreibeMeta(t, META_ENTWURF_SATZ, entwurf);
  });
}

/** Wo die App zuletzt war ('start' | 'training' | 'vorschau:<artId>'); nur Oberfläche, gehört nicht in die Sicherung. */
export function leseLetzteAnsicht() {
  return mitTransaktion([META], 'readonly', (t) => leseMeta(t, META_ANSICHT));
}

export function setzeLetzteAnsicht(ansicht) {
  return mitTransaktion([META], 'readwrite', (t) => {
    schreibeMeta(t, META_ANSICHT, ansicht);
  });
}

/** Körpergewicht speichern (ein Wert für die ganze App, gehört in die Sicherung). */
export function speichereKoerpergewicht(kg) {
  return mitTransaktion(['koerpergewicht', META], 'readwrite', (t) => {
    t.objectStore('koerpergewicht').put({ id: KOERPERGEWICHT_ID, kg, geaendertAm: new Date().toISOString() });
    schreibeMeta(t, META_KG_GEFRAGT, true);
  });
}

/** Ob die App schon einmal automatisch nach dem Körpergewicht gefragt hat (nur Oberfläche). */
export function leseKoerpergewichtGefragt() {
  return mitTransaktion([META], 'readonly', async (t) => Boolean(await leseMeta(t, META_KG_GEFRAGT)));
}

export function setzeKoerpergewichtGefragt() {
  return mitTransaktion([META], 'readwrite', (t) => {
    schreibeMeta(t, META_KG_GEFRAGT, true);
  });
}

/** Zeitpunkt der letzten Sicherung (ISO) oder null. */
export function leseLetzteSicherung() {
  return mitTransaktion([META], 'readonly', (t) => leseMeta(t, META_LETZTE_SICHERUNG));
}

/** Zuletzt gestartete App-Version (für „Erst sichern?“) oder null. */
export function leseGeseheneVersion() {
  return mitTransaktion([META], 'readonly', (t) => leseMeta(t, META_VERSION));
}

export function setzeGeseheneVersion(version) {
  return mitTransaktion([META], 'readwrite', (t) => {
    schreibeMeta(t, META_VERSION, version);
  });
}
