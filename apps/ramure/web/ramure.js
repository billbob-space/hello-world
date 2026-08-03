// RAMURE — le client.
//
// Trois idees structurent ce fichier, et chacune vient d'une exigence dont le
// non-respect ne produirait aucune erreur visible en developpement :
//
//  1. UNE GENERATION PAR NAVIGATION. Chaque plantation ou promotion incremente
//     un compteur ; toute reponse qui revient sous une generation perimee est
//     JETEE. Sans cela, l'utilisateur qui enchaine les promotions voit arriver
//     l'entourage d'un artiste qu'il a deja quitte (§09, "les reponses tardives
//     sont ignorees, pas appliquees" — et F-13).
//
//  2. LA SCENE N'EST JAMAIS RECONSTRUITE. Les noeuds sont conserves d'un arbre
//     a l'autre par identifiant, et le noeud promu est celui-la meme qui voyage
//     vers le centre. C'est la F-12 : "le noeud choisi reste visible durant
//     toute la transition ; aucun clignotement ni reconstruction de la scene".
//     Un rendu qui reconstruirait tout ferait clignoter les pochettes, meme en
//     restituant exactement la meme image.
//
//  3. TROIS ETATS, PAS UN BOOLEEN. "ok", "vide" et "panne" sont portes jusqu'ici
//     par le serveur et traites separement partout. La F-36 est marquee critique
//     par le PRD, et la seule facon de ne pas la perdre est de ne jamais les
//     reduire a "il y a des donnees ou il n'y en a pas".

// ═══ Etat ══════════════════════════════════════════════════════════════

const etat = {
  centre: null,
  branches: [],
  lignee: [],            // suite des centres traverses (§05)
  fiche: null,
  collection: [],
  reglage: { serviceEcoute: "deezer", triMur: "recents" },
  compte: false,
  tirage: 0,
  generation: 0,
  murTuiles: [],
  visites: new Set(),    // M-02 : centres deja vus dans cette session
  filtreDisco: null,
  filtrePalmares: null,
  journal: [],           // N-10 : journal de session exportable
};

const idSession = (crypto.randomUUID?.() ?? String(Math.random())).slice(0, 32);

// La preference de mouvement reduit est lue a chaud plutot que capturee une
// fois : elle peut changer pendant la session, et §11 exige que les animations
// soient NEUTRALISEES, pas raccourcies.
const mouvementReduit = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const large = () => window.matchMedia("(min-width: 900px)").matches;

const $ = (id) => document.getElementById(id);

// ═══ Journal de diagnostic (N-10) ══════════════════════════════════════

function note(genre, message, extra) {
  etat.journal.push({ t: new Date().toISOString(), genre, message, ...extra });
  if (etat.journal.length > 400) etat.journal.splice(0, 100);
}

// ═══ Mesures (N-09) ════════════════════════════════════════════════════
// L'agregation se fait cote serveur ; le client ne fait qu'emettre. Un echec
// d'emission est ignore en silence : l'instrumentation ne doit jamais degrader
// l'usage.

function mesure(evenement, latenceMs) {
  fetch("api/mesure", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Ramure-Session": idSession },
    body: JSON.stringify({ evenement, latenceMs }),
    keepalive: true,
  }).catch(() => {});
}

// ═══ Client d'API ══════════════════════════════════════════════════════

class Panne extends Error {
  constructor(message, reessayable) {
    super(message);
    this.reessayable = reessayable;
  }
}
class Vide extends Error {}

// appelle enrobe fetch et traduit les trois etats du serveur en trois issues
// distinctes cote client. Le point important est le traitement des reponses
// non JSON : quand la session Google expire, Traefik intercepte l'appel et
// repond une page de connexion. Sans ce test, le client afficherait "requete
// illisible" — exactement le message qui laisse croire a une erreur de saisie
// que la F-41 interdit.
async function appelle(chemin, options = {}) {
  let rep;
  try {
    rep = await fetch(chemin, {
      ...options,
      headers: { "X-Ramure-Session": idSession, ...(options.headers || {}) },
    });
  } catch (e) {
    note("reseau", chemin, { erreur: String(e) });
    throw new Panne("Le réseau n'a pas répondu.", true);
  }

  if (rep.status === 401 || rep.status === 403 || rep.redirected) {
    sessionExpiree();
    throw new Panne("Session expirée.", false);
  }

  const type = rep.headers.get("content-type") || "";
  if (!type.includes("application/json")) {
    if (rep.status === 204) return null;
    sessionExpiree();
    throw new Panne("Session expirée.", false);
  }

  const corps = await rep.json();
  note("api", chemin, { etat: corps.etat, budget: corps.budget?.total });

  if (corps.etat === "panne") throw new Panne(corps.message, corps.reessayable !== false);
  if (corps.etat === "vide") throw new Vide(corps.message);
  if (corps.etat === "refus") throw new Panne(corps.message, false);
  return corps;
}

// ═══ Repli graphique déterministe ══════════════════════════════════════
// "Un repli graphique deterministe et stable tient la place, sans provoquer de
// decalage a l'arrivee de l'image" (§11). Deterministe : le meme artiste a
// toujours la meme teinte, d'une session a l'autre et d'un appareil a l'autre.

