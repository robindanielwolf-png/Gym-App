// Mitgelieferte Stammdaten. Die IDs sind fest und dürfen sich nie ändern,
// denn Sätze und Sicherungen verweisen auf sie.

// 16 Muskelgruppen nach react-muscle-highlighter v1.2.0 (Slugs)
// Lizenz: MIT (github.com/soroojshehryar/react-muscle-highlighter)
export const MUSKELN = [
  // Beine & Gesäß
  { id: 'quadriceps', label: 'Quadriceps', kategorie: 'Beine' },
  { id: 'hamstring', label: 'Hamstring', kategorie: 'Beine' },
  { id: 'gluteal', label: 'Gluteal', kategorie: 'Beine' },
  { id: 'adductors', label: 'Adductors', kategorie: 'Beine' },
  { id: 'calves', label: 'Calves', kategorie: 'Beine' },

  // Bauch & Seite
  { id: 'abs', label: 'Abs', kategorie: 'Bauch' },
  { id: 'obliques', label: 'Obliques', kategorie: 'Bauch' },

  // Rücken
  { id: 'upper-back', label: 'Upper Back (Lats)', kategorie: 'Rücken' },
  { id: 'lower-back', label: 'Lower Back', kategorie: 'Rücken' },
  { id: 'trapezius', label: 'Trapezius', kategorie: 'Rücken' },

  // Brust
  { id: 'chest', label: 'Chest', kategorie: 'Brust' },

  // Arme & Schultern
  { id: 'biceps', label: 'Biceps', kategorie: 'Arme' },
  { id: 'triceps', label: 'Triceps', kategorie: 'Arme' },
  { id: 'forearm', label: 'Forearm', kategorie: 'Arme' },
  { id: 'deltoids', label: 'Deltoids', kategorie: 'Schultern' },

  // Schienbein (wird nicht trainiert, aber vorhanden)
  { id: 'tibialis', label: 'Tibialis', kategorie: 'Beine' }
];


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

// Muskeln-Shortcuts für häufig kombinierte Muskeln
const PECTORALIS_TRIZEPS = [
  { id: 'chest', rolle: 'haupt' },
  { id: 'triceps', rolle: 'hilf' }
];
const LATISSIMUS_BIZEPS = [
  { id: 'upper-back', rolle: 'haupt' },
  { id: 'biceps', rolle: 'hilf' }
];
const QUADRIZEPS_GLUTE = [
  { id: 'quadriceps', rolle: 'haupt' },
  { id: 'gluteal', rolle: 'hilf' }
];

// Modus nur bei Gerät KG: 'zusatz' = Zusatzgewicht möglich (0 = ohne), 'nurWdh' = kein Gewicht, 'zeit' = Zeit statt Wdh.
export const MODI = [
  { id: 'zusatz', label: 'Zusatzgewicht möglich' },
  { id: 'nurWdh', label: 'Nur Wdh.' },
  { id: 'zeit', label: 'Zeit (Sekunden)' }
];
export const STANDARD_MODUS = 'zusatz';

const uebung = (id, name, geraetId, artIds, muskeln = [], modus = null) => {
  const g = geraet(geraetId);
  return {
    id, name, artIds, geraet: geraetId, typ: g.typ, stufe: g.stufe, eigen: false,
    muskeln: muskeln,
    modus: geraetId === 'kg' ? (modus || STANDARD_MODUS) : null
  };
};

/** Modus der Startliste, auch für die Migration von Schema 1. */
export const startModus = (id) => STARTLISTE.find((u) => u.id === id)?.modus ?? null;

