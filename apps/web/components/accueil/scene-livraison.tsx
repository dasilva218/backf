"use client";

import { useEffect, useRef } from "react";
import {
  AdditiveBlending,
  BoxGeometry,
  BufferGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Float32BufferAttribute,
  Fog,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  Points,
  PointsMaterial,
  QuadraticBezierCurve3,
  RingGeometry,
  Scene,
  SRGBColorSpace,
  TubeGeometry,
  Vector3,
  WebGLRenderer,
  type Material,
} from "three";
import { ZONES, type Zone } from "@/lib/types";

/**
 * Scène 3D du héros : les trois zones desservies, les trajets qui les relient
 * et des colis qui y circulent. Purement décorative (aria-hidden) : les
 * positions évoquent le nord-sud du Grand Libreville, sans être une carte.
 *
 * Les couleurs sont lues dans les variables CSS du thème, pour suivre la
 * marque et le mode sombre sans recopier de valeur ici.
 */

/**
 * Position (x, z) de chaque zone : l'ordre nord-sud est tenu, mais l'axe est
 * couché en diagonale. Aligné sur la visée de la caméra, il empilerait les
 * trois zones l'une derrière l'autre. Libreville est tiré hors de la droite
 * Akanda–Owendo : sur elle, l'arc long traverserait sa balise.
 */
const POSITIONS: Record<Zone, readonly [number, number]> = {
  Akanda: [-2.6, -1.3],
  Libreville: [0.2, 1.1],
  Owendo: [2.5, 1.3],
};

/** Trajets dessinés : départ, arrivée, hauteur de l'arc. */
const ROUTES: ReadonlyArray<readonly [Zone, Zone, number]> = [
  ["Akanda", "Libreville", 1.3],
  ["Libreville", "Owendo", 1.3],
  ["Akanda", "Owendo", 2.4],
];

/**
 * Demi-écart entre les deux voies d'un trajet (aller, retour). Plus large que
 * la moitié d'un colis (0,11), pour que deux colis qui se croisent ne se
 * touchent pas.
 */
const ECART_VOIES = 0.14;
const HAUT = new Vector3(0, 1, 0);
const SEGMENTS_TUBE = 64;
const FACES_TUBE = 8;
const HAUTEUR_ETIQUETTE = 2;
const ANGLE_CAMERA = 0.3;
const DISTANCE_CAMERA = 11;
const HAUTEUR_CAMERA = 5.6;
/** Amplitude de la rotation qui suit le pointeur, en radians. */
const PARALLAXE = 0.35;

const adoucir = (t: number) => 1 - Math.pow(1 - Math.min(Math.max(t, 0), 1), 4);

/** Convertit une variable CSS (oklch compris) en couleur three.js via un canvas 1×1. */
function lireCouleur(hote: HTMLElement, variable: string): Color {
  const sonde = document.createElement("span");
  sonde.style.color = `var(${variable})`;
  hote.appendChild(sonde);
  const css = getComputedStyle(sonde).color;
  sonde.remove();

  const toile = document.createElement("canvas");
  toile.width = toile.height = 1;
  const ctx = toile.getContext("2d", { willReadFrequently: true });
  if (!ctx) return new Color(0x888888);
  ctx.fillStyle = css;
  ctx.fillRect(0, 0, 1, 1);
  const [r = 0, g = 0, b = 0] = ctx.getImageData(0, 0, 1, 1).data;
  return new Color().setRGB(r / 255, g / 255, b / 255, SRGBColorSpace);
}

function positionZone(zone: Zone, y = 0): Vector3 {
  const [x, z] = POSITIONS[zone];
  return new Vector3(x, y, z);
}

function grilleDePoints(): BufferGeometry {
  const pas = 0.32;
  const rayon = 7.5;
  const sommets: number[] = [];
  for (let x = -rayon; x <= rayon; x += pas) {
    for (let z = -rayon; z <= rayon; z += pas) {
      if (x * x + z * z <= rayon * rayon) sommets.push(x, 0, z);
    }
  }
  const geo = new BufferGeometry();
  geo.setAttribute("position", new Float32BufferAttribute(sommets, 3));
  return geo;
}