function empreinte(texte) {
  let h = 0;
  for (let i = 0; i < texte.length; i++) h = (h * 31 + texte.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function initiales(nom) {
  return nom
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((m) => m[0])
    .join("")
    .toUpperCase();
}

function teinteRepli(nom) {
  // Les teintes restent dans la famille bleu-vert de la planche : le repli ne
  // doit pas introduire une couleur que le produit n'utilise nulle part
  // ailleurs.
  const t = 165 + (empreinte(nom) % 55);
  return `hsl(${t} 32% 18%)`;
}

// urlImage valide une adresse d'illustration avant de l'inserer dans une
// declaration CSS ou un attribut SVG.
//
// Les adresses viennent d'une source externe : elles ne sont pas de confiance,
// meme si elles transitent par notre serveur. Une adresse contenant un guillemet
// ou une parenthese s'echapperait de url("...") et permettrait d'injecter de la
// CSS arbitraire ; un schema javascript: dans un attribut href SVG s'executerait.
// On n'accepte donc que https, et on rejette tout ce qui pourrait fermer la
// chaine — plutot que d'echapper, ce qui laisse toujours un cas oublie.
function urlImage(brute) {
  if (typeof brute !== "string" || brute.length > 2048) return "";
  if (/["'()\\\s<>]/.test(brute)) return "";
  try {
    return new URL(brute).protocol === "https:" ? brute : "";
  } catch {
    return "";
  }
}

// fond pose une image de fond validee, ou retombe sur le repli deterministe.
//
// La validation de l'URL ne suffit PAS. Une adresse parfaitement formee dont le
// chargement echoue — reseau coupe, hote injoignable, 404 — laissait une boite
// teintee vide : le repli graphique deterministe n'etait jamais rendu, alors que
// la §11 exige qu'"aucune illustration manquante ne laisse un vide". On sonde
// donc le chargement reel, et on retombe sur les initiales quand il echoue.
function fond(element, image, nom, { initialesSiVide = false, surEchec } = {}) {
  const url = urlImage(image);

  const repli = () => {
    element.style.backgroundImage = "none";
    element.style.background = teinteRepli(nom);
    if (initialesSiVide) element.textContent = initiales(nom);
    surEchec?.();
  };

  if (!url) { repli(); return false; }

  element.style.backgroundImage = `url("${url}")`;
  element.textContent = "";

  // La sonde ne coute pas un second telechargement : le navigateur sert la
  // meme entree de cache que la propriete background-image.
  const sonde = new Image();
  sonde.onerror = repli;
  sonde.src = url;

  return true;
}

// ═══ Annonces aux technologies d'assistance ════════════════════════════

function annonce(texte) {
  const zone = $("annonce");
  zone.textContent = "";
  // Le vidage puis le remplissage force la relecture quand deux annonces
  // successives portent le meme texte.
  requestAnimationFrame(() => { zone.textContent = texte; });
}

function alerte(texte) {
  $("alerte").textContent = texte;
}

// ═══ Bandeau flottant : mise à jour, session, correction ═══════════════

let minuterieBandeau = null;

function bandeau(texte, { action, libelle, genre = "info", duree = 0 } = {}) {
  const b = $("bandeau-flottant");
  const bouton = $("bandeau-flottant-action");

  $("bandeau-flottant-texte").textContent = texte;
  b.dataset.genre = genre;
  b.hidden = false;

  bouton.hidden = !action;
  if (action) {
    bouton.textContent = libelle;
    bouton.onclick = action;
  }

  clearTimeout(minuterieBandeau);
  if (duree) minuterieBandeau = setTimeout(fermeBandeau, duree);
}

function fermeBandeau() {
  $("bandeau-flottant").hidden = true;
}

// F-41 : la session a expire. Le message dit ce qui s'est passe et propose de
// se reconnecter — il ne laisse jamais croire a une erreur de saisie.
let sessionDejaSignalee = false;
function sessionExpiree() {
  if (sessionDejaSignalee) return;
  sessionDejaSignalee = true;
  note("session", "expiree");
  bandeau("Ta session a expiré. Reconnecte-toi pour retrouver ta collection.", {
    action: () => location.reload(),
    libelle: "Se reconnecter",
    genre: "alerte",
  });
}

// ═══ La caméra ═════════════════════════════════════════════════════════
// §11 : le zoom rapproche vraiment (toute la scene grossit, illustrations
// comprises — d'ou une transformation SVG unique plutot qu'un redimensionnement
// des pastilles), il est centre sur le point designe, borne, et un retour au
// cadrage neutre est propose des que la vue a bouge.

const camera = { x: 0, y: 0, k: 1, bouge: false };
const ZOOM_MIN = 0.42;
const ZOOM_MAX = 3.6;

function appliqueCamera(anime = false) {
  const g = $("camera");
  g.style.transition = anime && !mouvementReduit()
    ? "transform var(--duree-promotion) var(--deplacement)"
    : "none";
  g.setAttribute("transform", `translate(${camera.x} ${camera.y}) scale(${camera.k})`);

  // "Un retour au cadrage neutre est propose des que la vue a ete modifiee."
  $("recadrer").hidden = !camera.bouge;
}

function zoomeVers(px, py, facteur) {
  const k = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, camera.k * facteur));
  if (k === camera.k) return;

  // Le point vise reste sous le doigt : c'est la formule qui distingue un zoom
  // "vers le curseur" d'un zoom vers le centre de l'ecran.
  camera.x = px - (px - camera.x) * (k / camera.k);
  camera.y = py - (py - camera.y) * (k / camera.k);
  camera.k = k;
  camera.bouge = true;
  appliqueCamera();
}

function recadre(anime = true) {
  camera.x = 0;
  camera.y = 0;
  camera.k = 1;
  camera.bouge = false;
  appliqueCamera(anime);
}

function installeCamera() {
  const scene = $("scene");

  // "Les deux gestes sont distincts : le geste de zoom zoome, le geste de
  // defilement deplace. Aucune ambiguite." Le pincement de pave tactile arrive
  // en wheel+ctrlKey ; la molette et le defilement a deux doigts arrivent sans.
  scene.addEventListener("wheel", (e) => {
    e.preventDefault();
    const r = scene.getBoundingClientRect();

    if (e.ctrlKey) {
      zoomeVers(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.01));
    } else {
      camera.x -= e.deltaX;
      camera.y -= e.deltaY;
      camera.bouge = true;
      appliqueCamera();
    }
  }, { passive: false });

  // Deplacement et pincement, en pointer events pour couvrir souris, doigt et
  // stylet du meme code.
  const doigts = new Map();
  let depart = null;

  scene.addEventListener("pointerdown", (e) => {
    if (e.target.closest(".noeud")) return;   // un appui sur un noeud navigue
    scene.setPointerCapture(e.pointerId);
    doigts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    scene.dataset.deplace = "oui";

    if (doigts.size === 2) {
      const [a, b] = [...doigts.values()];
      depart = { d: Math.hypot(a.x - b.x, a.y - b.y), k: camera.k };
    }
  });

  scene.addEventListener("pointermove", (e) => {
    const precedent = doigts.get(e.pointerId);
    if (!precedent) return;

    if (doigts.size === 2 && depart) {
      doigts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const [a, b] = [...doigts.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const r = scene.getBoundingClientRect();
      const mx = (a.x + b.x) / 2 - r.left;
      const my = (a.y + b.y) / 2 - r.top;

      // "Une commande produit une animation, un geste n'en produit pas : la vue
      // doit suivre le doigt sans retard perceptible." D'ou une application
      // directe, sans transition.
      const cible = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, depart.k * (d / depart.d)));
      camera.x = mx - (mx - camera.x) * (cible / camera.k);
      camera.y = my - (my - camera.y) * (cible / camera.k);
      camera.k = cible;
      camera.bouge = true;
      appliqueCamera();
      return;
    }

    camera.x += e.clientX - precedent.x;
    camera.y += e.clientY - precedent.y;
    camera.bouge = true;
    doigts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    appliqueCamera();
  });

  const relache = (e) => {
    doigts.delete(e.pointerId);
    if (doigts.size < 2) depart = null;
    if (doigts.size === 0) delete scene.dataset.deplace;
  };
  scene.addEventListener("pointerup", relache);
  scene.addEventListener("pointercancel", relache);

  // Le clavier pilote la camera aussi : sans cela, un utilisateur sans souris
  // ne pourrait ni zoomer ni deplacer (§12, "tout est atteignable au clavier").
  scene.addEventListener("keydown", (e) => {
    const pas = 60;
    const r = scene.getBoundingClientRect();
    const actions = {
      ArrowUp: () => (camera.y += pas),
      ArrowDown: () => (camera.y -= pas),
      ArrowLeft: () => (camera.x += pas),
      ArrowRight: () => (camera.x -= pas),
      "+": () => zoomeVers(r.width / 2, r.height / 2, 1.2),
      "=": () => zoomeVers(r.width / 2, r.height / 2, 1.2),
      "-": () => zoomeVers(r.width / 2, r.height / 2, 1 / 1.2),
      "0": () => recadre(),
    };
    const action = actions[e.key];
    if (!action) return;
    e.preventDefault();
    action();
    if (e.key !== "0") { camera.bouge = true; appliqueCamera(); }
  });

  $("zoom-plus").onclick = () => {
    const r = scene.getBoundingClientRect();
    zoomeVers(r.width / 2, r.height / 2, 1.25);
  };
  $("zoom-moins").onclick = () => {
    const r = scene.getBoundingClientRect();
    zoomeVers(r.width / 2, r.height / 2, 1 / 1.25);
  };
  $("recadrer").onclick = () => recadre();
}

// ═══ Géométrie du canevas ══════════════════════════════════════════════
// Les grandeurs normalisees (rayon, taille, angle) sont calculees au serveur
// et testees en Go ; le client ne fait que les multiplier par les dimensions
// de sa fenetre. La marge reservee est celle de la §11 : "une marge est
// reservee sur les bords pour que les libelles et les grappes d'heritiers ne
// soient jamais rognes par les panneaux".

function cadre() {
  const r = $("canevas").getBoundingClientRect();
  const fiche = $("fiche");
  const ouverte = !fiche.hidden && fiche.dataset.replie !== "oui";

  // "Le canevas se recale sur l'espace restant quand un panneau s'ouvre ou se
  // replie" (§07). Sur ecran large la fiche mange la DROITE, sur ecran etroit
  // elle mange le BAS — et il faut traiter les deux, sinon la moitie de l'arbre
  // se retrouve cachee derriere le panneau sur telephone.
  let occupeLargeur = 0;
  let occupeHauteur = 0;

  if (large()) {
    occupeLargeur = ouverte ? fiche.getBoundingClientRect().width + 32 : 0;
  } else {
    const boite = fiche.hidden ? null : fiche.getBoundingClientRect();
    occupeHauteur = boite ? Math.max(0, r.bottom - boite.top) : 0;
    // La place reellement prise est publiee pour que les commandes de cadrage
    // et la legende se posent juste au-dessus, quelle que soit la hauteur.
    $("canevas").style.setProperty("--place-fiche", `${Math.round(occupeHauteur)}px`);
  }

  const l = Math.max(280, r.width - occupeLargeur);
  const h = Math.max(280, r.height - occupeHauteur);
  const marge = large() ? 130 : 58;

  return {
    cx: l / 2,
    cy: h / 2,
    // Le rayon de l'anneau laisse la place aux libelles ET aux grappes
    // d'heritiers, qui debordent au-dela de leur branche.
    rayon: Math.max(110, Math.min(l, h) / 2 - marge),
  };
}

function position(noeud, c) {
  const rad = ((noeud.angle - 90) * Math.PI) / 180;   // 0 = midi
  return {
    x: c.cx + c.rayon * noeud.rayon * Math.cos(rad),
    y: c.cy + c.rayon * noeud.rayon * Math.sin(rad),
  };
}

// positionHeritier place un heritier par rapport a SA branche, pas par rapport
// au centre. C'est ce qui rend le rattachement sans ambiguite (F-10) : la
// grappe suit sa branche ou qu'elle soit.
function positionHeritier(heritier, posBranche, c) {
  const rad = ((heritier.angle - 90) * Math.PI) / 180;
  return {
    x: posBranche.x + c.rayon * heritier.rayon * Math.cos(rad),
    y: posBranche.y + c.rayon * heritier.rayon * Math.sin(rad),
  };
}

// Les rayons de pastille sont des FRACTIONS du rayon de l'anneau, pas des
// tailles en points.
//
// En valeur absolue, neuf pastilles de 34 points de rayon posees sur un anneau
// de 121 points — ce que donne un telephone — se chevauchent completement :
// l'arbre devient une grappe illisible au centre de l'ecran, alors que la meme
// geometrie respire sur un grand ecran. Les bornes evitent les deux exces
// inverses : une pastille minuscule sur un tres petit canevas, une pastille
// demesuree sur un tres grand.
function rayons(c) {
  const borne = (v, mini, maxi) => Math.max(mini, Math.min(maxi, v));
  return {
    centre: borne(c.rayon * 0.30, 30, 62),
    branche: borne(c.rayon * 0.17, 16, 36),
    heritier: borne(c.rayon * 0.075, 8, 18),
  };
}

// ═══ Rendu de la scène ═════════════════════════════════════════════════

const SVG = "http://www.w3.org/2000/svg";
const el = (nom, attrs = {}) => {
  const n = document.createElementNS(SVG, nom);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
};

// Les cernes — l'element de signature. Anneaux concentriques poses au sol, sur
// lesquels les branches se placent selon leur affinite.
function dessineCernes(c) {
  const g = $("cernes");
  g.textContent = "";

  // Les rayons correspondent aux bornes de rayonPour() cote serveur : 0.55
  // pour l'affinite maximale, 1.00 pour la minimale. Les anneaux ne sont donc
  // pas decoratifs — ils reperent les distances que les branches occupent
  // reellement.
  for (const [fraction, jalon] of [[0.55, true], [0.7, false], [0.85, false], [1.0, true]]) {
    g.appendChild(el("circle", {
      class: jalon ? "cerne cerne--jalon" : "cerne",
      cx: c.cx, cy: c.cy, r: c.rayon * fraction,
    }));
  }

  // Les etiquettes des cernes ne sont PAS posees dans le graphe.
  // Un libelle place sur un anneau tombe tot ou tard derriere un noeud, et la
  // §11 est categorique : "un nom n'est jamais masque par une pastille
  // voisine, a aucun niveau de zoom". La legende vit donc dans un coin du
  // canevas, hors de la scene — voir .cernes-legende.
}

