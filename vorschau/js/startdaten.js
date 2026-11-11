// Mitgelieferte Stammdaten. Die IDs sind fest und dürfen sich nie ändern,
// denn Sätze und Sicherungen verweisen auf sie.

export const GERAETE = [
  { id: 'langhantel', label: 'Langhantel', stufe: 2.5, typ: 'kraft' },
  { id: 'kurzhantel', label: 'Kurzhantel', stufe: 2, typ: 'kraft' },
  { id: 'maschine', label: 'Maschine', stufe: 2.5, typ: 'kraft' },
  { id: 'kabel', label: 'Kabel', stufe: 2.5, typ: 'kraft' },
  { id: 'multipresse', label: 'Multipresse', stufe: 2.5, typ: 'kraft' },
  { id: 'kg', label: 'KG', stufe: 2.5, typ: 'kraft' },
  { id: 'cardio', label: 'Cardio', stufe: null, typ: 'cardio' }
];

const geraetNach = new Map(GERAETE.map((g) => [g.id, g]));
export const geraet = (id) => geraetNach.get(id);

const art = (id, name, reihenfolge, icon, vorschlagbar = true) => ({
  id, name, reihenfolge, icon, vorschlagbar, eigen: false, ausgeblendet: false
});

// Reihenfolge wie Screen 01. vorschlagbar steuert später „Als Nächstes dran”.
export const TRAININGSARTEN = [
  art('push', 'Push', 1, 't-push'),
  art('pull', 'Pull', 2, 't-pull'),
  art('beine', 'Beine', 3, 't-beine'),
  art('ruecken-brust', 'Rücken/Brust', 4, 't-ruecken'),
  art('schulter-arme', 'Schulter/Arme', 5, 't-arme'),
  art('bauch', 'Bauch', 6, 't-bauch', false),
  art('cardio', 'Cardio', 7, 't-cardio', false),
  art('oberkoerper', 'Oberkörper', 8, 't-oben'),
  art('unterkoerper', 'Unterkörper', 9, 't-unten'),
  art('zuhause', 'Zuhause', 10, 't-zuhause', false)
];

const PUSH_RB_O = ['push', 'ruecken-brust', 'oberkoerper'];
const PUSH_SA_O = ['push', 'schulter-arme', 'oberkoerper'];
const PULL_SA_O = ['pull', 'schulter-arme', 'oberkoerper'];
const PULL_RB_O = ['pull', 'ruecken-brust', 'oberkoerper'];
const BEINE_U = ['beine', 'unterkoerper'];

// Modus nur bei Gerät KG: 'zusatz' = Zusatzgewicht möglich (0 = ohne), 'nurWdh' = kein Gewicht, 'zeit' = Zeit statt Wdh.
export const MODI = [
  { id: 'zusatz', label: 'Zusatzgewicht möglich' },
  { id: 'nurWdh', label: 'Nur Wdh.' },
  { id: 'zeit', label: 'Zeit (Sekunden)' }
];
export const STANDARD_MODUS = 'zusatz';

const uebung = (id, name, geraetId, artIds, modus = null) => {
  const g = geraet(geraetId);
  return {
    id, name, artIds, geraet: geraetId, typ: g.typ, stufe: g.stufe, eigen: false,
    modus: geraetId === 'kg' ? (modus || STANDARD_MODUS) : null
  };
};

/** Modus der Startliste, auch für die Migration von Schema 1. */
export const startModus = (id) => STARTLISTE.find((u) => u.id === id)?.modus ?? null;