type Props = { onEchec: () => void };

export function SceneLivraison({ onEchec }: Props) {
  const hoteRef = useRef<HTMLDivElement>(null);
  const etiquettesRef = useRef<Partial<Record<Zone, HTMLSpanElement>>>({});

  useEffect(() => {
    const hote = hoteRef.current;
    if (!hote) return;

    let renderer: WebGLRenderer;
    try {
      renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
    } catch {
      // Pas de WebGL (navigateur ancien, accélération coupée) : le parent affiche le repli.
      onEchec();
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.domElement.className = "absolute inset-0 size-full";
    hote.prepend(renderer.domElement);

    const reduit = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const scene = new Scene();
    const camera = new PerspectiveCamera(35, 1, 0.1, 100);
    // Visée décalée à gauche : la scène glisse à droite et laisse la place à la carte de course.
    const cible = new Vector3(-0.5, 0.1, 0.3);
    let distance = DISTANCE_CAMERA;

    // ─── Lumières et sol ─────────────────────────────────────────────────
    const ciel = new HemisphereLight(0xffffff, 0x000000, 1.4);
    const soleil = new DirectionalLight(0xffffff, 2.4);
    soleil.position.set(4, 8, 5);
    scene.add(ciel, soleil);

    const matPoints = new PointsMaterial({ size: 0.03, transparent: true, opacity: 0.4, depthWrite: false });
    scene.add(new Points(grilleDePoints(), matPoints));

    // ─── Zones : socle hexagonal, balise et onde ─────────────────────────
    const matSocle = new MeshStandardMaterial({ roughness: 0.35, metalness: 0.15, emissiveIntensity: 0.2 });
    const matBalise = new MeshBasicMaterial({
      transparent: true,
      opacity: 0.45,
      blending: AdditiveBlending,
      depthWrite: false,
    });
    const geoSocle = new CylinderGeometry(0.62, 0.72, 0.3, 6);
    const geoBalise = new CylinderGeometry(0.025, 0.025, 1.6, 8);
    const geoOnde = new RingGeometry(0.72, 0.78, 48);

    const zones = ZONES.map((zone) => {
      const groupe = new Group();
      groupe.position.copy(positionZone(zone));
      if (zone === "Libreville") groupe.scale.setScalar(1.15);

      const socle = new Mesh(geoSocle, matSocle);
      socle.position.y = 0.15;
      const balise = new Mesh(geoBalise, matBalise);
      balise.position.y = 0.3 + 0.8;
      const matOnde = new MeshBasicMaterial({ transparent: true, side: DoubleSide, depthWrite: false });
      const onde = new Mesh(geoOnde, matOnde);
      onde.rotation.x = -Math.PI / 2;
      onde.position.y = 0.01;

      groupe.add(socle, balise, onde);
      scene.add(groupe);
      return { zone, groupe, onde, matOnde };
    });

    // ─── Trajets et colis ────────────────────────────────────────────────
    const matRoute = new MeshBasicMaterial({ transparent: true, opacity: 0.6 });
    const matColis = new MeshStandardMaterial({ roughness: 0.55 });
    const geoColis = new BoxGeometry(0.22, 0.16, 0.22);

    /**
     * Une voie par sens, chacune décalée sur sa droite : l'aller et le retour
     * d'un même trajet ne partagent jamais la même courbe.
     */
    const voie = (a: Zone, b: Zone, hauteur: number) => {
      const depart = positionZone(a, 0.32);
      const arrivee = positionZone(b, 0.32);
      const droite = arrivee.clone().sub(depart).cross(HAUT).normalize().multiplyScalar(ECART_VOIES);
      depart.add(droite);
      arrivee.add(droite);
      const sommet = depart.clone().lerp(arrivee, 0.5);
      sommet.y += hauteur;
      const courbe = new QuadraticBezierCurve3(depart, sommet, arrivee);
      const geo = new TubeGeometry(courbe, SEGMENTS_TUBE, 0.018, FACES_TUBE, false);
      scene.add(new Mesh(geo, matRoute));
      return { courbe, geo, total: geo.index?.count ?? 0 };
    };

    const voies = ROUTES.flatMap(([a, b, hauteur]) => [voie(a, b, hauteur), voie(b, a, hauteur)]);

    // Un colis par voie, toujours dans le sens de sa voie : deux colis d'une
    // même voie iraient à la même vitesse et ne se rattraperaient jamais.
    const colis = voies.map(({ courbe }, v) => {
      const mesh = new Mesh(geoColis, matColis);
      scene.add(mesh);
      return { mesh, courbe, decalage: (v % 2) * 0.5 + v * 0.085, vitesse: 0.09 + Math.floor(v / 2) * 0.015 };
    });

    // ─── Couleurs du thème ───────────────────────────────────────────────
    const appliquerCouleurs = () => {
      const primaire = lireCouleur(hote, "--primary");
      const fond = lireCouleur(hote, "--background");
      matPoints.color.copy(lireCouleur(hote, "--foreground"));
      matSocle.color.copy(primaire);
      matSocle.emissive.copy(primaire);
      matBalise.color.copy(primaire);
      matRoute.color.copy(primaire);
      matColis.color.copy(lireCouleur(hote, "--colis"));
      zones.forEach(({ matOnde }) => matOnde.color.copy(primaire));
      ciel.groundColor.copy(fond);
      scene.fog = new Fog(fond, 9, 22);
    };
    appliquerCouleurs();

    // ─── Animation ───────────────────────────────────────────────────────
    const pointeur = { x: 0, y: 0 };
    const lisse = { x: 0, y: 0 };
    const projete = new Vector3();
    const tangente = new Vector3();

    const mettreAJour = (temps: number, dt: number) => {
      // Amortissement : la caméra rattrape le pointeur au lieu de s'y coller.
      const k = Math.min(1, dt * 3);
      lisse.x += (pointeur.x - lisse.x) * k;
      lisse.y += (pointeur.y - lisse.y) * k;
      const angle = ANGLE_CAMERA + Math.sin(temps * 0.15) * 0.18 + lisse.x * PARALLAXE;
      camera.position.set(
        Math.sin(angle) * distance,
        HAUTEUR_CAMERA - lisse.y * 0.8,
        Math.cos(angle) * distance,
      );
      camera.lookAt(cible);
      // `project()` lit la matrice inverse, que render() ne recalcule qu'après coup.
      camera.updateMatrixWorld();

      zones.forEach(({ groupe, onde, matOnde }, i) => {
        const entree = adoucir((temps - i * 0.15) / 1.1);
        groupe.position.y = -1.4 * (1 - entree);
        const cycle = (temps * 0.5 + i * 0.33) % 1;
        onde.scale.setScalar(1 + cycle * 1.6);
        matOnde.opacity = (1 - cycle) * 0.55 * entree;
      });

      const traces = adoucir((temps - 0.6) / 1.2);
      const anneau = FACES_TUBE * 6;
      voies.forEach(({ geo, total }) => {
        geo.setDrawRange(0, Math.floor((total * traces) / anneau) * anneau);
      });

      colis.forEach(({ mesh, courbe, decalage, vitesse }) => {
        const t = (temps * vitesse + decalage) % 1;
        courbe.getPointAt(t, mesh.position);
        mesh.position.y += 0.1;
        courbe.getTangentAt(t, tangente);
        mesh.lookAt(tangente.add(mesh.position));
        // Le colis grossit en quittant une zone et rétrécit en y arrivant.
        mesh.scale.setScalar(Math.max(0.001, Math.min(1, t * 8, (1 - t) * 8) * traces));
      });

      const { clientWidth: l, clientHeight: h } = hote;
      zones.forEach(({ zone, groupe }) => {
        const etiquette = etiquettesRef.current[zone];
        if (!etiquette) return;
        projete.copy(groupe.position).setY(groupe.position.y + HAUTEUR_ETIQUETTE).project(camera);
        const x = (projete.x * 0.5 + 0.5) * l;
        const y = (-projete.y * 0.5 + 0.5) * h;
        etiquette.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
        etiquette.style.opacity = String(adoucir((temps - 1) / 0.6));
      });
    };

    let temps = 0;
    let precedent = 0;
    let actif = false;
    let visible = false;

    const image = (maintenant: number) => {
      const dt = Math.min((maintenant - precedent) / 1000, 0.05);
      precedent = maintenant;
      temps += dt;
      mettreAJour(temps, dt);
      renderer.render(scene, camera);
    };

    /** Une image fixe, intro terminée : mouvement réduit, ou boucle en pause. */
    const imageFixe = () => {
      mettreAJour(reduit ? 6 : temps, reduit ? 1 : 0);
      renderer.render(scene, camera);
    };

    const synchroniser = () => {
      const doitTourner = visible && !document.hidden && !reduit;
      if (doitTourner && !actif) {
        actif = true;
        precedent = performance.now();
        renderer.setAnimationLoop(image);
      } else if (!doitTourner && actif) {
        actif = false;
        renderer.setAnimationLoop(null);
      }
    };

    const redimensionner = () => {
      const { clientWidth: l, clientHeight: h } = hote;
      if (l === 0 || h === 0) return;
      renderer.setSize(l, h, false);
      camera.aspect = l / h;
      // Sur un écran étroit, on recule pour garder les trois zones dans le cadre.
      distance = DISTANCE_CAMERA * Math.max(1, 1.15 / camera.aspect);
      camera.updateProjectionMatrix();
      if (!actif) imageFixe();
    };

    const surPointeur = (e: PointerEvent) => {
      pointeur.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointeur.y = (e.clientY / window.innerHeight) * 2 - 1;
    };

    const surTheme = () => {
      appliquerCouleurs();
      if (!actif) imageFixe();
    };

    const observateurTaille = new ResizeObserver(redimensionner);
    observateurTaille.observe(hote);
    const observateurVue = new IntersectionObserver(([entree]) => {
      visible = entree?.isIntersecting ?? false;
      synchroniser();
    });
    observateurVue.observe(hote);
    const schema = window.matchMedia("(prefers-color-scheme: dark)");
    schema.addEventListener("change", surTheme);
    document.addEventListener("visibilitychange", synchroniser);
    if (!reduit) window.addEventListener("pointermove", surPointeur, { passive: true });

    return () => {
      renderer.setAnimationLoop(null);
      observateurTaille.disconnect();
      observateurVue.disconnect();
      schema.removeEventListener("change", surTheme);
      document.removeEventListener("visibilitychange", synchroniser);
      window.removeEventListener("pointermove", surPointeur);

      const materiaux = new Set<Material>();
      scene.traverse((objet) => {
        if (objet instanceof Mesh || objet instanceof Points) {
          objet.geometry.dispose();
          [objet.material].flat().forEach((m: Material) => materiaux.add(m));
        }
      });
      materiaux.forEach((m) => m.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [onEchec]);

  return (
    <div ref={hoteRef} aria-hidden className="absolute inset-0 overflow-hidden">
      {ZONES.map((zone) => (
        <span
          key={zone}
          ref={(el) => {
            etiquettesRef.current[zone] = el ?? undefined;
          }}
          className="pointer-events-none absolute top-0 left-0 rounded-full border border-primary/25 bg-background/70 px-2.5 py-1 text-xs font-medium whitespace-nowrap opacity-0 shadow-sm backdrop-blur-md"
        >
          {zone}
        </span>
      ))}
    </div>
  );
}