function lien(a, b, classe) {
  return el("line", { class: classe, x1: a.x, y1: a.y, x2: b.x, y2: b.y });
}

// motifImage cree le remplissage circulaire d'une pastille.
//
// Un <pattern> plutot qu'un <image> avec clip-path : le motif suit la
// transformation de la camera, donc l'illustration grossit AVEC la pastille
// quand on zoome. C'est la premiere exigence de la §11 — "un zoom qui
// agrandirait les pastilles sans agrandir leur contenu manque son objectif".
function motifImage(id, url, taille) {
  const p = el("pattern", {
    id, patternUnits: "objectBoundingBox", width: 1, height: 1,
  });
  p.appendChild(el("image", {
    href: url, x: 0, y: 0, width: taille, height: taille,
    preserveAspectRatio: "xMidYMid slice",
  }));
  return p;
}

function dessineNoeud(artiste, pos, rayon, genre) {
  const g = el("g", {
    class: `noeud noeud--${genre}`,
    transform: `translate(${pos.x} ${pos.y})`,
    tabindex: genre === "centre" ? -1 : 0,
    role: "button",
    "data-id": artiste.id,
  });

  // "Chaque noeud porte le nom complet de l'artiste comme intitule accessible
  // — jamais une initiale, un identifiant ou une position." (§12)
  g.setAttribute("aria-label",
    genre === "centre" ? `${artiste.nom}, centre de l'arbre`
    : genre === "heritier" ? `${artiste.nom}, héritier. Activer pour le mettre au centre.`
    : `${artiste.nom}, branche. Activer pour la mettre au centre.`);

  const titre = el("title");
  titre.textContent = artiste.nom;
  g.appendChild(titre);

  g.appendChild(el("circle", { class: "noeud__halo", r: rayon + 6 }));

  const image = urlImage(artiste.image);
  let remplissage = teinteRepli(artiste.nom);
  if (image) {
    const idMotif = `img-${artiste.id.replace(/[^\w-]/g, "")}-${genre}`;
    const defs = $("defs");
    if (!document.getElementById(idMotif)) {
      defs.appendChild(motifImage(idMotif, image, rayon * 2));
    }
    remplissage = `url(#${idMotif})`;
  }
  g.appendChild(el("circle", { class: "noeud__pastille", r: rayon, fill: remplissage }));

  // Le repli : les initiales, quand il n'y a pas d'illustration. Il occupe
  // exactement la place de l'image, donc son arrivee ne decale rien.
  if (!image) {
    const t = el("text", {
      class: "noeud__nom", y: rayon * 0.18, "font-size": rayon * 0.7,
      "font-family": "Bodoni Moda, Didot, serif", "font-weight": 700,
      opacity: .42, "stroke-width": 0,
    });
    t.textContent = initiales(artiste.nom);
    g.appendChild(t);
  }

  const nom = el("text", { class: "noeud__nom", y: rayon + 17 });
  nom.textContent = artiste.nom;
  g.appendChild(nom);

  if (artiste.nouveaute) {
    g.appendChild(el("circle", { class: "noeud__pousse", cx: rayon * 0.7, cy: -rayon * 0.7, r: 5 }));
  }
  return g;
}

// rend redessine la scene a partir de l'etat.
function rend({ anime = false } = {}) {
  const c = cadre();
  const r = rayons(c);
  dessineCernes(c);

  // La taille des libelles suit celle des pastilles : sur un canevas etroit,
  // un libelle de 13 points est plus large que le noeud qu'il nomme.
  $("scene").style.setProperty("--taille-libelle", `${Math.round(r.branche * 0.42)}px`);

  const gLiens = $("liens");
  const gNoeuds = $("noeuds");
  gLiens.textContent = "";
  gNoeuds.textContent = "";
  $("defs").textContent = "";

  const posCentre = { x: c.cx, y: c.cy };

  // Les liens sont dessines AVANT les noeuds et partent du centre exact de
  // chaque pastille. Les pastilles etant opaques, la jonction est structurelle :
  // aucun trait ne peut s'arreter avant sa cible (§11).
  for (const b of etat.branches) {
    const pos = position(b, c);
    gLiens.appendChild(lien(posCentre, pos, "lien"));
    for (const h of b.heritiers || []) {
      gLiens.appendChild(lien(pos, positionHeritier(h, pos, c), "lien lien--heritier"));
    }
  }

  for (const b of etat.branches) {
    const pos = position(b, c);
    for (const h of b.heritiers || []) {
      const n = dessineNoeud(h, positionHeritier(h, pos, c), r.heritier, "heritier");
      if (anime) n.classList.add("noeud--parait");
      gNoeuds.appendChild(n);
    }
  }
  for (const b of etat.branches) {
    const n = dessineNoeud(b, position(b, c), r.branche * b.taille, "branche");
    if (anime) n.classList.add("noeud--parait");
    gNoeuds.appendChild(n);
  }

  if (etat.centre) {
    gNoeuds.appendChild(dessineNoeud(etat.centre, posCentre, r.centre, "centre"));
  }
}

// ═══ La promotion — le geste fondamental ═══════════════════════════════
// §11 : "Le noeud choisi reste visible en continu pendant qu'il rejoint le
// centre : c'est le fil que l'oeil suit. La generation precedente s'efface SUR
// PLACE — elle ne se deplace pas, sous peine de brouiller la lecture."

async function promeut(id, nom) {
  if (!id) return;
  const c = cadre();

  const promu = $("noeuds").querySelector(`.noeud[data-id="${CSS.escape(id)}"]`);
  const reduit = mouvementReduit();

  if (promu && !reduit) {
    for (const n of $("noeuds").querySelectorAll(".noeud")) {
      if (n === promu) continue;
      n.classList.add("noeud--efface");
    }
    // Le noeud promu voyage vers le centre en grossissant. Il ne quitte jamais
    // la scene : c'est le meme element du debut a la fin.
    const r = rayons(c);
    const facteur = r.centre / (promu.classList.contains("noeud--heritier") ? r.heritier : r.branche);
    promu.style.transformOrigin = "";
    promu.setAttribute("transform", `translate(${c.cx} ${c.cy}) scale(${facteur.toFixed(3)})`);
    promu.style.zIndex = "5";
    $("noeuds").appendChild(promu);   // au-dessus de ce qui s'efface
  }

  // "La vue ne se recadre que si l'utilisateur l'avait modifiee : une camera
  // qui bouge sans raison donne le vertige." (§11)
  if (camera.bouge) recadre(true);

  annonce(`Chargement de ${nom}.`);
  mesure("promotion");
  etat.visites.has(id) ? mesure("centre-revu") : mesure("centre-nouveau");
  etat.visites.add(id);

  // L'attente d'animation et le chargement partent ENSEMBLE. Attendre l'un
  // puis l'autre doublerait le delai percu pour aucun gain.
  const attente = reduit ? Promise.resolve() : new Promise((r) => setTimeout(r, 460));
  const [arbre] = await Promise.all([chargeArbre({ id }), attente]);
  if (arbre) montreArbre(arbre, { anime: true, empile: true });
}

// ═══ Chargement d'un arbre ═════════════════════════════════════════════

async function chargeArbre({ id, graine, tirage }) {
  const generation = ++etat.generation;
  const debut = performance.now();

  const params = new URLSearchParams();
  if (id) params.set("id", id);
  if (graine) params.set("graine", graine);
  params.set("tirage", String(tirage ?? etat.tirage));
  // La densite de noeuds n'est pas la meme dans les deux dispositions (§14) :
  // le client demande ce qu'il peut afficher lisiblement, le serveur borne.
  params.set("branches", large() ? "9" : "6");

  try {
    const rep = await appelle(`api/arbre?${params}`);

    // La reponse d'un chargement abandonne ne s'applique jamais au centre
    // courant (§09, F-13).
    if (generation !== etat.generation) {
      note("perime", "reponse d'arbre ignoree", { generation });
      return null;
    }

    mesure(null, performance.now() - debut);
    return rep.donnees;
  } catch (e) {
    if (generation !== etat.generation) return null;

    if (e instanceof Vide) {
      mesure("vide-affiche");
      montreEtat("vide", "L'arbre s'arrête ici", e.message);
    } else if (e instanceof Panne) {
      mesure("erreur-affichee");
      montreEtat("panne", "Chargement impossible", e.message, {
        reessayer: e.reessayable ? () => chargeEtMontre({ id, graine }) : null,
      });
    }
    return null;
  }
}

async function chargeEtMontre(cible) {
  montreEtat("attente", "", "");
  const arbre = await chargeArbre(cible);
  if (arbre) montreArbre(arbre, { anime: true, empile: true });
}

function montreArbre(arbre, { anime = false, empile = false } = {}) {
  const precedent = etat.centre;

  etat.centre = arbre.centre;
  etat.branches = arbre.branches || [];

  if (empile && precedent && precedent.id !== arbre.centre.id) {
    etat.lignee.push(precedent);
  }
  if (!etat.lignee.length) etat.lignee = [];

  cacheEtat();
  // La plantation a abouti : le champ peut etre vide sans rien faire perdre.
  const champRecherche = $("graine");
  if (champRecherche.value) { champRecherche.value = ""; $("effacer").hidden = true; }
  basculeVers("exploration");
  rend({ anime });
  rendLignee();
  chargeFiche(arbre.centre.id);
  chargeHeritiers();

  // F-03 : la correction orthographique est SIGNALEE, jamais silencieuse.
  if (arbre.corrige && arbre.nomSaisi) {
    bandeau(`Planté sous « ${arbre.centre.nom} » — « ${arbre.nomSaisi} » n'existe pas tel quel.`, { duree: 7000 });
  }

  // §12 : "le changement de centre est annonce aux technologies d'assistance :
  // c'est la seule facon de savoir que l'ecran a change sans le voir".
  annonce(`${arbre.centre.nom} est au centre. ${etat.branches.length} branches autour.`);
  document.title = `${arbre.centre.nom} — RAMURE`;

  // F-04 : l'URL suit le centre pour que le partage fonctionne, mais par
  // remplacement — sans quoi chaque promotion empilerait une entree
  // d'historique et le bouton "precedent" du navigateur deviendrait
  // imprevisible.
  const url = new URL(location);
  url.searchParams.set("graine", arbre.centre.nom);
  history.replaceState(null, "", url);
}

