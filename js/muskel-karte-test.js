// Test-Suite für muskel-karte.js

import { getMuskelStufe, getMuskelFarbe } from './muskel-karte.js';

export function runMuskelKarteTests() {
  console.log('=== Muskel-Karte Tests ===\n');

  // Stufen-Tests: Ein Training
  console.log('Stufen – Ein Training:');
  const tests1 = [
    [0, 0], [1, 1], [2.5, 1], [3, 2], [5, 2], [6, 3]
  ];
  for (const [punkte, erwartung] of tests1) {
    const stufe = getMuskelStufe(punkte, 'training');
    const ok = stufe === erwartung ? '✓' : '✗';
    console.log(`  ${ok} ${punkte} Pkte → Stufe ${stufe} (erw. ${erwartung})`);
  }

  // Stufen-Tests: 7 Tage
  console.log('\nStufen – 7 Tage:');
  const tests7 = [
    [0, 0], [3, 1], [5, 1], [7, 2], [10, 2], [12, 3]
  ];
  for (const [punkte, erwartung] of tests7) {
    const stufe = getMuskelStufe(punkte, '7tage');
    const ok = stufe === erwartung ? '✓' : '✗';
    console.log(`  ${ok} ${punkte} Pkte → Stufe ${stufe} (erw. ${erwartung})`);
  }

  // Farben
  console.log('\nFarben:');
  for (let stufe = 0; stufe <= 3; stufe++) {
    console.log(`  Stufe ${stufe}: ${getMuskelFarbe(stufe)}`);
  }

  console.log('\n=== Tests abgeschlossen ===');
}

// Globale Funktion für Browser-Console
if (typeof window !== 'undefined') {
  window.runMuskelKarteTests = runMuskelKarteTests;
}

export default { runMuskelKarteTests };