export const STARTLISTE = [
  // Brust / Push
  uebung('s-butterfly-maschine', 'Butterfly Maschine', 'maschine', PUSH_RB_O),
  uebung('s-butterfly-kabel-oben', 'Butterfly Kabelturm – obere Brust', 'kabel', PUSH_RB_O),
  uebung('s-butterfly-kabel-mitte', 'Butterfly Kabelturm – mittlere Brust', 'kabel', PUSH_RB_O),
  uebung('s-butterfly-kabel-unten', 'Butterfly Kabelturm – untere Brust', 'kabel', PUSH_RB_O),
  uebung('s-bankdruecken-frei', 'Bankdrücken frei (Langhantel)', 'langhantel', PUSH_RB_O),
  uebung('s-bankdruecken-gefuehrt', 'Bankdrücken geführt (Multipresse)', 'multipresse', PUSH_RB_O),
  uebung('s-schraegbank-frei', 'Schrägbankdrücken frei (Langhantel)', 'langhantel', PUSH_RB_O),
  uebung('s-schraegbank-gefuehrt', 'Schrägbankdrücken geführt (Multipresse)', 'multipresse', PUSH_RB_O),
  uebung('s-schraegbank-kurzhantel', 'Schrägbankdrücken Kurzhantel', 'kurzhantel', PUSH_RB_O),
  uebung('s-dips', 'Dips', 'kg', ['push', 'ruecken-brust', 'schulter-arme', 'oberkoerper'], 'zusatz'),
  uebung('s-liegestuetze', 'Liegestütze', 'kg', [...PUSH_RB_O, 'zuhause'], 'nurWdh'),

  // Schulter / Arme
  uebung('s-reverse-butterfly', 'Reverse Butterfly', 'maschine', PULL_SA_O),
  uebung('s-seitheben-kurzhantel', 'Seitheben Kurzhantel', 'kurzhantel', [...PUSH_SA_O, 'zuhause']),
  uebung('s-seitheben-kabel', 'Seitheben Kabelturm', 'kabel', PUSH_SA_O),
  uebung('s-bizeps-curls-kabel', 'Bizeps-Curls Kabelturm', 'kabel', PULL_SA_O),
  uebung('s-bizeps-curls-kurzhantel', 'Bizeps-Curls Kurzhantel', 'kurzhantel', [...PULL_SA_O, 'zuhause']),
  uebung('s-hammer-curls-kabel', 'Hammer-Curls Kabelturm', 'kabel', PULL_SA_O),
  uebung('s-hammer-curls-kurzhantel', 'Hammer-Curls Kurzhantel', 'kurzhantel', [...PULL_SA_O, 'zuhause']),
  uebung('s-trizeps-pushdown', 'Trizeps-Pushdown', 'kabel', PUSH_SA_O),
  uebung('s-schulterdruecken-kurzhantel', 'Schulterdrücken Kurzhantel', 'kurzhantel', [...PUSH_SA_O, 'zuhause']),
  uebung('s-face-pulls', 'Face Pulls', 'kabel', PULL_SA_O),

  // Rücken / Pull
  uebung('s-klimmzuege', 'Klimmzüge', 'kg', [...PULL_RB_O, 'zuhause'], 'zusatz'),
  uebung('s-latzug-breit', 'Latzug breit', 'kabel', PULL_RB_O),
  uebung('s-latzug-eng', 'Latzug eng (neutraler Griff)', 'kabel', PULL_RB_O),
  uebung('s-rudern-kabel-sitzend', 'Rudern Kabel sitzend', 'kabel', PULL_RB_O),
  uebung('s-rudermaschine', 'Rudermaschine (brustgestützt)', 'maschine', PULL_RB_O),
  uebung('s-kurzhantelrudern-einarmig', 'Kurzhantelrudern einarmig', 'kurzhantel', [...PULL_RB_O, 'zuhause']),
  uebung('s-rudern-langhantel', 'Rudern Langhantel vorgebeugt', 'langhantel', PULL_RB_O),
  uebung('s-ueberzuege-kabel', 'Überzüge am Kabel (Straight-Arm Pulldown)', 'kabel', PULL_RB_O),
  uebung('s-rueckenstrecker', 'Rückenstrecker (Hyperextensions)', 'kg', ['pull', 'ruecken-brust', 'oberkoerper', 'unterkoerper'], 'nurWdh'),
  uebung('s-kreuzheben', 'Kreuzheben', 'langhantel', ['pull', 'beine', 'unterkoerper']),

  // Beine
  uebung('s-kniebeuge', 'Kniebeuge / Squats (Langhantel)', 'langhantel', BEINE_U),
  uebung('s-hack-squats', 'Hack Squats', 'maschine', BEINE_U),
  uebung('s-beinpresse', 'Beinpresse', 'maschine', BEINE_U),
  uebung('s-beinstrecker', 'Beinstrecker', 'maschine', BEINE_U),
  uebung('s-beinbeuger-liegend', 'Beinbeuger liegend', 'maschine', BEINE_U),
  uebung('s-beinbeuger-sitzend', 'Beinbeuger sitzend', 'maschine', BEINE_U),
  uebung('s-abduktoren', 'Abduktoren Maschine', 'maschine', BEINE_U),
  uebung('s-adduktoren', 'Adduktoren Maschine', 'maschine', BEINE_U),
  uebung('s-wadenheben', 'Wadenheben', 'maschine', BEINE_U),
  uebung('s-rumaenisches-kreuzheben', 'Rumänisches Kreuzheben', 'langhantel', BEINE_U),
  uebung('s-bulgarian-split-squat', 'Bulgarian Split Squat', 'kurzhantel', BEINE_U),

  // Bauch
  uebung('s-kabel-crunch', 'Kabel-Crunch', 'kabel', ['bauch']),
  uebung('s-beinheben-haengend', 'Beinheben hängend', 'kg', ['bauch'], 'nurWdh'),

  // Zuhause
  uebung('s-plank', 'Plank', 'kg', ['bauch', 'zuhause'], 'zeit'),
  uebung('s-sit-ups', 'Sit-ups', 'kg', ['bauch', 'zuhause'], 'nurWdh'),
  uebung('s-kniebeuge-kg', 'Kniebeuge Körpergewicht', 'kg', [...BEINE_U, 'zuhause'], 'nurWdh'),
  uebung('s-seitsstuetz', 'Seitstütz', 'kg', ['bauch', 'zuhause'], 'zeit'),
  uebung('s-wandsitzen', 'Wandsitzen', 'kg', [...BEINE_U, 'zuhause'], 'zeit'),
  uebung('s-ausfallschritte', 'Ausfallschritte', 'kg', [...BEINE_U, 'zuhause'], 'nurWdh'),
  uebung('s-hueftheben', 'Hüftheben (Glute Bridge)', 'kg', [...BEINE_U, 'zuhause'], 'nurWdh'),
  uebung('s-trizeps-dips-stuhl', 'Trizeps-Dips an Stuhl/Bank', 'kg', ['push', 'schulter-arme', 'oberkoerper', 'zuhause'], 'nurWdh'),
  uebung('s-burpees', 'Burpees', 'kg', ['zuhause'], 'nurWdh'),

  // Cardio
  uebung('s-laufband', 'Laufband', 'cardio', ['cardio']),
  uebung('s-ergometer', 'Ergometer (Rad)', 'cardio', ['cardio']),
  uebung('s-crosstrainer', 'Crosstrainer', 'cardio', ['cardio']),
  uebung('s-rudergeraet', 'Rudergerät', 'cardio', ['cardio'])
];