// ═══ Héritiers — chargés après l'arbre (F-39) ══════════════════════════

async function chargeHeritiers() {
  const generation = etat.generation;
  const ids = etat.branches.map((b) => b.id).filter(Boolean);
  if (!ids.length) return;

  try {
    const rep = await appelle(
      `api/heritiers?centre=${encodeURIComponent(etat.centre?.id ?? "")}` +
      `&ids=${encodeURIComponent(ids.join(","))}`);
    if (generation !== etat.generation) return;

    // La geometrie des heritiers depend de l'angle de leur branche : la meme
    // formule que DisposeHeritiers en Go, portee ici parce que seul le client
    // connait l'angle au moment ou la grappe arrive.
    for (const b of etat.branches) {
      const bruts = rep.donnees[b.id] || [];
      // Le meme plafond que heritiersParBranche cote Go : trois eventails de
      // trois libelles se recouvrent au cadrage neutre.
      const n = Math.min(bruts.length, 2);
      b.heritiers = bruts.slice(0, n).map((h, i) => ({
        ...h.Artiste ?? h,
        id: (h.Artiste ?? h).id,
        nom: (h.Artiste ?? h).nom,
        image: (h.Artiste ?? h).image,
        affinite: h.Affinite ?? h.affinite ?? 0.5,
        angle: b.angle + (n > 1 ? -26 + (52 * i) / (n - 1) : 0),
        // Meme regle qu'en Go : la taille d'un heritier est RELATIVE a sa
        // branche, sinon un heritier tres affine devient plus gros qu'elle et
        // les generations s'inversent a l'oeil.
        tailleRelative: true,
        rayon: 0.34,
        taille: b.taille * (0.45 + 0.25 * (h.Affinite ?? h.affinite ?? 0.5)),
      }));
    }
    // Le redessin n'anime pas : les branches sont deja en place, seules les
    // grappes apparaissent. "Sans faire sauter la mise en page" (F-39).
    rend();
  } catch {
    // Une grappe manquante coute des heritiers, jamais l'ecran (N-06).
    note("heritiers", "indisponibles");
  }
}

// ═══ La lignée ═════════════════════════════════════════════════════════

function rendLignee() {
  const nav = $("lignee");
  nav.textContent = "";

  const chaine = [...etat.lignee, etat.centre].filter(Boolean);
  nav.hidden = chaine.length < 2;
  if (nav.hidden) return;

  chaine.forEach((a, i) => {
    if (i > 0) {
      const greffe = document.createElement("span");
      greffe.className = "lignee__greffe";
      greffe.setAttribute("aria-hidden", "true");
      nav.appendChild(greffe);
    }

    const b = document.createElement("button");
    b.type = "button";
    b.className = "lignee__noeud";
    b.textContent = a.nom;
    const courant = i === chaine.length - 1;

    if (courant) {
      b.setAttribute("aria-current", "true");
      b.disabled = true;
    } else {
      // Les intitules accessibles ne doivent jamais faire doublon (§12) : le
      // rang dans la lignee distingue deux ancetres homonymes, et distingue
      // aussi ces boutons du bouton "Revenir a l'accueil".
      b.setAttribute("aria-label", `Revenir à ${a.nom}, ancêtre ${i + 1} sur ${chaine.length}`);
      b.onclick = () => sauteVers(i);
    }
    nav.appendChild(b);
  });

  nav.scrollLeft = nav.scrollWidth;
}

// sauteVers remonte la lignee. F-13 : "naviguer dans la lignee pendant une
// transition en cours mene a la destination demandee" — la generation est
// incrementee par chargeArbre, donc la transition en cours est abandonnee.
async function sauteVers(index) {
  const cible = etat.lignee[index];
  if (!cible) return;

  etat.lignee = etat.lignee.slice(0, index);
  mesure("lignee-remontee");

  const arbre = await chargeArbre({ id: cible.id });
  if (arbre) montreArbre(arbre, { anime: true, empile: false });
}

// ═══ La fiche ══════════════════════════════════════════════════════════

async function chargeFiche(id) {
  const generation = etat.generation;

  // F-24 : "le lecteur est reinitialise a chaque changement de centre".
  arreteLecteur();
  etat.filtreDisco = null;

  const panneau = $("fiche");
  const premiereOuverture = panneau.hidden;
  panneau.hidden = false;
  $("fiche-nom").textContent = etat.centre?.nom ?? "";
  $("fiche-poignee-nom").textContent = etat.centre?.nom ?? "";

  // Repliee par defaut sur ecran etroit, depliee sur ecran large : la §07 donne
  // deux dispositions differentes, pas la meme a deux tailles.
  if (premiereOuverture) basculeFiche(!large());
  $("disco-liste").textContent = "";
  $("filtres").hidden = true;

  try {
    const rep = await appelle(`api/fiche?id=${encodeURIComponent(id)}`);
    if (generation !== etat.generation) return;
    etat.fiche = rep.donnees;
    rendFiche();
  } catch (e) {
    if (generation !== etat.generation) return;
    // La fiche indisponible n'emporte pas le canevas : l'arbre reste
    // navigable, seule la fiche affiche son etat (N-06).
    $("disco-etat").hidden = false;
    $("disco-etat").dataset.genre = e instanceof Vide ? "vide" : "panne";
    $("disco-etat").textContent = e.message;
  }
}

function rendFiche() {
  const f = etat.fiche;
  if (!f) return;
  const c = f.centre;

  $("fiche-nom").textContent = c.nom;

  fond($("fiche-portrait"), c.image, c.nom, { initialesSiVide: true });

  $("fiche-audience").textContent = c.audience
    ? `${c.audience.toLocaleString("fr-FR")} auditeurs`
    : "";

  const genres = $("fiche-genres");
  genres.textContent = "";
  for (const g of c.genres || []) {
    const li = document.createElement("li");
    li.className = "genre";
    li.textContent = g;
    genres.appendChild(li);
  }

  $("fiche-bio").textContent = c.bio || "";
  $("fiche-bio").hidden = !c.bio;

  const lien = $("lien-ecoute");
  lien.href = f.lienArtiste || "#";
  $("lien-ecoute-texte").textContent = `Ouvrir dans ${nomService(f.serviceEcoute)}`;
  lien.setAttribute("aria-label", `Ouvrir ${c.nom} dans ${nomService(f.serviceEcoute)}, nouvel onglet`);
  lien.onclick = () => mesure("ecoute-ouverte");

  majBoutonGarder();
  majLecteur();
  rendFiltres();
  rendDisco();
}

function nomService(cle) {
  return (etat.services || []).find((s) => s.cle === cle)?.nom ?? "Deezer";
}

// F-22 : "le filtre est masque s'il n'y a rien a filtrer".
function rendFiltres() {
  const boite = $("filtres");
  boite.textContent = "";

  const presents = [...new Set((etat.fiche?.albums || []).map((a) => a.type))];
  if (presents.length < 2) {
    boite.hidden = true;
    return;
  }
  boite.hidden = false;

  const libelles = { studio: "Studio", live: "Live", compilation: "Compilation", court: "Format court" };
  for (const type of ["studio", "live", "compilation", "court"]) {
    if (!presents.includes(type)) continue;
    const b = document.createElement("button");
    b.type = "button";
    b.className = "filtre";
    b.textContent = libelles[type];
    b.setAttribute("aria-pressed", String(etat.filtreDisco === type));
    b.onclick = () => {
      etat.filtreDisco = etat.filtreDisco === type ? null : type;
      rendFiltres();
      rendDisco();
    };
    boite.appendChild(b);
  }
}

function rendDisco() {
  const liste = $("disco-liste");
  const etatBloc = $("disco-etat");
  liste.textContent = "";

  const f = etat.fiche;
  if (!f) return;

  if (f.discoEtat !== "ok") {
    etatBloc.hidden = false;
    etatBloc.dataset.genre = f.discoEtat;
    etatBloc.textContent = f.discoEtat === "vide"
      ? "Aucune sortie connue pour cet artiste."
      : "La discographie n'a pas pu être chargée.";
    return;
  }
  etatBloc.hidden = true;

  const albums = etat.filtreDisco
    ? f.albums.filter((a) => a.type === etat.filtreDisco)
    : f.albums;

  if (!albums.length) {
    etatBloc.hidden = false;
    etatBloc.dataset.genre = "vide";
    etatBloc.textContent = "Aucune sortie de ce type.";
    return;
  }

  const annee = new Date().getFullYear();
  for (const a of albums) {
    liste.appendChild(ligneAlbum(a, annee));
  }
}