export const STARTLISTE = [
  // Brust / Push
  uebung('s-butterfly-maschine', 'Butterfly Maschine', 'maschine', PUSH_RB_O, [
    { id: 'chest', rolle: 'haupt' }
  ]),
  uebung('s-butterfly-kabel-oben', 'Butterfly Kabelturm – obere Brust', 'kabel', PUSH_RB_O, [
    { id: 'chest', rolle: 'haupt' }
  ]),
  uebung('s-butterfly-kabel-mitte', 'Butterfly Kabelturm – mittlere Brust', 'kabel', PUSH_RB_O, [
    { id: 'chest', rolle: 'haupt' }
  ]),
  uebung('s-butterfly-kabel-unten', 'Butterfly Kabelturm – untere Brust', 'kabel', PUSH_RB_O, [
    { id: 'chest', rolle: 'haupt' }
  ]),
  uebung('s-bankdruecken-frei', 'Bankdrücken frei (Langhantel)', 'langhantel', PUSH_RB_O, PECTORALIS_TRIZEPS),
  uebung('s-bankdruecken-gefuehrt', 'Bankdrücken geführt (Multipresse)', 'multipresse', PUSH_RB_O, PECTORALIS_TRIZEPS),
  uebung('s-schraegbank-frei', 'Schrägbankdrücken frei (Langhantel)', 'langhantel', PUSH_RB_O, PECTORALIS_TRIZEPS),
  uebung('s-schraegbank-gefuehrt', 'Schrägbankdrücken geführt (Multipresse)', 'multipresse', PUSH_RB_O, PECTORALIS_TRIZEPS),
  uebung('s-schraegbank-kurzhantel', 'Schrägbankdrücken Kurzhantel', 'kurzhantel', PUSH_RB_O, PECTORALIS_TRIZEPS),
  uebung('s-dips', 'Dips', 'kg', ['push', 'ruecken-brust', 'schulter-arme', 'oberkoerper'], [
    { id: 'chest', rolle: 'haupt' },
    { id: 'triceps', rolle: 'haupt' }
  ], 'zusatz'),
  uebung('s-liegestuetze', 'Liegestütze', 'kg', [...PUSH_RB_O, 'zuhause'], PECTORALIS_TRIZEPS, 'nurWdh'),

  // Schulter / Arme
  uebung('s-reverse-butterfly', 'Reverse Butterfly', 'maschine', PULL_SA_O, [
    { id: 'deltoids', rolle: 'haupt' },
    { id: 'trapezius', rolle: 'hilf' }
  ]),
  uebung('s-seitheben-kurzhantel', 'Seitheben Kurzhantel', 'kurzhantel', [...PUSH_SA_O, 'zuhause'], [
    { id: 'deltoids', rolle: 'haupt' }
  ]),
  uebung('s-seitheben-kabel', 'Seitheben Kabelturm', 'kabel', PUSH_SA_O, [
    { id: 'deltoids', rolle: 'haupt' }
  ]),
  uebung('s-bizeps-curls-kabel', 'Bizeps-Curls Kabelturm', 'kabel', PULL_SA_O, [
    { id: 'biceps', rolle: 'haupt' },
    { id: 'forearm', rolle: 'hilf' }
  ]),
  uebung('s-bizeps-curls-kurzhantel', 'Bizeps-Curls Kurzhantel', 'kurzhantel', [...PULL_SA_O, 'zuhause'], [
    { id: 'biceps', rolle: 'haupt' },
    { id: 'forearm', rolle: 'hilf' }
  ]),
  uebung('s-hammer-curls-kabel', 'Hammer-Curls Kabelturm', 'kabel', PULL_SA_O, [
    { id: 'biceps', rolle: 'haupt' },
    { id: 'forearm', rolle: 'haupt' }
  ]),
  uebung('s-hammer-curls-kurzhantel', 'Hammer-Curls Kurzhantel', 'kurzhantel', [...PULL_SA_O, 'zuhause'], [
    { id: 'biceps', rolle: 'haupt' },
    { id: 'forearm', rolle: 'haupt' }
  ]),
  uebung('s-trizeps-pushdown', 'Trizeps-Pushdown', 'kabel', PUSH_SA_O, [
    { id: 'triceps', rolle: 'haupt' }
  ]),
  uebung('s-schulterdruecken-kurzhantel', 'Schulterdrücken Kurzhantel', 'kurzhantel', [...PUSH_SA_O, 'zuhause'], [
    { id: 'deltoids', rolle: 'haupt' },
    { id: 'triceps', rolle: 'hilf' }
  ]),
  uebung('s-face-pulls', 'Face Pulls', 'kabel', PULL_SA_O, [
    { id: 'deltoids', rolle: 'haupt' },
    { id: 'trapezius', rolle: 'hilf' }
  ]),

  // Rücken / Pull
  uebung('s-klimmzuege', 'Klimmzüge', 'kg', [...PULL_RB_O, 'zuhause'], LATISSIMUS_BIZEPS, 'zusatz'),
  uebung('s-latzug-breit', 'Latzug breit', 'kabel', PULL_RB_O, LATISSIMUS_BIZEPS),
  uebung('s-latzug-eng', 'Latzug eng (neutraler Griff)', 'kabel', PULL_RB_O, LATISSIMUS_BIZEPS),
  uebung('s-rudern-kabel-sitzend', 'Rudern Kabel sitzend', 'kabel', PULL_RB_O, [
    { id: 'upper-back', rolle: 'haupt' },
    { id: 'trapezius', rolle: 'hilf' },
    { id: 'upper-back', rolle: 'hilf' }
  ]),
  uebung('s-rudermaschine', 'Rudermaschine (brustgestützt)', 'maschine', PULL_RB_O, [
    { id: 'upper-back', rolle: 'haupt' },
    { id: 'trapezius', rolle: 'hilf' },
    { id: 'upper-back', rolle: 'hilf' }
  ]),
  uebung('s-kurzhantelrudern-einarmig', 'Kurzhantelrudern einarmig', 'kurzhantel', [...PULL_RB_O, 'zuhause'], [
    { id: 'upper-back', rolle: 'haupt' },
    { id: 'trapezius', rolle: 'hilf' }
  ]),
  uebung('s-rudern-langhantel', 'Rudern Langhantel vorgebeugt', 'langhantel', PULL_RB_O, [
    { id: 'upper-back', rolle: 'haupt' },
    { id: 'trapezius', rolle: 'hilf' },
    { id: 'upper-back', rolle: 'hilf' }
  ]),
  uebung('s-ueberzuege-kabel', 'Überzüge am Kabel (Straight-Arm Pulldown)', 'kabel', PULL_RB_O, [
    { id: 'upper-back', rolle: 'haupt' },
    { id: 'chest', rolle: 'hilf' }
  ]),
  uebung('s-rueckenstrecker', 'Rückenstrecker (Hyperextensions)', 'kg', ['pull', 'ruecken-brust', 'oberkoerper', 'unterkoerper'], [
    { id: 'lower-back', rolle: 'haupt' }
  ], 'nurWdh'),
  uebung('s-kreuzheben', 'Kreuzheben', 'langhantel', ['pull', 'beine', 'unterkoerper'], [
    { id: 'lower-back', rolle: 'haupt' },
    { id: 'upper-back', rolle: 'hilf' },
    { id: 'hamstring', rolle: 'hilf' }
  ]),

  // Beine
  uebung('s-kniebeuge', 'Kniebeuge / Squats (Langhantel)', 'langhantel', BEINE_U, QUADRIZEPS_GLUTE),
  uebung('s-hack-squats', 'Hack Squats', 'maschine', BEINE_U, QUADRIZEPS_GLUTE),
  uebung('s-beinpresse', 'Beinpresse', 'maschine', BEINE_U, QUADRIZEPS_GLUTE),
  uebung('s-beinstrecker', 'Beinstrecker', 'maschine', BEINE_U, [
    { id: 'quadriceps', rolle: 'haupt' }
  ]),
  uebung('s-beinbeuger-liegend', 'Beinbeuger liegend', 'maschine', BEINE_U, [
    { id: 'hamstring', rolle: 'haupt' }
  ]),
  uebung('s-beinbeuger-sitzend', 'Beinbeuger sitzend', 'maschine', BEINE_U, [
    { id: 'hamstring', rolle: 'haupt' }
  ]),
  uebung('s-abduktoren', 'Abduktoren Maschine', 'maschine', BEINE_U, [
    { id: 'gluteal', rolle: 'haupt' }
  ]),
  uebung('s-adduktoren', 'Adduktoren Maschine', 'maschine', BEINE_U, [
    { id: 'adductors', rolle: 'haupt' }
  ]),
  uebung('s-wadenheben', 'Wadenheben', 'maschine', BEINE_U, [
    { id: 'calves', rolle: 'haupt' }
  ]),
  uebung('s-rumaenisches-kreuzheben', 'Rumänisches Kreuzheben', 'langhantel', BEINE_U, [
    { id: 'hamstring', rolle: 'haupt' },
    { id: 'lower-back', rolle: 'hilf' }
  ]),
  uebung('s-bulgarian-split-squat', 'Bulgarian Split Squat', 'kurzhantel', BEINE_U, QUADRIZEPS_GLUTE),

  // Bauch
  uebung('s-kabel-crunch', 'Kabel-Crunch', 'kabel', ['bauch'], [
    { id: 'abs', rolle: 'haupt' }
  ]),
  uebung('s-beinheben-haengend', 'Beinheben hängend', 'kg', ['bauch'], [
    { id: 'abs', rolle: 'haupt' }
  ], 'nurWdh'),

  // Zuhause
  uebung('s-plank', 'Plank', 'kg', ['bauch', 'zuhause'], [
    { id: 'abs', rolle: 'haupt' },
    { id: 'obliques', rolle: 'hilf' }
  ], 'zeit'),
  uebung('s-sit-ups', 'Sit-ups', 'kg', ['bauch', 'zuhause'], [
    { id: 'abs', rolle: 'haupt' }
  ], 'nurWdh'),
  uebung('s-kniebeuge-kg', 'Kniebeuge Körpergewicht', 'kg', [...BEINE_U, 'zuhause'], QUADRIZEPS_GLUTE, 'nurWdh'),
  uebung('s-seitsstuetz', 'Seitstütz', 'kg', ['bauch', 'zuhause'], [
    { id: 'obliques', rolle: 'haupt' }
  ], 'zeit'),
  uebung('s-wandsitzen', 'Wandsitzen', 'kg', [...BEINE_U, 'zuhause'], [
    { id: 'quadriceps', rolle: 'haupt' }
  ], 'zeit'),
  uebung('s-ausfallschritte', 'Ausfallschritte', 'kg', [...BEINE_U, 'zuhause'], QUADRIZEPS_GLUTE, 'nurWdh'),
  uebung('s-hueftheben', 'Hüftheben (Glute Bridge)', 'kg', [...BEINE_U, 'zuhause'], [
    { id: 'gluteal', rolle: 'haupt' }
  ], 'nurWdh'),
  uebung('s-trizeps-dips-stuhl', 'Trizeps-Dips an Stuhl/Bank', 'kg', ['push', 'schulter-arme', 'oberkoerper', 'zuhause'], [
    { id: 'triceps', rolle: 'haupt' }
  ], 'nurWdh'),
  uebung('s-burpees', 'Burpees', 'kg', ['zuhause'], [
    { id: 'abs', rolle: 'haupt' },
    { id: 'quadriceps', rolle: 'hilf' }
  ], 'nurWdh'),

  // Cardio
  uebung('s-laufband', 'Laufband', 'cardio', ['cardio'], []),
  uebung('s-ergometer', 'Ergometer (Rad)', 'cardio', ['cardio'], []),
  uebung('s-crosstrainer', 'Crosstrainer', 'cardio', ['cardio'], []),
  uebung('s-rudergeraet', 'Rudergerät', 'cardio', ['cardio'], [])
];
