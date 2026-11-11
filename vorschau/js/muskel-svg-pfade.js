// SVG-Pfade für Muskelfigur (react-muscle-highlighter v1.2.0, MIT)
// Diese Datei enthält die vorkompilierten Pfade zum Inline-Laden
// Die Figur hat zwei Seiten: vorne und hinten

export const MUSKEL_SVG_FILTER = `
<defs>
  <filter id="muskel-karte-filter" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB">
    <feGaussianBlur in="SourceAlpha" stdDeviation="1.8" result="blur"/>
    <!-- Glanzlicht oben links -->
    <feSpecularLighting in="blur" surfaceScale="5" specularConstant="0.9" specularExponent="24" lighting-color="#ffffff" result="spec">
      <feDistantLight azimuth="225" elevation="48"/>
    </feSpecularLighting>
    <feComposite in="spec" in2="SourceAlpha" operator="in" result="specIn"/>
    <!-- Innenschatten unten rechts -->
    <feOffset in="blur" dx="-1.6" dy="-2.2" result="off"/>
    <feComposite in="SourceAlpha" in2="off" operator="out" result="rim"/>
    <feFlood flood-color="#1C2A44" flood-opacity="0.38"/>
    <feComposite in2="rim" operator="in" result="shadow"/>
    <feMerge>
      <feMergeNode in="SourceGraphic"/>
      <feMergeNode in="shadow"/>
    </feMerge>
    <feComposite in2="specIn" operator="arithmetic" k1="0" k2="1" k3="0.55" k4="0" result="lit"/>
    <feComposite in="lit" in2="SourceAlpha" operator="in"/>
  </filter>
  <filter id="muskel-karte-silhouette" x="-50%" y="-50%" width="200%" height="200%">
    <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="coloredBlur"/>
    <feMerge>
      <feMergeNode in="coloredBlur"/>
      <feMergeNode in="SourceGraphic"/>
    </feMerge>
  </filter>
</defs>
`;

// Vereinfachte Muskel-Geometrien für die erste Implementierung
// Die echten Pfade von react-muscle-highlighter folgen später
export const MUSKEL_PFADE_VORNE = {
  chest: {
    slug: 'chest',
    label: 'Chest',
    pathD: 'M200,150 L400,150 L410,220 L390,280 L200,280 L180,220 Z'
  },
  abs: {
    slug: 'abs',
    label: 'Abs',
    pathD: 'M220,290 L380,290 L370,420 L230,420 Z'
  },
  obliques: {
    slug: 'obliques',
    label: 'Obliques',
    pathD: 'M100,300 L200,300 L210,400 L110,400 Z'
  },
  quadriceps: {
    slug: 'quadriceps',
    label: 'Quadriceps',
    pathD: 'M180,430 L420,430 L410,600 L190,600 Z'
  },
  deltoids: {
    slug: 'deltoids',
    label: 'Deltoids',
    pathD: 'M120,80 L160,140 L180,100 Z M420,80 L440,100 L460,140 Z'
  },
  biceps: {
    slug: 'biceps',
    label: 'Biceps',
    pathD: 'M100,150 L140,150 L130,280 L95,280 Z M460,150 L500,150 L505,280 L470,280 Z'
  },
  triceps: {
    slug: 'triceps',
    label: 'Triceps',
    pathD: 'M70,150 L100,150 L100,280 L70,280 Z M500,150 L530,150 L530,280 L500,280 Z'
  },
  forearm: {
    slug: 'forearm',
    label: 'Forearm',
    pathD: 'M70,290 L100,290 L100,400 L70,400 Z M500,290 L530,290 L530,400 L500,400 Z'
  },
  hamstring: {
    slug: 'hamstring',
    label: 'Hamstring',
    pathD: 'M180,610 L420,610 L410,720 L190,720 Z'
  },
  calves: {
    slug: 'calves',
    label: 'Calves',
    pathD: 'M200,730 L400,730 L390,800 L210,800 Z'
  }
};

export const MUSKEL_PFADE_HINTEN = {
  'upper-back': {
    slug: 'upper-back',
    label: 'Upper Back',
    pathD: 'M200,120 L400,120 L410,250 L190,250 Z'
  },
  trapezius: {
    slug: 'trapezius',
    label: 'Trapezius',
    pathD: 'M240,80 L360,80 L370,140 L230,140 Z'
  },
  'lower-back': {
    slug: 'lower-back',
    label: 'Lower Back',
    pathD: 'M220,260 L380,260 L370,350 L230,350 Z'
  },
  gluteal: {
    slug: 'gluteal',
    label: 'Gluteal',
    pathD: 'M180,360 L420,360 L410,460 L190,460 Z'
  },
  hamstring: {
    slug: 'hamstring',
    label: 'Hamstring',
    pathD: 'M180,470 L420,470 L410,610 L190,610 Z'
  },
  calves: {
    slug: 'calves',
    label: 'Calves',
    pathD: 'M200,620 L400,620 L390,740 L210,740 Z'
  },
  deltoids: {
    slug: 'deltoids',
    label: 'Deltoids',
    pathD: 'M120,60 L160,130 L180,80 Z M420,60 L440,80 L460,130 Z'
  },
  triceps: {
    slug: 'triceps',
    label: 'Triceps',
    pathD: 'M70,140 L100,140 L100,260 L70,260 Z M500,140 L530,140 L530,260 L500,260 Z'
  }
};

export default { MUSKEL_SVG_FILTER, MUSKEL_PFADE_VORNE, MUSKEL_PFADE_HINTEN };