function ligneAlbum(a, anneeCourante) {
  const li = document.createElement("li");
  const lien = document.createElement("a");
  lien.className = "album";
  lien.href = a.lien || "#";
  lien.target = "_blank";
  lien.rel = "noopener noreferrer";
  lien.onclick = () => mesure("ecoute-ouverte");

  const pochette = document.createElement("span");
  pochette.className = "album__pochette";
  fond(pochette, a.pochette, a.titre);
  lien.appendChild(pochette);

  const texte = document.createElement("span");
  texte.className = "album__texte";

  const titre = document.createElement("span");
  titre.className = "album__titre";
  titre.textContent = a.titre;
  texte.appendChild(titre);

  const meta = document.createElement("span");
  meta.className = "album__meta";

  if (a.annee) {
    const an = document.createElement("span");
    an.textContent = a.annee;
    meta.appendChild(an);
  }

  const type = document.createElement("span");
  type.className = "album__type";
  type.textContent = { studio: "Studio", live: "Live", compilation: "Compil.", court: "Court" }[a.type] ?? a.type;
  meta.appendChild(type);

  // La jauge n'existe QUE si l'album est evalue : l'absence de mesure se
  // distingue ainsi d'une mauvaise note (F-21).
  if (a.note) {
    const jauge = document.createElement("span");
    jauge.className = "album__jauge";
    jauge.setAttribute("role", "img");
    jauge.setAttribute("aria-label", `Appréciation ${Math.round(a.note * 100)} sur 100`);
    const barre = document.createElement("span");
    barre.style.width = `${Math.round(a.note * 100)}%`;
    jauge.appendChild(barre);
    meta.appendChild(jauge);
  }

  // F-23 : signal de nouveaute. Forme et couleur, jamais la couleur seule.
  if (a.annee && a.annee >= anneeCourante - 1) {
    const neuf = document.createElement("span");
    neuf.className = "album__neuf";
    neuf.textContent = "Récent";
    meta.appendChild(neuf);
  }

  texte.appendChild(meta);
  lien.appendChild(texte);
  li.appendChild(lien);
  return li;
}

// ═══ Le lecteur d'extraits (F-24, F-40) ════════════════════════════════

let pisteCourante = 0;

function majLecteur() {
  const bouton = $("lecteur-bascule");
  const extraits = etat.fiche?.extraits || [];

  // F-40 : "aucun extrait disponible → commande de lecture DESACTIVEE ET
  // EXPLICITE, jamais un bouton inerte". Le titre porte la raison, pas
  // seulement l'etat.
  if (!extraits.length) {
    bouton.disabled = true;
    $("lecteur-texte").textContent = "Aucun extrait";
    bouton.title = etat.fiche?.extraitsEtat === "panne"
      ? "Les extraits n'ont pas pu être chargés."
      : "Aucun extrait n'est disponible pour cet artiste.";
    return;
  }
  bouton.disabled = false;
  bouton.title = "";
  $("lecteur-texte").textContent = "Écouter un extrait";
}

function arreteLecteur() {
  const audio = $("lecteur");
  audio.pause();
  audio.removeAttribute("src");
  pisteCourante = 0;
  $("lecteur-piste").hidden = true;
  $("lecteur-texte").textContent = "Écouter un extrait";
  $("lecteur-icone").innerHTML = '<path d="M6 4l10 6-10 6z"/>';
  if ("mediaSession" in navigator) navigator.mediaSession.metadata = null;
}

function joue(index) {
  const extraits = etat.fiche?.extraits || [];
  if (!extraits.length) return;

  pisteCourante = ((index % extraits.length) + extraits.length) % extraits.length;
  const piste = extraits[pisteCourante];
  const audio = $("lecteur");

  audio.src = piste.url;
  audio.play().catch(() => {
    bandeau("La lecture n'a pas pu démarrer.", { duree: 4000, genre: "alerte" });
  });

  $("lecteur-piste").hidden = false;
  $("lecteur-piste").textContent = `${piste.titre} — extrait ${pisteCourante + 1} sur ${extraits.length}`;
  $("lecteur-texte").textContent = "Pause";
  $("lecteur-icone").innerHTML = '<path d="M7 4v12M13 4v12"/>';

  // F-24 : "controles disponibles depuis l'exterieur de l'application quand la
  // plateforme le permet" — ecran de verrouillage, casque, touches media.
  if ("mediaSession" in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: piste.titre,
      artist: etat.centre?.nom ?? "",
      artwork: piste.pochette ? [{ src: piste.pochette, sizes: "250x250" }] : [],
    });
    navigator.mediaSession.setActionHandler("nexttrack", () => joue(pisteCourante + 1));
    navigator.mediaSession.setActionHandler("previoustrack", () => joue(pisteCourante - 1));
    navigator.mediaSession.setActionHandler("pause", () => $("lecteur").pause());
    navigator.mediaSession.setActionHandler("play", () => $("lecteur").play());
  }
}

// ═══ La collection ═════════════════════════════════════════════════════
// F-33 : "sans compte ou sans reseau, la collection reste utilisable
// localement et se reconcilie a la reconnexion, sans perte ni doublon".

const CLE_LOCALE = "ramure.collection";

function litLocale() {
  try { return JSON.parse(localStorage.getItem(CLE_LOCALE) || "[]"); }
  catch { return []; }
}
function ecritLocale(gardes) {
  try { localStorage.setItem(CLE_LOCALE, JSON.stringify(gardes)); } catch {}
}

async function chargeCollection() {
  const locales = litLocale();
  try {
    const rep = await appelle("api/collection");
    if (rep.etat === "local") {
      // Aucune identite etablie par le serveur : la collection reste locale.
      etat.compte = false;
      etat.collection = locales;
    } else {
      etat.compte = true;
      // La reconciliation est une union, jamais un remplacement : le serveur
      // peut porter des gardes venus d'un autre appareil (F-32) que ce
      // navigateur n'a jamais vus.
      const fusion = locales.length
        ? await appelle("api/collection/reconcilie", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(locales),
          })
        : rep;
      etat.collection = fusion.donnees || [];
    }
  } catch {
    etat.compte = false;
    etat.collection = locales;
  }
  ecritLocale(etat.collection);
  majBoutonGarder();
}

function estGarde(id) {
  return etat.collection.some((g) => g.id === id);
}

function majBoutonGarder() {
  const b = $("garder");
  const garde = etat.centre && estGarde(etat.centre.id);
  b.dataset.garde = garde ? "oui" : "non";
  // L'intitule change, pas seulement la couleur (§12).
  $("garder-texte").textContent = garde ? "Gardé" : "Garder";
  b.setAttribute("aria-label", garde
    ? `Retirer ${etat.centre?.nom ?? ""} de la collection`
    : `Garder ${etat.centre?.nom ?? ""} dans la collection`);
}

async function basculeGarde() {
  if (!etat.centre) return;
  const centre = etat.centre;

  if (estGarde(centre.id)) {
    etat.collection = etat.collection.filter((g) => g.id !== centre.id);
    ecritLocale(etat.collection);
    majBoutonGarder();
    annonce(`${centre.nom} retiré de la collection.`);
    if (etat.compte) {
      appelle(`api/collection?id=${encodeURIComponent(centre.id)}`, { method: "DELETE" })
        .then((r) => { etat.collection = r.donnees || etat.collection; ecritLocale(etat.collection); })
        .catch(() => {});
    }
    return;
  }

  // F-29 : "chaque artiste garde memorise la lignee complete qui y a mene,
  // ainsi que la date".
  const garde = {
    id: centre.id,
    nom: centre.nom,
    image: centre.image,
    lienSource: centre.lienSource,
    lignee: etat.lignee.map((a) => a.nom),
    ajouteLe: new Date().toISOString(),
  };

  // L'ajout est optimiste : "l'artiste apparait et disparait immediatement de
  // la collection" (F-28). Le reseau suit.
  etat.collection = [garde, ...etat.collection];
  ecritLocale(etat.collection);
  majBoutonGarder();
  annonce(`${centre.nom} gardé dans la collection.`);
  mesure("artiste-garde");

  if (etat.compte) {
    appelle("api/collection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(garde),
    })
      .then((r) => { etat.collection = r.donnees || etat.collection; ecritLocale(etat.collection); })
      .catch(() => {});
  }
}

function rendCollection() {
  const corps = $("collection-corps");
  corps.textContent = "";

  if (!etat.collection.length) {
    const vide = document.createElement("p");
    vide.className = "panneau__vide";
    // "Un ecran vide est une invitation a agir."
    vide.textContent = "Rien de gardé pour l'instant. Ouvre la fiche d'un artiste et appuie sur « Garder » pour le retrouver ici.";
    corps.appendChild(vide);
    return;
  }

  if (!etat.compte) {
    const note = document.createElement("p");
    note.className = "panneau__vide";
    note.textContent = "Cette collection est enregistrée sur cet appareil uniquement.";
    corps.appendChild(note);
  }

  for (const g of etat.collection) {
    corps.appendChild(ligneGarde(g));
  }
}

function ligneGarde(g) {
  const ligne = document.createElement("article");
  ligne.className = "garde";

  const vignette = document.createElement("span");
  vignette.className = "garde__vignette";
  fond(vignette, g.image, g.nom, { initialesSiVide: true });
  ligne.appendChild(vignette);

  const texte = document.createElement("div");
  texte.className = "garde__texte";

  const nom = document.createElement("p");
  nom.className = "garde__nom";
  nom.textContent = g.nom;
  texte.appendChild(nom);

  // F-30 : le chemin parcouru, pas seulement le nom.
  if (g.lignee?.length) {
    const chemin = document.createElement("p");
    chemin.className = "garde__chemin";
    for (const a of g.lignee) {
      const s = document.createElement("span");
      s.textContent = a;
      chemin.appendChild(s);
    }
    texte.appendChild(chemin);
  }

  if (g.ajouteLe) {
    const date = document.createElement("p");
    date.className = "garde__date";
    date.textContent = new Date(g.ajouteLe).toLocaleDateString("fr-FR", {
      day: "numeric", month: "long", year: "numeric",
    });
    texte.appendChild(date);
  }
  ligne.appendChild(texte);

  const actions = document.createElement("div");
  actions.className = "garde__actions";

  // F-31 : "un clic ferme la collection et recentre l'arbre sur l'artiste".
  const replanter = document.createElement("button");
  replanter.type = "button";
  replanter.className = "bouton";
  replanter.textContent = "Replanter";
  replanter.setAttribute("aria-label", `Replanter l'arbre sur ${g.nom}`);
  replanter.onclick = () => {
    $("panneau-collection").close();
    mesure("depuis-garde");
    chargeEtMontre({ id: g.id });
  };
  actions.appendChild(replanter);

  const retirer = document.createElement("button");
  retirer.type = "button";
  retirer.className = "bouton";
  retirer.textContent = "Retirer";
  retirer.setAttribute("aria-label", `Retirer ${g.nom} de la collection`);
  retirer.onclick = async () => {
    etat.collection = etat.collection.filter((x) => x.id !== g.id);
    ecritLocale(etat.collection);
    rendCollection();
    majBoutonGarder();
    if (etat.compte) {
      appelle(`api/collection?id=${encodeURIComponent(g.id)}`, { method: "DELETE" }).catch(() => {});
    }
  };
  actions.appendChild(retirer);

  ligne.appendChild(actions);
  return ligne;
}

