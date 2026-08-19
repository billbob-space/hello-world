"use strict";

// estran — appelle les deux endpoints internes et rend la page. Aucune
// logique de calcul de marée ou de meteo ici : le serveur est la seule
// source de verite (domaine.go), ce fichier ne fait que mettre en forme ce
// qu'il renvoie et faire tourner l'horloge et le compte a rebours entre deux
// rafraichissements.

const RAFRAICHISSEMENT_MS = 5 * 60 * 1000;

// Navigation temporelle (prp/01-navigation-temporelle.md) : choisir le jour
// regardé, jusqu'à 7 jours en arrière et 15 en avant
// (prp/02-horizon-confiance-vent.md). decalageJour est en jours par rapport
// à aujourd'hui (0 = aujourd'hui) ; il ne survit jamais au rechargement —
// pas de stockage, la variable repart à 0 à chaque ouverture de la page. Le
// serveur reste seul juge de la marée et de la météo : ce fichier ne fait
// que choisir QUEL jour demander, jamais calculer une valeur.
const JOURS_ARRIERE_MAX = 7;
const JOURS_AVANT_MAX = 15;
let decalageJour = 0;

function dateLocale(decalage) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + decalage);
  return d;
}

function dateISO(decalage) {
  const d = dateLocale(decalage);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const j = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${j}`;
}

// decalageDepuisISO convertit une date "AAAA-MM-JJ" (telle que renvoyée par
// le serveur pour la tendance) en décalage de jours par rapport à
// aujourd'hui, pour savoir quelle ligne de la tendance mettre en évidence et
// vers quel decalage naviguer au clic.
function decalageDepuisISO(iso) {
  const [y, m, j] = iso.split("-").map(Number);
  const cible = new Date(y, m - 1, j);
  const diffMs = cible.getTime() - dateLocale(0).getTime();
  return Math.round(diffMs / 86400000);
}

function libelleJourNav(decalage) {
  if (decalage === 0) return "Aujourd’hui";
  return dateLocale(decalage).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function majNavigation() {
  const libelle = document.getElementById("nav-jour-libelle");
  const precedent = document.getElementById("nav-precedent");
  const suivant = document.getElementById("nav-suivant");
  const retour = document.getElementById("nav-aujourdhui");
  if (!libelle || !precedent || !suivant || !retour) return;

  libelle.textContent = libelleJourNav(decalageJour);
  precedent.disabled = decalageJour <= -JOURS_ARRIERE_MAX;
  suivant.disabled = decalageJour >= JOURS_AVANT_MAX;
  retour.hidden = decalageJour === 0;
}

// allerAuJour ignore silencieusement une cible hors fenêtre : les flèches
// sont désactivées avant de pouvoir y mener (majNavigation), ce garde-fou
// couvre aussi le clavier et le clic sur une ligne de tendance.
function allerAuJour(decalage) {
  if (decalage < -JOURS_ARRIERE_MAX || decalage > JOURS_AVANT_MAX) return;
  if (decalage === decalageJour) return;
  decalageJour = decalage;
  majNavigation();
  tout();
}

function urlAvecJour(base) {
  return decalageJour === 0 ? base : `${base}?date=${dateISO(decalageJour)}`;
}

const ICONES = {
  soleil: '<circle cx="12" cy="12" r="4.2"/><g stroke-linecap="round"><path d="M12 2.5v3"/><path d="M12 18.5v3"/><path d="M2.5 12h3"/><path d="M18.5 12h3"/><path d="M5.1 5.1l2.1 2.1"/><path d="M16.8 16.8l2.1 2.1"/><path d="M5.1 18.9l2.1-2.1"/><path d="M16.8 7.2l2.1-2.1"/></g>',
  "soleil-voile": '<circle cx="10.5" cy="10" r="4"/><g stroke-linecap="round"><path d="M10.5 2.8v2.4"/><path d="M3.3 10h2.4"/><path d="M5.6 4.9l1.7 1.7"/><path d="M15.4 4.9l-1.7 1.7"/></g><path d="M6 18.5a4 4 0 0 1 .6-7.9 5 5 0 0 1 9.7 1.1 3.6 3.6 0 0 1-.8 6.8H6Z"/>',
  "nuage-soleil": '<circle cx="9" cy="9" r="3.4"/><g stroke-linecap="round"><path d="M9 2.8v2"/><path d="M2.8 9h2"/><path d="M4.8 4.8l1.4 1.4"/><path d="M13.2 4.8l-1.4 1.4"/></g><path d="M7.5 19.2a4.2 4.2 0 0 1 .5-8.3 5.3 5.3 0 0 1 10.2 1.2 3.8 3.8 0 0 1-.8 7.1H7.5Z"/>',
  nuage: '<path d="M6.5 18.5a4.3 4.3 0 0 1 .5-8.5 5.4 5.4 0 0 1 10.4 1.2 3.9 3.9 0 0 1-.8 7.3H6.5Z"/>',
  brouillard: '<g stroke-linecap="round"><path d="M4 8.5h16"/><path d="M2.5 12.5h19"/><path d="M4 16.5h16"/><path d="M7 20.5h10"/></g>',
  "pluie-fine": '<path d="M6.5 13.5a4.1 4.1 0 0 1 .5-8.1A5.2 5.2 0 0 1 17 6.6a3.7 3.7 0 0 1-.8 6.9H6.5Z"/><g stroke-linecap="round"><path d="M9 17.5l-1 2.4"/><path d="M13 17.5l-1 2.4"/></g>',
  pluie: '<path d="M6.5 12.5a4.1 4.1 0 0 1 .5-8.1A5.2 5.2 0 0 1 17 5.6a3.7 3.7 0 0 1-.8 6.9H6.5Z"/><g stroke-linecap="round"><path d="M7.8 16.5l-1.3 3"/><path d="M12 16.5l-1.3 3"/><path d="M16.2 16.5l-1.3 3"/></g>',
  neige: '<path d="M6.5 12.5a4.1 4.1 0 0 1 .5-8.1A5.2 5.2 0 0 1 17 5.6a3.7 3.7 0 0 1-.8 6.9H6.5Z"/><g stroke-linecap="round"><path d="M9 17v4"/><path d="M7 18.4l4 3.2"/><path d="M11 18.4l-4 3.2"/></g>',
  orage: '<path d="M6.5 12.5a4.1 4.1 0 0 1 .5-8.1A5.2 5.2 0 0 1 17 5.6a3.7 3.7 0 0 1-.8 6.9H6.5Z"/><path stroke-linejoin="round" d="M12.5 15l-3 4.5h2.6L11 23l4-5.4h-2.6l1.3-2.6Z"/>',
  vent: '<g stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 9h11.7a2.6 2.6 0 1 0-2.4-3.6"/><path d="M2.5 15h14.9a2.6 2.6 0 1 1-2.4 3.6"/></g>',
  vague: '<path stroke-linecap="round" d="M2 12.5c1.6-1.6 3.2-1.6 4.8 0s3.2 1.6 4.8 0 3.2-1.6 4.8 0 3.2 1.6 4.8 0M2 17.5c1.6-1.6 3.2-1.6 4.8 0s3.2 1.6 4.8 0 3.2-1.6 4.8 0 3.2 1.6 4.8 0"/>',
  goutte: '<path stroke-linejoin="round" d="M12 2.5s6 7.2 6 11.3a6 6 0 1 1-12 0c0-4.1 6-11.3 6-11.3Z"/>',
  fleche_haut: '<path stroke-linecap="round" stroke-linejoin="round" d="M12 19V5M6 11l6-6 6 6"/>',
  fleche_bas: '<path stroke-linecap="round" stroke-linejoin="round" d="M12 5v14M18 13l-6 6-6-6"/>',
};

// esc echappe une chaine avant insertion dans un gabarit HTML. Necessaire
// pour tout champ qui transite depuis un fournisseur externe sans passer par
// un vocabulaire ferme cote serveur — notamment m.precedent.type et
// m.prochain.type, qui viennent tels quels du JSON d'api-maree.fr.
function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

function icone(cle, classe) {
  const contenu = ICONES[cle] || ICONES.nuage;
  return `<svg class="${classe || "icone"}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">${contenu}</svg>`;
}

// Rose des vents a 8 branches, calculee cote client depuis les degres rendus
// par le serveur (vent_direction_deg) : c'est un pur affichage, pas une
// donnée (prp/02-horizon-confiance-vent.md, section 4).
const ROSE_DES_VENTS = ["N", "NE", "E", "SE", "S", "SO", "O", "NO"];
function roseDesVents(deg) {
  if (deg == null || Number.isNaN(deg)) return "";
  const index = (Math.round(deg / 45) % 8 + 8) % 8;
  return ROSE_DES_VENTS[index];
}

function horlogeLocale() {
  const el = document.getElementById("horloge");
  function tick() {
    const maintenant = new Date();
    el.textContent = maintenant.toLocaleString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  tick();
  setInterval(tick, 30 * 1000);
}

async function chargerJSON(url) {
  const reponse = await fetch(url, { headers: { accept: "application/json" } });
  if (!reponse.ok) throw new Error(`${url} : statut ${reponse.status}`);
  return reponse.json();
}

function rendrePrevisions(donnees) {
  const rangee = document.getElementById("heures-rangee");
  const source = document.getElementById("pied-source");
  const titre = document.getElementById("titre-previsions");

  // jour_affiche n'est present que si un `date` a ete demande : sur un jour
  // autre qu'aujourd'hui, le titre le dit et les vignettes sont les
  // vingt-quatre heures du jour. Aujourd'hui comme un autre jour, la bande
  // defile horizontalement plutot que d'etre bornee a une grille fixe : le
  // nombre de vignettes d'aujourd'hui varie desormais avec l'heure (minimum
  // cinq, prp/02-horizon-confiance-vent.md, section 1).
  const autreJour = Boolean(donnees.jour_affiche);
  rangee.classList.add("heures-rangee--defile");
  if (titre) {
    titre.textContent = autreJour
      ? donnees.jour_affiche_libelle || "Ce jour"
      : "Les prochaines heures";
  }

  if (donnees.erreur) {
    rangee.innerHTML = `<p class="etat-attente">${esc(donnees.erreur)}</p>`;
  } else if (autreJour && !(donnees.heures || []).length) {
    // Degradation attendue en bord de fenetre (le fournisseur meteo ne
    // couvre pas tout a fait aussi loin que la navigation) : absence
    // affichee, jamais une carte inventee (PRODUCT.md, principe 3).
    rangee.innerHTML = `<p class="etat-attente">aucune prévision pour ce jour</p>`;
    joursMeteoActuels = donnees.jours || [];
    actualiserTendance();
  } else {
    rangee.innerHTML = (donnees.heures || [])
      .map((h) => {
        // pluie_pct/vent_kmh/vagues_m sont chacun independamment absents
        // (Open-Meteo rend `null` au bord de sa fenetre) : chaque ligne est
        // alors laissee de cote plutot que d'afficher un zero invente
        // (prp/02-horizon-confiance-vent.md, section Degradation).
        const pluie =
          h.pluie_pct != null
            ? `<span class="detail pluie">${icone("goutte")}${h.pluie_pct}%</span>`
            : "";
        const vent =
          h.vent_kmh != null
            ? `<span class="detail">${icone("vent")}${h.vent_kmh}&nbsp;km/h</span>`
            : "";
        const vagues =
          h.vagues_m != null
            ? `<span class="detail">${icone("vague")}${h.vagues_m.toFixed(1)} m</span>`
            : "";
        return `
        <div class="heure-carte">
          <span class="heure">${esc(h.heure)}</span>
          ${icone(h.symbole, "icone")}
          <span class="temperature">${Math.round(h.temperature_c)}°</span>
          <div class="stats">
            ${pluie}
            ${vent}
            ${vagues}
          </div>
        </div>`;
      })
      .join("");

    joursMeteoActuels = donnees.jours || [];
    actualiserTendance();
  }

  if (source) {
    source.textContent = donnees.frais === false
      ? "Open-Meteo · api-maree.fr — dernière donnée connue, fournisseur indisponible"
      : "Open-Meteo · api-maree.fr";
  }
}

// ---------- La section Pluie (prp/03-graphe-de-pluie.md) --------------------
//
// Deux echelles de temps, deux fournisseurs, et le serveur reste seul juge :
// ce fichier ne calcule aucune pluie, il met en forme ce que /api/pluie rend.
//
// La HAUTEUR d'une barre est une INTENSITE en mm/h, pas la lame d'eau du pas.
// Sans cette conversion, un quart d'heure a 0,5 mm et une heure a 0,5 mm
// auraient la meme barre alors que le premier pleut quatre fois plus fort —
// et la courbe changerait d'aspect en changeant simplement de jour, au gre du
// pas que le serveur a pu servir. Le CUMUL affiche sous la courbe, lui, reste
// la somme des lames d'eau : c'est le serveur qui l'a calcule.
const PAS_PAR_HEURE = { quart: 4, heure: 1 };

// Plancher de l'echelle verticale : 2 mm/h, soit une pluie deja franche. Sans
// lui, une bruine a 0,1 mm/h remplirait le graphe et se lirait comme un
// deluge — l'echelle doit rester comparable d'un jour a l'autre.
const ECHELLE_MIN_MMH = 2;

function rendrePluie(donnees) {
  const carte = document.getElementById("pluie-carte");
  if (!carte) return;

  if (donnees.erreur) {
    carte.innerHTML = `<p class="etat-attente">${esc(donnees.erreur)}</p>`;
    return;
  }

  carte.innerHTML = [bandeHeure(donnees.heure), courbeJour(donnees.jour)]
    .filter(Boolean)
    .join("");
}

// bandeHeure rend les 60 minutes qui viennent, par pas de 5 puis 10 minutes.
// Absente sur un autre jour que aujourd'hui (le serveur ne l'envoie alors
// pas) : rien n'est rendu, plutot qu'une bande vide qui serait
// indistinguable d'une heure seche.
function bandeHeure(heure) {
  if (!heure || !(heure.pas || []).length) return "";

  const pas = heure.pas;
  const segments = pas
    .map(
      (p) =>
        `<span class="pluie-seg pluie-seg--${p.niveau}" title="${esc(p.heure)} — ${esc(p.libelle)}"></span>`,
    )
    .join("");

  // Le resume dit ce qu'on veut savoir debout sur le pas de la porte : est-ce
  // que ca va tomber, et dans combien de temps. Premier pas mouille (niveau
  // >= 2) plutot que le maximum : c'est l'echeance qui decide si on part
  // maintenant.
  const premierMouille = pas.find((p) => p.niveau >= 2);
  const resume = !premierMouille
    ? "temps sec pour l’heure qui vient"
    : premierMouille === pas[0]
      ? `${esc(premierMouille.libelle)} en cours`
      : `${esc(premierMouille.libelle)} vers ${esc(premierMouille.heure)}`;

  const maj = heure.mise_a_jour ? ` · relevé de ${esc(heure.mise_a_jour)}` : "";
  const lieu = heure.lieu ? esc(heure.lieu) : "";

  return `
    <div class="pluie-heure">
      <p class="pluie-resume">${resume}</p>
      <div class="pluie-bande" role="img" aria-label="${esc(resumeAccessible(pas))}">${segments}</div>
      <div class="pluie-bande-axe">
        <span>${esc(pas[0].heure)}</span>
        <span>${esc(pas[pas.length - 1].heure)}</span>
      </div>
      <p class="pluie-source">Météo-France${lieu ? ` · ${lieu}` : ""}${maj}</p>
    </div>`;
}

function resumeAccessible(pas) {
  return pas.map((p) => `${p.heure} ${p.libelle}`).join(", ");
}

// courbeJour rend la journee entiere. Le pas ("quart" ou "heure") vient du
// serveur et s'affiche : une courbe qui change de finesse sans le dire
// laisserait croire a une pluie plus reguliere qu'elle ne l'est.
function courbeJour(jour) {
  if (!jour || !(jour.points || []).length) return "";

  const parHeure = PAS_PAR_HEURE[jour.pas] || 1;
  const intensites = jour.points.map((p) => p.mm * parHeure);
  const plafond = Math.max(ECHELLE_MIN_MMH, ...intensites);
  const finesse = jour.pas === "quart" ? "au quart d’heure" : "par heure";

  if (jour.total_mm === 0) {
    return `
      <div class="pluie-jour">
        <p class="pluie-vide">aucune pluie prévue sur la journée</p>
        <p class="pluie-source">journée entière, ${finesse} — Open-Meteo</p>
      </div>`;
  }

  const n = jour.points.length;
  const largeur = 100 / n;
  const barres = jour.points
    .map((p, i) => {
      const hauteur = (p.mm * parHeure * 100) / plafond;
      if (hauteur <= 0) return "";
      return `<rect x="${(i * largeur).toFixed(3)}" y="${(100 - hauteur).toFixed(3)}" width="${(largeur * 0.9).toFixed(3)}" height="${hauteur.toFixed(3)}"></rect>`;
    })
    .join("");

  // Repere de l'heure courante, sur aujourd'hui seulement : sur un autre jour
  // il n'aurait aucun sens.
  const maintenant = new Date();
  const repere =
    decalageJour === 0
      ? `<rect class="pluie-maintenant" x="${(((maintenant.getHours() * 60 + maintenant.getMinutes()) / 1440) * 100).toFixed(3)}" y="0" width="0.4" height="100"></rect>`
      : "";

  const graduations = [6, 12, 18]
    .map((h) => `<rect class="pluie-grille" x="${((h / 24) * 100).toFixed(3)}" y="0" width="0.15" height="100"></rect>`)
    .join("");

  return `
    <div class="pluie-jour">
      <div class="pluie-graphe">
        <span class="pluie-plafond">${plafond.toFixed(1).replace(".", ",")} mm/h</span>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img"
             aria-label="Pluie de la journée, ${finesse}, cumul ${jour.total_mm} millimètres">
          ${graduations}
          ${barres}
          ${repere}
        </svg>
      </div>
      <div class="pluie-axe"><span>0 h</span><span>6 h</span><span>12 h</span><span>18 h</span><span>24 h</span></div>
      <p class="pluie-cumul"><strong>${jour.total_mm.toString().replace(".", ",")} mm</strong> sur la journée</p>
      <p class="pluie-source">journée entière, ${finesse} — Open-Meteo</p>
    </div>`;
}

// Les prévisions météo et la marée arrivent de deux endpoints indépendants,
// qui se dégradent chacun de son côté (PRODUCT.md, principe 3). La tendance
// à 16 jours fusionne les deux par date dès que l'une des deux réponses
// arrive ou change ; l'absence de données de marée (pas de clé, jour non
// couvert par le fournisseur) laisse simplement la ligne de marée de côté,
// jamais une valeur inventée.
let joursMeteoActuels = null;
let joursMareeActuels = null;

// confianceBarres rend l'indice de confiance d'un jour de tendance (jamais
// affiché sur les vignettes horaires, prp/02-horizon-confiance-vent.md,
// section 3) : trois barres remplies 3/2/1 selon le niveau, avec un texte
// accessible qui donne le niveau ET le nombre de modèles comparés. Absent ou
// vide (le serveur omet confiance quand moins de deux modèles portent la
// température) : marque discrète et explicite, jamais une barre remplie ni
// une valeur inventée.
const NIVEAUX_CONFIANCE = { haute: 3, moyenne: 2, basse: 1 };
function confianceBarres(j) {
  if (!j.confiance) {
    return `<span class="confiance confiance--inconnue">confiance inconnue</span>`;
  }
  const rempli = NIVEAUX_CONFIANCE[j.confiance] || 0;
  const barres = [1, 2, 3]
    .map((n) => `<span class="confiance-barre${n <= rempli ? " confiance-barre--remplie" : ""}"></span>`)
    .join("");
  const modeles = j.confiance_modeles || 0;
  return `<span class="confiance" role="img" aria-label="confiance ${esc(j.confiance)}, ${modeles} modèle${modeles > 1 ? "s" : ""} comparé${modeles > 1 ? "s" : ""}">
    <span class="confiance-barres">${barres}</span>
  </span>`;
}

// titreTendance ecrit "Tendance a N jours" a partir du nombre de lignes
// REELLEMENT recues, jamais une valeur en dur : le fournisseur peut rendre
// moins de nombreJoursAffiches (16) jours (un jour sans temperature est omis
// cote serveur, prp/02-horizon-confiance-vent.md, section Degradation), et
// le titre doit dire ce qui s'affiche vraiment, pas ce qui etait vise.
function majTitreTendance(nombreJours) {
  const titre = document.getElementById("titre-tendance");
  if (!titre) return;
  titre.textContent = nombreJours > 0 ? `Tendance à ${nombreJours} jours` : "Tendance";
}

function actualiserTendance() {
  const rangee = document.getElementById("jours-rangee");
  if (!joursMeteoActuels || !joursMeteoActuels.length) {
    majTitreTendance(0);
    rangee.innerHTML = `<p class="etat-attente">tendance indisponible</p>`;
    return;
  }
  majTitreTendance(joursMeteoActuels.length);

  const mareeParDate = new Map((joursMareeActuels || []).map((j) => [j.date, j]));

  rangee.innerHTML = joursMeteoActuels
    .map((j) => {
      const maree = mareeParDate.get(j.date);
      const aDesDonnees = maree && (maree.haute_m != null || maree.basse_m != null);
      const ligneMaree = aDesDonnees
        ? `<div class="jour-maree">
             ${icone("vague")}
             ${maree.haute_m != null ? `<span class="haute">${maree.haute_m.toFixed(1)} m</span>` : "—"}
             <span class="separateur">·</span>
             ${maree.basse_m != null ? `<span class="basse">${maree.basse_m.toFixed(1)} m</span>` : "—"}
             ${maree.coefficient != null ? `<span class="coef">coef&nbsp;${maree.coefficient}</span>` : ""}
           </div>`
        : "";
      // Vent journalier et indice de confiance : une ligne de plus, sur
      // chaque ligne de tendance uniquement (prp/02-horizon-confiance-vent.md,
      // sections 3 et 4). vent_kmh_max/rafales_kmh_max/vent_direction_deg
      // sont chacun independamment absents (Open-Meteo rend `null` au bord
      // de sa fenetre) : chaque partie manquante est omise plutot que
      // d'afficher un zero invente (section Degradation) ; si les trois
      // manquent, la ligne de vent disparait entierement — la confiance,
      // elle, reste toujours affichee (barres ou marque « inconnue »).
      const partiesVent = [];
      if (j.vent_kmh_max != null) partiesVent.push(`<span>${j.vent_kmh_max}&nbsp;km/h</span>`);
      if (j.rafales_kmh_max != null) partiesVent.push(`<span>rafales&nbsp;${j.rafales_kmh_max}&nbsp;km/h</span>`);
      const directionVent = roseDesVents(j.vent_direction_deg);
      if (directionVent) partiesVent.push(`<span class="vent-direction">${directionVent}</span>`);
      const jourVent = partiesVent.length
        ? `<span class="jour-vent">${icone("vent", "jour-vent-icone")}${partiesVent.join('<span class="separateur">·</span>')}</span>`
        : "";
      const ligneVent = `<div class="jour-secondaire">
        ${jourVent}
        ${confianceBarres(j)}
      </div>`;
      // Chaque ligne mene directement au jour qu'elle decrit, et le jour
      // regarde y est mis en evidence (prp/01-navigation-temporelle.md).
      const decalage = decalageDepuisISO(j.date);
      const actif = decalage === decalageJour ? " jour-ligne--actif" : "";
      return `
      <button type="button" class="jour-ligne${actif}" data-decalage="${decalage}" aria-current="${decalage === decalageJour}">
        <div class="jour-principale">
          <span class="jour-nom">${esc(j.jour_semaine)}</span>
          ${icone(j.symbole, "icone")}
          <span class="pluie">${j.pluie_pct_max != null ? `${icone("goutte")}${j.pluie_pct_max}%` : ""}</span>
          <span class="temps"><span class="max">${Math.round(j.temp_max_c)}°</span> <span class="min">${Math.round(j.temp_min_c)}°</span></span>
        </div>
        ${ligneMaree}
        ${ligneVent}
      </button>`;
    })
    .join("");
}

let prochaineBasculeISO = null;
let prochaineBasculeType = null;

function rendreJauge(m) {
  const carte = document.getElementById("jauge-carte");

  if (!m.configure) {
    carte.innerHTML = `
      <div class="jauge-non-configuree">
        <strong>Configuration requise</strong>
        La clé api-maree.fr (variable API_MAREE_KEY) n'est pas encore posée
        côté serveur — la jauge de marée s'activera dès qu'elle le sera.
      </div>`;
    prochaineBasculeISO = null;
    joursMareeActuels = null;
    actualiserTendance();
    return;
  }

  if (m.erreur) {
    carte.innerHTML = `<div class="jauge-non-configuree"><strong>Marée indisponible</strong>${esc(m.erreur)}</div>`;
    prochaineBasculeISO = null;
    joursMareeActuels = null;
    actualiserTendance();
    return;
  }

  joursMareeActuels = m.jours || null;
  actualiserTendance();

  // jour_affiche n'est present que si un `date` a ete demande : sur un
  // autre jour qu'aujourd'hui, la jauge instantanee n'a pas de sens — elle
  // est remplacee par les marées du jour (prp/01-navigation-temporelle.md).
  if (m.jour_affiche) {
    prochaineBasculeISO = null;
    rendreExtremaJour(carte, m);
    return;
  }

  const sensIcone = m.sens === "montante" ? "fleche_haut" : "fleche_bas";
  const sensTexte = m.sens === "montante" ? "Montante" : "Descendante";
  prochaineBasculeISO = m.prochain ? new Date(m.frais === false ? m.prochain.heure : m.prochain.heure) : null;
  // prochain.heure est "HH:MM" (heure locale du jour concerné) ; on recompose
  // une date complete a partir d'aujourd'hui pour le compte a rebours cote
  // client — si l'heure calculee est deja passee de plus de 30 min, elle
  // tombe demain (cycle qui chevauche minuit).
  prochaineBasculeISO = combinerAujourdhui(m.prochain && m.prochain.heure);
  prochaineBasculeType = m.prochain && m.prochain.type;

  carte.innerHTML = `
    <div class="jauge-entete">
      <div class="jauge-hauteur">${m.hauteur_m != null ? m.hauteur_m.toFixed(2) : "—"}<small>m</small></div>
      <div class="jauge-sens">${icone(sensIcone)}${sensTexte}</div>
    </div>
    <div class="jauge-piste">
      <div class="jauge-remplissage" style="transform: scaleX(${(m.position_pct || 0) / 100})"></div>
      <div class="jauge-marqueur" style="left: ${m.position_pct || 0}%"></div>
    </div>
    <div class="jauge-reperes">
      <div class="jauge-repere">
        ${m.precedent ? esc(m.precedent.type) + " " + esc(m.precedent.heure) : ""}
        <strong>${m.precedent ? m.precedent.hauteur_m.toFixed(2) + " m" : "—"}</strong>
      </div>
      <div class="jauge-repere a-droite">
        ${m.prochain ? esc(m.prochain.type) + " " + esc(m.prochain.heure) : ""}
        <strong>${m.prochain ? m.prochain.hauteur_m.toFixed(2) + " m" : "—"}</strong>
      </div>
    </div>
    <p class="jauge-prochaine" id="jauge-compte-a-rebours"></p>
    ${m.frais === false ? '<p class="jauge-perimee">dernière donnée connue, fournisseur indisponible</p>' : ""}
  `;

  majCompteARebours();
}

// rendreExtremaJour affiche les pleines et basses mers d'un jour choisi,
// heure + hauteur + coefficient quand le fournisseur le porte — jamais une
// position "maintenant" sur un jour qui n'est pas aujourd'hui (PRODUCT.md,
// "Ajouté après les PRP").
function rendreExtremaJour(carte, m) {
  const extrema = m.extrema || [];
  const corps = extrema.length
    ? extrema
        .map(
          (e) => `
        <div class="jour-extremum">
          <span class="jour-extremum-type">${e.type === "PM" ? "Pleine mer" : "Basse mer"}</span>
          <span class="jour-extremum-heure">${esc(e.heure)}</span>
          <span class="jour-extremum-hauteur">${e.hauteur_m.toFixed(2)}&nbsp;m</span>
          ${e.coefficient != null ? `<span class="jour-extremum-coef">coef&nbsp;${e.coefficient}</span>` : ""}
        </div>`
        )
        .join("")
    : `<p class="etat-attente">aucune donnée de marée pour ce jour</p>`;

  carte.innerHTML = `
    <p class="jauge-jour-titre">${esc(m.jour_affiche_libelle || "")}</p>
    <div class="jour-extrema-liste">${corps}</div>
    ${m.frais === false ? '<p class="jauge-perimee">dernière donnée connue, fournisseur indisponible</p>' : ""}
  `;
}

function combinerAujourdhui(heureHHMM) {
  if (!heureHHMM) return null;
  const [h, m] = heureHHMM.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  // Si l'heure ainsi construite est deja loin dans le passe (> 6h), la
  // bascule concerne le cycle du lendemain.
  if (d.getTime() < Date.now() - 6 * 60 * 60 * 1000) {
    d.setDate(d.getDate() + 1);
  }
  return d;
}

function majCompteARebours() {
  const el = document.getElementById("jauge-compte-a-rebours");
  if (!el || !prochaineBasculeISO) return;

  const restant = prochaineBasculeISO.getTime() - Date.now();
  if (restant <= 0) {
    el.innerHTML = `Bascule imminente`;
    return;
  }
  const heures = Math.floor(restant / 3600000);
  const minutes = Math.round((restant % 3600000) / 60000);
  const cible = prochaineBasculeType === "PM" ? "pleine mer" : "basse mer";
  const duree = heures > 0 ? `${heures} h ${String(minutes).padStart(2, "0")}` : `${minutes} min`;
  el.innerHTML = `<strong>${cible}</strong> dans ${duree}`;
}

async function tout() {
  try {
    rendrePrevisions(await chargerJSON(urlAvecJour("/api/previsions")));
  } catch (e) {
    document.getElementById("heures-rangee").innerHTML = `<p class="etat-attente">prévisions indisponibles</p>`;
    document.getElementById("jours-rangee").innerHTML = `<p class="etat-attente">tendance indisponible</p>`;
  }
  try {
    rendreJauge(await chargerJSON(urlAvecJour("/api/maree")));
  } catch (e) {
    document.getElementById("jauge-carte").innerHTML = `<p class="etat-attente">marée indisponible</p>`;
  }
  try {
    rendrePluie(await chargerJSON(urlAvecJour("/api/pluie")));
  } catch (e) {
    document.getElementById("pluie-carte").innerHTML = `<p class="etat-attente">pluie indisponible</p>`;
  }
}

// Navigation : deux flèches, un retour à aujourd'hui, les flèches gauche/
// droite du clavier, et chaque ligne de la tendance qui mène à son jour
// (prp/01-navigation-temporelle.md). Une flèche qui sortirait de la fenêtre
// est desactivee (majNavigation) plutôt que menant à un écran vide.
function initNavigation() {
  const precedent = document.getElementById("nav-precedent");
  const suivant = document.getElementById("nav-suivant");
  const retour = document.getElementById("nav-aujourdhui");
  const tendance = document.getElementById("jours-rangee");

  if (precedent) precedent.addEventListener("click", () => allerAuJour(decalageJour - 1));
  if (suivant) suivant.addEventListener("click", () => allerAuJour(decalageJour + 1));
  if (retour) retour.addEventListener("click", () => allerAuJour(0));

  if (tendance) {
    tendance.addEventListener("click", (e) => {
      const ligne = e.target.closest(".jour-ligne");
      if (!ligne) return;
      const decalage = Number(ligne.dataset.decalage);
      if (Number.isFinite(decalage)) allerAuJour(decalage);
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.target && ["INPUT", "TEXTAREA"].includes(e.target.tagName)) return;
    if (e.key === "ArrowLeft") allerAuJour(decalageJour - 1);
    else if (e.key === "ArrowRight") allerAuJour(decalageJour + 1);
  });

  majNavigation();
}

horlogeLocale();
initNavigation();
tout();
setInterval(tout, RAFRAICHISSEMENT_MS);
setInterval(majCompteARebours, 30 * 1000);
