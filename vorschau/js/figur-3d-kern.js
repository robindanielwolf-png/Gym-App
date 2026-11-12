// Kern der 3D-Muskelfigur: three.js, Modell, Licht, Kamera und Bedienung. Wird erst geladen, wenn der
// Tab Start sichtbar ist (figur-3d.js). Farben, Licht und Material wie im Prototyp (Design 12.11.2026):
// kein Tone-Mapping, Himmelslicht plus Hauptlicht und schwaches Gegenlicht, das an der Kamera hängt.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const MODELL = new URL('../muskelfigur.glb', import.meta.url).href;

// Stufen 0 (untrainiert) bis 3 wie in der 2D-Figur.
const FARBEN = { 0: '#6A6D73', 1: '#9CC9FF', 2: '#4DA3FF', 3: '#007AFF' };
// Feste Teile: Sehnen, Kopf, Hände, Füße (nicht einfärbbar).
const FEST = { sehnen: '#A3A6AC', neutral: '#6A6D73', kopf: '#BEBEBE', hand: '#BEBEBE', fuss: '#BEBEBE' };

// Das geladene Modell bleibt im Speicher, damit Start nach dem Zurückkommen schnell ist.
let geladen = null;

const material = (hex, rauheit) => new THREE.MeshStandardMaterial({
  color: new THREE.Color(hex),
  roughness: rauheit,
  metalness: 0.0
});

function ladeModell() {
  if (!geladen) {
    geladen = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).loadAsync(MODELL).then((gltf) => {
      const meshes = new Map();
      gltf.scene.traverse((o) => {
        if (!o.isMesh) return;
        const n = o.name;
        o.material = FEST[n] ? material(FEST[n], n === 'sehnen' ? 0.55 : 0.7) : material(FARBEN[0], 0.5);
        meshes.set(n, o);
      });
      const box = new THREE.Box3().setFromObject(gltf.scene);
      return {
        szene: gltf.scene,
        meshes,
        mitte: box.getCenter(new THREE.Vector3()),
        groesse: box.getSize(new THREE.Vector3())
      };
    }).catch((e) => {
      geladen = null;
      throw e;
    });
  }
  return geladen;
}

/** Stufen auf die Muskeln übertragen. Die Kennung steht ohne _l/_r; beide Körperseiten werden gefärbt. */
function faerbe(meshes, stufen) {
  for (const [name, m] of meshes) {
    if (FEST[name]) continue;
    const stufe = stufen[name.replace(/_[lrm]$/, '')] || 0;
    m.material.color.set(FARBEN[stufe]);
    m.material.roughness = stufe ? 0.42 : 0.5;
  }
}

/**
 * Baut die Figur im Platz `stage` auf. Wirft einen Fehler, wenn WebGL fehlt (der Renderer lässt sich
 * dann nicht anlegen). beiVerlust läuft, wenn iOS den WebGL-Kontext nimmt.
 */
export async function baueFigur(stage, stufen, beiVerlust) {
  const { szene: modellSzene, meshes, mitte, groesse } = await ladeModell();

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 3));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  stage.replaceChildren(renderer.domElement);

  const szene = new THREE.Scene();
  const kamera = new THREE.PerspectiveCamera(26, 1, 0.05, 30);
  szene.add(kamera);
  // Das Licht hängt an der Kamera: Das Glanzlicht bleibt oben links, egal wie gedreht wird.
  szene.add(new THREE.HemisphereLight(0xffffff, 0x3c4048, 0.7));
  const hauptlicht = new THREE.DirectionalLight(0xffffff, 3.1);
  hauptlicht.position.set(-2.2, 2.6, 0.5);
  const hauptZiel = new THREE.Object3D();
  hauptZiel.position.set(0, 0, -3);
  kamera.add(hauptlicht, hauptZiel);
  hauptlicht.target = hauptZiel;
  const gegenlicht = new THREE.DirectionalLight(0xffffff, 0.6);
  gegenlicht.position.set(2.5, 0.6, -1);
  const gegenZiel = new THREE.Object3D();
  gegenZiel.position.set(0, 0, -3);
  kamera.add(gegenlicht, gegenZiel);
  gegenlicht.target = gegenZiel;
  szene.add(modellSzene);

  // Bedienung: ein Finger dreht, Zoom und Neigung begrenzt, kein Verschieben, kein Auto-Drehen.
  const steuerung = new OrbitControls(kamera, renderer.domElement);
  steuerung.enablePan = false;
  steuerung.enableDamping = true;
  steuerung.dampingFactor = 0.08;
  steuerung.rotateSpeed = 0.9;
  steuerung.minPolarAngle = Math.PI * 0.32;
  steuerung.maxPolarAngle = Math.PI * 0.62;
  const dist = groesse.y / 2 / Math.tan(THREE.MathUtils.degToRad(kamera.fov / 2)) * 1.04;
  steuerung.target.copy(mitte);
  steuerung.minDistance = dist * 0.45;
  steuerung.maxDistance = dist * 1.1;
  // Ausgangsansicht: 28° schräg von vorne.
  const winkel = THREE.MathUtils.degToRad(-28);
  kamera.position.set(
    mitte.x + Math.sin(winkel) * dist,
    mitte.y + groesse.y * 0.02,
    mitte.z + Math.cos(winkel) * dist
  );
  steuerung.update();

  faerbe(meshes, stufen);

  // Gezeichnet wird nur bei Änderung (Drehen, Stufen, Größe). Ohne Bewegung läuft kein Bild-Takt.
  let frame = 0;
  let lebt = true;
  let neuZeichnen = true;
  const bild = () => {
    frame = 0;
    if (!lebt) return;
    const bewegt = steuerung.update(); // true, solange die Dämpfung nachläuft
    if (neuZeichnen || bewegt) {
      neuZeichnen = false;
      renderer.render(szene, kamera);
    }
    if (bewegt) plane();
  };
  const plane = () => {
    neuZeichnen = true;
    if (!frame && lebt) frame = requestAnimationFrame(bild);
  };
  steuerung.addEventListener('change', plane);

  const groesseAnpassen = () => {
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    kamera.aspect = w / h;
    kamera.updateProjectionMatrix();
    plane();
  };
  const beobachter = new ResizeObserver(groesseAnpassen);
  beobachter.observe(stage);

  const verlust = (e) => {
    e.preventDefault();
    beiVerlust?.();
  };
  renderer.domElement.addEventListener('webglcontextlost', verlust);

  plane();

  return {
    setLevels(neue) {
      faerbe(meshes, neue);
      plane();
    },
    dispose() {
      if (!lebt) return;
      lebt = false;
      cancelAnimationFrame(frame);
      beobachter.disconnect();
      steuerung.dispose();
      szene.remove(modellSzene);
      renderer.domElement.removeEventListener('webglcontextlost', verlust);
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    }
  };
}