// ═══ Le palmarès (F-27) ════════════════════════════════════════════════

async function ouvrePalmares() {
  const panneau = $("panneau-palmares");
  const corps = $("palmares-corps");
  panneau.showModal();

  corps.textContent = "";
  const attente = document.createElement("p");
  attente.className = "panneau__vide";
  attente.textContent = "Lecture des discographies de l'arbre…";
  corps.appendChild(attente);

  const ids = [etat.centre?.id, ...etat.branches.map((b) => b.id)].filter(Boolean);
  try {
    const rep = await appelle(`api/palmares?ids=${encodeURIComponent(ids.join(","))}`);
    etat.palmares = rep.donnees || [];
    rendPalmares();
  } catch (e) {
    corps.textContent = "";
    const p = document.createElement("p");
    p.className = "panneau__vide";
    p.textContent = e.message;
    corps.appendChild(p);
  }
}

function rendPalmares() {
  const corps = $("palmares-corps");
  const boiteFiltres = $("palmares-filtres");
  corps.textContent = "";
  boiteFiltres.textContent = "";

  const tous = etat.palmares || [];
  const presents = [...new Set(tous.map((a) => a.type))];

  // F-22 : le filtre "s'applique aussi au palmares".
  if (presents.length > 1) {
    const libelles = { studio: "Studio", live: "Live", compilation: "Compilation", court: "Format court" };
    for (const type of ["studio", "live", "compilation", "court"]) {
      if (!presents.includes(type)) continue;
      const b = document.createElement("button");
      b.type = "button";
      b.className = "filtre";
      b.textContent = libelles[type];
      b.setAttribute("aria-pressed", String(etat.filtrePalmares === type));
      b.onclick = () => {
        etat.filtrePalmares = etat.filtrePalmares === type ? null : type;
        rendPalmares();
      };
      boiteFiltres.appendChild(b);
    }
  }

  const albums = etat.filtrePalmares ? tous.filter((a) => a.type === etat.filtrePalmares) : tous;
  if (!albums.length) {
    const p = document.createElement("p");
    p.className = "panneau__vide";
    p.textContent = "Aucun album apprécié parmi les artistes affichés.";
    corps.appendChild(p);
    return;
  }

  const liste = document.createElement("ol");
  liste.className = "disco__liste";
  const anneeCourante = new Date().getFullYear();

  for (const a of albums) {
    const li = ligneAlbum(a, anneeCourante);
    // "Selectionner un resultat replante l'arbre sur son artiste" (F-27) :
    // une seconde action, distincte du lien d'ecoute.
    const replanter = document.createElement("button");
    replanter.type = "button";
    replanter.className = "bouton";
    replanter.textContent = a.artisteNom;
    replanter.setAttribute("aria-label", `Replanter l'arbre sur ${a.artisteNom}`);
    replanter.onclick = () => {
      $("panneau-palmares").close();
      chargeEtMontre({ id: a.artisteId });
    };
    li.querySelector(".album__meta")?.appendChild(replanter);
    liste.appendChild(li);
  }
  corps.appendChild(liste);
}

// ═══ Le mur d'accueil ══════════════════════════════════════════════════

async function chargeAccueil() {
  const mur = $("mur");
  const etatBloc = $("accueil-etat");
  etatBloc.hidden = true;

  try {
    const rep = await appelle("api/accueil");
    etat.murTuiles = rep.donnees.tuiles || [];
    rendMur();
  } catch (e) {
    etatBloc.hidden = false;
    etatBloc.textContent = e instanceof Vide
      ? "Rien à proposer pour l'instant. Tape un nom d'artiste pour commencer."
      : `${e.message} Tape un nom d'artiste pour commencer.`;
    mur.textContent = "";
  }
}

// Le nombre de colonnes s'adapte a la largeur, et le nombre de tuiles au
// nombre de cases visibles : "occupe toute la hauteur disponible sans
// defilement" (F-05). Une tuile hors champ couterait une image chargee pour
// rien.
//
// La subtilite est la DERNIERE RANGEE. Un nombre de colonnes choisi sur la
// seule largeur laisse presque toujours un reliquat — 28 artistes sur 8
// colonnes donnent trois rangees pleines et quatre trous beants en bas, ce que
// la F-05 interdit explicitement ("aucune tuile vide"). On essaie donc les
// largeurs de grille voisines de l'ideal et on retient celle qui laisse le
// moins de cases vides ; a egalite, la plus proche de l'ideal.
function grille(nombreTuiles) {
  const l = window.innerWidth;
  const h = window.innerHeight;
  const ideal = Math.max(2, Math.min(9, Math.round(l / 190)));

  if (!nombreTuiles) return { colonnes: ideal, cases: 0 };

  let meilleur = { colonnes: ideal, reste: Infinity, ecart: 0 };

  for (let colonnes = Math.max(2, ideal - 2); colonnes <= Math.min(10, ideal + 2); colonnes++) {
    const cote = l / colonnes;
    const lignes = Math.max(1, Math.ceil(h / cote));
    const cases = colonnes * lignes;

    // Au-dela du nombre d'artistes disponibles, on ne peut pas remplir : le
    // reliquat est ce qui manquerait pour completer la derniere rangee.
    const utilisees = Math.min(cases, nombreTuiles);
    const reste = colonnes * Math.ceil(utilisees / colonnes) - utilisees;
    const ecart = Math.abs(colonnes - ideal);

    if (reste < meilleur.reste || (reste === meilleur.reste && ecart < meilleur.ecart)) {
      meilleur = { colonnes, reste, ecart, cases: utilisees };
    }
  }

  return { colonnes: meilleur.colonnes, cases: meilleur.cases };
}

function murTrie(tuiles) {
  const copie = [...tuiles];
  switch (etat.reglage.triMur) {
    case "alpha":
      return copie.sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
    case "audience":
      return copie.sort((a, b) => (b.audience || 0) - (a.audience || 0));
    case "hasard":
      // Fisher-Yates. "Un ordre aleatoire relancable" (F-06) : le bouton
      // "Retirer au hasard" rejoue ce tri sans rien recharger.
      for (let i = copie.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copie[i], copie[j]] = [copie[j], copie[i]];
      }
      return copie;
    default:
      return copie;   // "recents" : l'ordre du serveur, deja le bon
  }
}

function rendMur() {
  const mur = $("mur");
  const { colonnes, cases } = grille(etat.murTuiles.length);
  mur.style.setProperty("--colonnes", colonnes);

  const tuiles = murTrie(etat.murTuiles).slice(0, cases);
  const reduit = mouvementReduit();

  // Le mur est reconstruit d'un bloc via un fragment : aucune etape
  // intermediaire n'est peinte, donc aucun decalage de mise en page (F-05).
  const fragment = document.createDocumentFragment();

  tuiles.forEach((a, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "tuile";
    b.setAttribute("aria-label", `Planter ${a.nom}`);
    if (!reduit) b.style.setProperty("--retard", `${Math.min(i * 22, 700)}ms`);

    const image = document.createElement("span");
    image.className = urlImage(a.image) ? "tuile__image" : "tuile__repli";
    fond(image, a.image, a.nom, {
      initialesSiVide: true,
      // La classe suit le resultat REEL du chargement, pas la validite de
      // l'adresse : sans cela une pochette injoignable laisse une tuile vide.
      surEchec: () => { image.className = "tuile__repli"; },
    });
    b.appendChild(image);

    const nom = document.createElement("span");
    nom.className = "tuile__nom";
    nom.textContent = a.nom;
    b.appendChild(nom);

    b.onclick = () => chargeEtMontre({ id: a.id });
    fragment.appendChild(b);
  });

  mur.textContent = "";
  mur.appendChild(fragment);

  $("rebattre-mur").hidden = etat.reglage.triMur !== "hasard";
}

// basculeFiche ouvre ou replie le panneau et recale le canevas.
//
// Sur ecran etroit, la fiche est repliee PAR DEFAUT. Ancree ouverte, elle prend
// les deux tiers de la hauteur et il ne reste du canevas qu'une bande ou l'on
// ne distingue plus rien — or le canevas est le produit. Repliee, elle laisse
// voir le nom du centre et s'ouvre d'un geste.
function basculeFiche(force) {
  const f = $("fiche");
  const replie = force !== undefined ? force : f.dataset.replie !== "oui";

  f.dataset.replie = replie ? "oui" : "non";
  $("fiche-bascule").setAttribute("aria-expanded", String(!replie));
  $("fiche-bascule").setAttribute("aria-label", replie ? "Déplier la fiche" : "Replier la fiche");

  // L'etat est publie sur <body> pour que la CSS degage les commandes de
  // cadrage du panneau sur grand ecran.
  document.body.dataset.fiche = replie ? "repliee" : "ouverte";
  $("fiche-replier")?.setAttribute("aria-expanded", String(!replie));
  $("fiche-replier")?.setAttribute("aria-label", replie ? "Déplier la fiche" : "Replier la fiche");

  // Le recalcul attend la FIN de la transition pour mesurer la hauteur reelle.
  // Un delai fixe de 40 ms mesurait le panneau en plein mouvement : la variable
  // --place-fiche valait 142 px pendant que la fiche en occupait 523, et le
  // noeud central se retrouvait cache derriere sa propre fiche.
  if (mouvementReduit()) { rend(); return; }

  const panneau = $("fiche");
  let fait = false;
  const fini = () => {
    if (fait) return;
    fait = true;
    panneau.removeEventListener("transitionend", surFin);
    rend();
  };
  const surFin = (e) => { if (e.target === panneau && e.propertyName === "transform") fini(); };
  panneau.addEventListener("transitionend", surFin);
  // Filet : transitionend ne part pas si la transition est annulee ou si la
  // propriete ne change pas.
  setTimeout(fini, 560);
}

// ═══ Bascule entre les deux états d'écran ══════════════════════════════

function basculeVers(nom) {
  const accueil = nom === "accueil";
  $("accueil").hidden = !accueil;
  $("exploration").hidden = accueil;
  document.body.dataset.etat = nom;

  // Le champ de recherche est UNIQUE : il est DEPLACE d'un hote a l'autre.
  // appendChild deplace le noeud, il ne le copie pas — c'est ce qui garantit
  // qu'il n'existe jamais deux champs, donc jamais deux intitules identiques
  // (§07 et §12).
  const hote = accueil ? $("hote-recherche-accueil") : $("hote-recherche-barre");
  hote.appendChild($("recherche"));
  $("recherche").querySelector("input").placeholder = accueil
    ? "Plante un nom…"
    : "Planter un autre artiste…";

  if (accueil) {
    $("fiche").hidden = true;
    document.title = "RAMURE — plante un nom, saute de branche en branche";
  }
}

// F-07 : "revenir a l'ecran d'accueil par la navigation principale reinitialise
// l'etat : la derniere graine ne reste pas collee."
function retourAccueil() {
  etat.generation++;          // toute reponse en vol devient perimee
  etat.centre = null;
  etat.branches = [];
  etat.lignee = [];
  etat.fiche = null;
  etat.tirage = 0;
  arreteLecteur();
  recadre(false);
  cacheEtat();

  const url = new URL(location);
  url.searchParams.delete("graine");
  history.replaceState(null, "", url);

  sessionStorage.removeItem(CLE_SESSION);
  basculeVers("accueil");
  rendMur();
  annonce("Retour à l'accueil.");
}

// ═══ Les états d'écran (F-36, F-38) ════════════════════════════════════

function montreEtat(genre, titre, texte, { reessayer } = {}) {
  const boite = $("etat-ecran");

  if (genre === "attente") {
    boite.hidden = false;
    boite.dataset.genre = "attente";
    $("etat-titre").innerHTML = '<span class="pousse-attente"></span>';
    $("etat-texte").textContent = "L'arbre pousse…";
    $("etat-reessayer").hidden = true;
    $("etat-retour").hidden = true;
    annonce("L'arbre pousse…");
    return;
  }

  boite.hidden = false;
  boite.dataset.genre = genre;
  $("etat-titre").textContent = titre;
  $("etat-texte").textContent = texte;

  // Sans ceci, la region role="alert" de la page n'etait JAMAIS alimentee :
  // alerte() existait sans aucun appelant, et aucune panne, aucun etat vide,
  // aucune session expiree n'etait annoncee. Un utilisateur au lecteur d'ecran
  // ne pouvait pas savoir que sa recherche avait echoue.
  alerte(`${titre}. ${texte}`);

  // LE point de la F-36 : seule une panne propose de reessayer. Sur un vide,
  // reessayer ne changerait rien et enfermerait l'utilisateur dans une boucle.
  const bReessayer = $("etat-reessayer");
  bReessayer.hidden = !reessayer;
  if (reessayer) bReessayer.onclick = () => { cacheEtat(); reessayer(); };

  // F-38 : "tout etat d'attente aboutit a un contenu, un message explicite ou
  // une action de sortie — jamais a une attente indefinie". Une sortie est
  // donc toujours offerte.
  const bRetour = $("etat-retour");
  bRetour.hidden = false;
  bRetour.onclick = retourAccueil;
}

function cacheEtat() {
  $("etat-ecran").hidden = true;
  $("alerte").textContent = "";
}

// ═══ La recherche ══════════════════════════════════════════════════════

function installeRecherche() {
  const champ = $("graine");
  const liste = $("suggestions");
  const effacer = $("effacer");

  let minuterie = null;
  let actif = -1;
  let propositions = [];

  const ferme = () => {
    liste.hidden = true;
    liste.textContent = "";
    champ.setAttribute("aria-expanded", "false");
    champ.removeAttribute("aria-activedescendant");
    actif = -1;
    propositions = [];
  };

  const marque = () => {
    [...liste.children].forEach((li, i) => {
      li.setAttribute("aria-selected", String(i === actif));
      if (i === actif) {
        champ.setAttribute("aria-activedescendant", li.id);
        li.scrollIntoView({ block: "nearest" });
      }
    });
  };

  const plante = (artiste) => {
    ferme();
    champ.value = "";
    effacer.hidden = true;
    champ.blur();
    mesure("plante");
    // Une plantation par identifiant plutot que par nom : l'artiste vient
    // d'une suggestion, donc il est deja resolu. Aucune seconde recherche
    // textuelle, donc aucun risque d'homonyme (§09).
    chargeEtMontre(artiste.id ? { id: artiste.id } : { graine: artiste.nom });
  };

  champ.addEventListener("input", () => {
    const q = champ.value.trim();
    effacer.hidden = !q;
    clearTimeout(minuterie);

    if (q.length < 2) { ferme(); return; }

    // Le delai evite une requete par frappe. 180 ms est sous le seuil ou la
    // liste parait en retard, et divise le nombre d'appels par cinq.
    minuterie = setTimeout(async () => {
      try {
        const rep = await appelle(`api/suggestions?q=${encodeURIComponent(q)}`);
        propositions = rep.donnees || [];

        liste.textContent = "";
        if (!propositions.length) { ferme(); return; }

        propositions.forEach((a, i) => {
          const li = document.createElement("li");
          li.className = "suggestion";
          li.id = `suggestion-${i}`;
          li.setAttribute("role", "option");
          li.setAttribute("aria-selected", "false");

          const vignette = document.createElement("span");
          vignette.className = "suggestion__vignette";
          fond(vignette, a.image, a.nom);
          li.appendChild(vignette);

          const nom = document.createElement("span");
          nom.className = "suggestion__nom";
          nom.textContent = a.nom;
          li.appendChild(nom);

          li.onclick = () => plante(a);
          liste.appendChild(li);
        });

        liste.hidden = false;
        champ.setAttribute("aria-expanded", "true");
        actif = -1;
      } catch {
        ferme();
      }
    }, 180);
  });

  // F-02 : "fleches pour parcourir, validation pour planter, effacement en une
  // action ; l'etat de la liste est expose aux technologies d'assistance".
  champ.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown" && propositions.length) {
      e.preventDefault();
      actif = (actif + 1) % propositions.length;
      marque();
    } else if (e.key === "ArrowUp" && propositions.length) {
      e.preventDefault();
      actif = (actif - 1 + propositions.length) % propositions.length;
      marque();
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (actif >= 0) plante(propositions[actif]);
      else if (champ.value.trim()) {
        // Sans suggestion choisie, on plante le texte saisi : c'est ce qui
        // declenche la correspondance stricte puis le rattrapage (F-03).
        //
        // Le champ n'est PAS vide ici. Il l'etait, et combine a un etat d'erreur
        // qui ne s'affichait pas, cela produisait le pire enchainement du
        // produit : le nom mal orthographie disparaissait, aucun message
        // n'apparaissait, et l'utilisateur n'avait plus rien a corriger. On ne
        // vide qu'une fois l'arbre reellement obtenu.
        const nom = champ.value.trim();
        ferme(); champ.blur();
        mesure("plante");
        chargeEtMontre({ graine: nom });
      }
    } else if (e.key === "Escape") {
      if (!liste.hidden) { e.preventDefault(); ferme(); }
    }
  });

  effacer.onclick = () => {
    champ.value = "";
    effacer.hidden = true;
    ferme();
    champ.focus();
  };

  document.addEventListener("click", (e) => {
    if (!$("recherche").contains(e.target)) ferme();
  });
}

// ═══ Aperçu au survol (F-19, écran large uniquement) ═══════════════════

function installeApercu() {
  let bulle = null;

  const cache = () => { bulle?.remove(); bulle = null; };

  $("scene").addEventListener("pointerover", (e) => {
    if (!large() || !window.matchMedia("(hover: hover)").matches) return;

    const noeud = e.target.closest(".noeud:not(.noeud--centre)");
    if (!noeud) { cache(); return; }

    const id = noeud.dataset.id;
    const artiste =
      etat.branches.find((b) => b.id === id) ||
      etat.branches.flatMap((b) => b.heritiers || []).find((h) => h.id === id);
    if (!artiste) return;

    cache();
    bulle = document.createElement("div");
    bulle.className = "apercu";
    // aria-hidden : l'apercu double une information deja portee par
    // l'aria-label du noeud. L'annoncer deux fois encombrerait la navigation
    // assistee sans rien apporter.
    bulle.setAttribute("aria-hidden", "true");

    const nom = document.createElement("span");
    nom.className = "apercu__nom";
    nom.textContent = artiste.nom;
    bulle.appendChild(nom);

    if (artiste.audience) {
      const meta = document.createElement("span");
      meta.className = "apercu__meta";
      meta.textContent = `${artiste.audience.toLocaleString("fr-FR")} auditeurs`;
      bulle.appendChild(meta);
    }

    const r = noeud.getBoundingClientRect();
    bulle.style.left = `${Math.min(r.right + 10, window.innerWidth - 290)}px`;
    bulle.style.top = `${r.top}px`;
    document.body.appendChild(bulle);
    // F-19 : l'apercu ne remplace JAMAIS le profil du centre. C'est une bulle
    // a cote du noeud, et la fiche n'est pas touchee.
  });

  $("scene").addEventListener("pointerout", (e) => {
    if (!e.relatedTarget?.closest?.(".noeud")) cache();
  });
  $("scene").addEventListener("pointerdown", cache);
}

// ═══ Reprise de la lignée (F-18) ═══════════════════════════════════════

const CLE_SESSION = "ramure.lignee";

function sauveLignee() {
  if (!etat.centre) return;
  try {
    sessionStorage.setItem(CLE_SESSION, JSON.stringify({
      centre: etat.centre,
      lignee: etat.lignee,
    }));
  } catch {}
}

function litLignee() {
  try { return JSON.parse(sessionStorage.getItem(CLE_SESSION) || "null"); }
  catch { return null; }
}

// ═══ Le service worker (N-11, N-12, F-42) ══════════════════════════════

function installeServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  navigator.serviceWorker.register("sw.js").then((inscription) => {
    // F-42 : "lorsqu'une nouvelle version est deployee, l'utilisateur en est
    // informe et peut l'appliquer sans vider son cache manuellement".
    inscription.addEventListener("updatefound", () => {
      const neuf = inscription.installing;
      if (!neuf) return;
      neuf.addEventListener("statechange", () => {
        if (neuf.state === "installed" && navigator.serviceWorker.controller) {
          bandeau("Une nouvelle version de RAMURE est prête.", {
            action: () => { neuf.postMessage({ action: "prends-la-main" }); },
            libelle: "Appliquer",
          });
        }
      });
    });

    // N-12 : la diffusion ne demande aucune action manuelle — on interroge
    // periodiquement plutot que d'attendre un rechargement complet.
    setInterval(() => inscription.update().catch(() => {}), 30 * 60 * 1000);
  }).catch(() => {});

  let recharge = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (recharge) return;
    recharge = true;
    location.reload();
  });
}

// ═══ Réglages et diagnostic ════════════════════════════════════════════

async function chargeReglages() {
  try {
    const rep = await appelle("api/reglages");
    etat.reglage = rep.donnees.reglage;
    etat.services = rep.donnees.services;
    etat.compte = rep.donnees.compte;

    const service = $("service");
    service.textContent = "";
    for (const s of etat.services) {
      const o = document.createElement("option");
      o.value = s.cle;
      o.textContent = s.nom;
      o.selected = s.cle === etat.reglage.serviceEcoute;
      service.appendChild(o);
    }

    const tri = $("tri");
    tri.textContent = "";
    for (const t of rep.donnees.tris) {
      const o = document.createElement("option");
      o.value = t.cle;
      o.textContent = t.nom;
      o.selected = t.cle === etat.reglage.triMur;
      tri.appendChild(o);
    }
  } catch {
    note("reglages", "indisponibles, valeurs par defaut conservees");
  }
}

async function ecritReglage(champ, valeur) {
  etat.reglage[champ] = valeur;
  try {
    await appelle("api/reglages", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [champ]: valeur }),
    });
  } catch {}
  // Repli local : la F-06 exige que le choix survive au rechargement, y
  // compris sans compte.
  try { localStorage.setItem("ramure.reglage", JSON.stringify(etat.reglage)); } catch {}
}

// N-10 : "l'utilisateur peut exporter un journal de sa session pour l'attacher
// a un signalement — indispensable aux anomalies mobiles non reproductibles".
async function exporteJournal() {
  let diagnostic = null;
  try { diagnostic = (await appelle("api/diagnostic")).donnees; } catch {}

  const contenu = JSON.stringify({
    version: diagnostic?.version,
    quand: new Date().toISOString(),
    session: idSession,
    navigateur: navigator.userAgent,
    fenetre: { l: window.innerWidth, h: window.innerHeight, disposition: large() ? "large" : "etroite" },
    mouvementReduit: mouvementReduit(),
    centre: etat.centre?.nom,
    lignee: etat.lignee.map((a) => a.nom),
    diagnostic,
    journal: etat.journal,
  }, null, 2);

  const url = URL.createObjectURL(new Blob([contenu], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `ramure-session-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// ═══ Partage (F-34) ════════════════════════════════════════════════════

async function partage() {
  if (!etat.centre) return;

  const url = new URL(location.origin + location.pathname);
  url.searchParams.set("graine", etat.centre.nom);
  const lien = url.toString();

  const donnees = {
    title: `${etat.centre.nom} sur RAMURE`,
    text: `L'arbre de parenté musicale de ${etat.centre.nom}.`,
    url: lien,
  };

  if (navigator.share) {
    try { await navigator.share(donnees); return; } catch { /* annule */ }
  }
  try {
    await navigator.clipboard.writeText(lien);
    bandeau("Lien copié.", { duree: 3000 });
  } catch {
    bandeau(lien, { duree: 12000 });
  }
}

// ═══ Amorçage ══════════════════════════════════════════════════════════

function installePanneaux() {
  for (const b of document.querySelectorAll("[data-fermer]")) {
    b.onclick = () => b.closest("dialog").close();
  }
  // Le clic sur le fond ferme le panneau — comportement attendu d'une modale,
  // que <dialog> ne fournit pas seul.
  for (const d of document.querySelectorAll("dialog")) {
    d.addEventListener("click", (e) => { if (e.target === d) d.close(); });
  }
}

function installeCommandes() {
  $("quitter").onclick = retourAccueil;

  // F-15 : "nouvel entourage a centre constant ; la vue revient a son cadrage
  // neutre".
  $("rebattre").onclick = async () => {
    if (!etat.centre) return;
    etat.tirage++;
    mesure("rebattu");
    recadre(true);
    const arbre = await chargeArbre({ id: etat.centre.id, tirage: etat.tirage });
    if (arbre) montreArbre(arbre, { anime: true, empile: false });
  };

  $("ouvrir-collection").onclick = () => { rendCollection(); $("panneau-collection").showModal(); };
  $("ouvrir-palmares").onclick = ouvrePalmares;
  $("ouvrir-reglages").onclick = async () => {
    const d = (await appelle("api/diagnostic").catch(() => null))?.donnees;
    $("diagnostic-resume").textContent = d
      ? `Version ${d.version}. Sources : ${Object.values(d.roles).join(" · ")}.`
      : "Diagnostic indisponible.";
    $("panneau-reglages").showModal();
  };

  $("garder").onclick = basculeGarde;
  $("partager").onclick = partage;

  $("lecteur-bascule").onclick = () => {
    const audio = $("lecteur");
    if (!audio.src) { joue(0); return; }
    if (audio.paused) {
      audio.play().catch(() => {});
      $("lecteur-texte").textContent = "Pause";
      $("lecteur-icone").innerHTML = '<path d="M7 4v12M13 4v12"/>';
    } else {
      audio.pause();
      $("lecteur-texte").textContent = "Reprendre";
      $("lecteur-icone").innerHTML = '<path d="M6 4l10 6-10 6z"/>';
    }
  };
  $("lecteur").addEventListener("ended", () => joue(pisteCourante + 1));

  $("fiche-bascule").onclick = () => basculeFiche();
  $("fiche-replier").onclick = () => basculeFiche();

  $("tri").onchange = (e) => {
    ecritReglage("triMur", e.target.value);
    // "Changer de tri ne recharge aucune illustration" (F-06) : on re-trie des
    // tuiles deja en memoire, sans nouvelle requete.
    rendMur();
  };
  $("rebattre-mur").onclick = rendMur;
  $("service").onchange = async (e) => {
    await ecritReglage("serviceEcoute", e.target.value);
    if (etat.centre) chargeFiche(etat.centre.id);
  };
  $("exporter-journal").onclick = exporteJournal;
  $("bandeau-flottant-fermer").onclick = fermeBandeau;

  // Le clic et le clavier produisent le meme resultat (F-11, §12).
  const active = (e) => {
    const noeud = e.target.closest(".noeud");
    if (!noeud || noeud.classList.contains("noeud--centre")) return;
    const id = noeud.dataset.id;
    const nom = noeud.querySelector("title")?.textContent ?? "";
    e.preventDefault();
    promeut(id, nom);
  };
  $("scene").addEventListener("click", active);
  $("scene").addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") active(e);
  });

  // Le redimensionnement recalcule la geometrie sans rejouer d'animation.
  let minuterieTaille = null;
  window.addEventListener("resize", () => {
    clearTimeout(minuterieTaille);
    minuterieTaille = setTimeout(() => {
      if (document.body.dataset.etat === "accueil") rendMur();
      else rend();
    }, 120);
  });

  window.addEventListener("beforeunload", sauveLignee);
  window.addEventListener("online", () => { chargeCollection(); });
}

async function demarre() {
  installeRecherche();
  installeCamera();
  installePanneaux();
  installeCommandes();
  installeApercu();
  installeServiceWorker();

  // Le reglage local est applique AVANT l'appel serveur : le mur s'affiche
  // dans le bon ordre des la premiere image, sans reordonnancement visible.
  try {
    const local = JSON.parse(localStorage.getItem("ramure.reglage") || "null");
    if (local) etat.reglage = { ...etat.reglage, ...local };
  } catch {}

  mesure("session");
  basculeVers("accueil");

  await Promise.all([chargeReglages(), chargeCollection()]);
  await chargeAccueil();

  // F-04 : "un lien partage ou une entree depuis la collection plante
  // l'artiste UNE SEULE FOIS, sans le replanter aux navigations suivantes".
  // La graine est donc consommee ici et effacee de l'URL par montreArbre, qui
  // la remplace par le centre courant.
  const graine = new URLSearchParams(location.search).get("graine");
  if (graine) {
    mesure("depuis-partage");
    await chargeEtMontre({ graine });
    return;
  }

  // F-18 : reprise de la lignee en cours plutot qu'un retour a l'accueil.
  const reprise = litLignee();
  if (reprise?.centre?.id) {
    etat.lignee = reprise.lignee || [];
    await chargeEtMontre({ id: reprise.centre.id });
  }
}

demarre();
