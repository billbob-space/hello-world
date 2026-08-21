#!/usr/bin/env node
// stub-serveur.js — un faux Open-Meteo / api-maree.fr / Meteo-France, pour le
// scenario "donnees connues" du bout en bout (voir lancer.sh).
//
// Aucune dependance : http et url font partie de Node. Toutes les valeurs
// rendues sont FIXES (temperature, hauteur d'eau, cumul de pluie) — c'est ce
// qui permet au test de verifier un CHIFFRE precis affiche a l'ecran, plutot
// que seulement « une valeur quelconque est apparue ». Les horodatages, eux,
// sont calcules autour de « maintenant » a chaque requete, pour que la
// fenetre demandee par l'application (aujourd'hui, l'instant present) soit
// toujours couverte, quelle que soit l'heure a laquelle la suite tourne.
"use strict";
const http = require("http");
const { URL } = require("url");

const port = Number(process.argv[2] || 18085);

// --- Constantes affichees, reprises telles quelles par les tests ----------
const TEMPERATURE_C = 21.4; // Math.round -> 21°
const VAGUES_M = 1.2;
const HAUTEUR_EAU_M = 3.14; // jauge-hauteur
const HAUTEUR_BM_M = 1.0; // extremum de basse mer, .toFixed(2) -> "1.00"
const HAUTEUR_PM_M = 5.5; // extremum de pleine mer, .toFixed(2) -> "5.50"
const CUMUL_PLUIE_MM = 3.0; // total_mm du jour -> "3 mm"

// --- Lieux de test (prp/05-ecran-de-choix.md, section 8) -------------------
//
// Trois points fixes, un par cas du bout en bout : recherchés par un mot-clé
// dans `q` (le nom du test, jamais un vrai nom de commune, pour ne jamais
// être confondu avec une vraie recherche BAN). UN SEUL site de marée dans le
// catalogue, exactement sur LIEU_LITTORAL (distance 0) : LIEU_INTERIEUR en
// est à ~89 km (cote-eloignee, sous seuilFacadeKm), LIEU_INCONNU à plus de
// 600 km (facade-non-couverte) — les deux seuils de lieu.go, sans avoir à les
// dupliquer ici.
const LIEU_LITTORAL = { nom: "Le Touquet-Test", contexte: "Pas-de-Calais", lat: 50.517, lon: 1.583 };
const LIEU_INTERIEUR = { nom: "Arras-Test", contexte: "Pas-de-Calais", lat: 51.317, lon: 1.583 };
const LIEU_INCONNU = { nom: "Zone-Test", contexte: "Zone de test", lat: 45.0, lon: 3.0 };
const SITE_TEST = { site_id: "site-test", site_name: "Le Touquet (site test)", latitude: LIEU_LITTORAL.lat, longitude: LIEU_LITTORAL.lon };

function procheDe(lat, lon, cible, tolerance = 0.05) {
  return Math.abs(lat - cible.lat) < tolerance && Math.abs(lon - cible.lon) < tolerance;
}

// reponseRechercheBAN imite /search : le mot-cle est cherche dans `q`
// (insensible a la casse), jamais une vraie recherche floue — un seul lieu de
// test par mot-cle, ou aucun resultat.
function reponseRechercheBAN(q) {
  const texte = (q || "").toLowerCase();
  let lieu = null;
  if (texte.includes("littoral")) lieu = LIEU_LITTORAL;
  else if (texte.includes("interieur")) lieu = LIEU_INTERIEUR;
  else if (texte.includes("inconnu")) lieu = LIEU_INCONNU;
  if (!lieu) return { type: "FeatureCollection", features: [] };
  return {
    type: "FeatureCollection",
    features: [
      {
        properties: { name: lieu.nom, city: lieu.nom, postcode: "00000", context: lieu.contexte },
        geometry: { coordinates: [lieu.lon, lieu.lat] }, // GeoJSON : [lon, lat]
      },
    ],
  };
}

// reponseReverseBAN imite /reverse : ne resout que les trois points de test
// (et le lieu par defaut, pour que la liste "lieux vus" de l'ecran de choix
// ait un nom a afficher au premier chargement) — tout le reste rend Features
// vide, comme un point en mer (04-le-lieu-devient-une-donnee.md, §1.3).
const LIEU_DEFAUT_STUB = { nom: "Le Touquet-Paris-Plage", contexte: "Pas-de-Calais", lat: 50.517, lon: 1.583 };
function reponseReverseBAN(lat, lon) {
  const connu = [LIEU_LITTORAL, LIEU_INTERIEUR, LIEU_INCONNU, LIEU_DEFAUT_STUB].find((l) => procheDe(lat, lon, l, 0.01));
  if (!connu) return { type: "FeatureCollection", features: [] };
  return {
    type: "FeatureCollection",
    features: [{ properties: { name: connu.nom, city: connu.nom, postcode: "00000", context: connu.contexte }, geometry: { coordinates: [connu.lon, connu.lat] } }],
  };
}

// reponseSites imite le catalogue api-maree.fr/sites (lieu.go/CatalogueMaree)
// : un seul site, exactement sur LIEU_LITTORAL.
function reponseSites() {
  return { sites: [SITE_TEST] };
}

function isoJour(decalage) {
  // Date calendaire (Europe/Paris), independante de l'heure : delta en jours
  // entiers sur un ancrage UTC, jamais d'arithmetique sur une horloge locale
  // qui se ferait piéger par un changement d'heure.
  const auj = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
  const [y, m, d] = auj.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + decalage);
  return dt.toISOString().slice(0, 10);
}

function heuresDuJour(dateISO) {
  return Array.from({ length: 24 }, (_, h) => `${dateISO}T${String(h).padStart(2, "0")}:00`);
}

function reponseForecastComplet() {
  const jours = [isoJour(0), isoJour(1)];
  const time = jours.flatMap(heuresDuJour);
  const n = time.length;
  const repete = (v) => Array(n).fill(v);
  return {
    hourly: {
      time,
      temperature_2m: repete(TEMPERATURE_C),
      precipitation_probability: repete(10),
      cloud_cover: repete(0),
      cloud_cover_low: repete(0),
      cloud_cover_mid: repete(0),
      cloud_cover_high: repete(0),
      is_day: repete(1),
      wind_speed_10m: repete(15),
      wind_direction_10m: repete(220),
      weather_code: repete(0),
    },
    daily: {
      time: jours,
      temperature_2m_max: jours.map(() => TEMPERATURE_C),
      temperature_2m_min: jours.map(() => 15.0),
      precipitation_probability_max: jours.map(() => 10),
      weather_code: jours.map(() => 0),
      wind_speed_10m_max: jours.map(() => 20),
      wind_gusts_10m_max: jours.map(() => 30),
      wind_direction_10m_dominant: jours.map(() => 220),
    },
  };
}

// reponseMarine depend desormais de lat/lon (prp/05-ecran-de-choix.md,
// section 8, cas "interieur") : LIEU_INTERIEUR ne rend AUCUNE hauteur de
// vague (tout `null`), exactement le signal que lieu.go/littoralPour lit pour
// littoral=false — sans quoi tout point de la Terre resterait "littoral" avec
// ce stub, et le cadre pointille ne serait jamais exerce.
function reponseMarine(lat, lon) {
  const jours = [isoJour(0), isoJour(1)];
  const time = jours.flatMap(heuresDuJour);
  if (Number.isFinite(lat) && Number.isFinite(lon) && procheDe(lat, lon, LIEU_INTERIEUR)) {
    return { hourly: { time, wave_height: time.map(() => null) } };
  }
  return { hourly: { time, wave_height: time.map(() => VAGUES_M) } };
}

function reponseAccordVide() {
  // L'indice de confiance est un ornement (meteo.go, delaiAccord) : une
  // reponse vide suffit, aucun test ne le verifie.
  return { daily: { time: [] } };
}

function reponsePluieFineVide() {
  // "Pas de couverture fine aujourd'hui" — cas reel documente dans le
  // README (« la serie fine tombe ... et la courbe passe au pas horaire »).
  // Fait retomber vuePluie sur la serie horaire, seule verifiee par le test.
  return { minutely_15: { time: [], precipitation: [] } };
}

function reponsePluieHoraire() {
  // Un seul pas pluvieux (12h, CUMUL_PLUIE_MM), le reste sec : le cumul du
  // jour est alors connu a l'avance, quelle que soit l'heure du test.
  const dateISO = isoJour(0);
  const time = heuresDuJour(dateISO);
  const precipitation = time.map((t) => (t.endsWith("T12:00") ? CUMUL_PLUIE_MM : 0));
  return { hourly: { time, precipitation } };
}

function reponseExtrema() {
  // Quatre extrema par jour, heures fixes, alternant basse et pleine mer :
  // encadre "maintenant" quelle que soit l'heure du test (ecart max 6h entre
  // deux extrema consecutifs), sur une fenetre de 4 jours calendaires.
  const heuresExtrema = ["02:00", "08:00", "14:00", "20:00"];
  const data = [-1, 0, 1, 2].map((decalage) => {
    const date = isoJour(decalage);
    const extrema = heuresExtrema.map((heure, i) => {
      const estPM = i % 2 === 1;
      return estPM
        ? { type: "PM", time: heure, height: HAUTEUR_PM_M, coef: 45 }
        : { type: "BM", time: heure, height: HAUTEUR_BM_M };
    });
    return { date, extrema };
  });
  return { data };
}

function reponseNiveaux() {
  // Une poignee de points autour de maintenant, tous a la meme hauteur : le
  // point "le plus proche de maintenant" que choisit recupererHauteurActuelle
  // vaut donc toujours HAUTEUR_EAU_M, sans avoir a viser l'instant exact.
  const maintenant = Date.now();
  const data = [-30, -20, -10, 0, 10, 20, 30].map((offsetMin) => ({
    time: new Date(maintenant + offsetMin * 60000).toISOString(),
    height: HAUTEUR_EAU_M,
  }));
  return { data };
}

function reponseNowcast() {
  // Neuf pas secs (niveau 1) : la bande de l'heure qui vient rend alors
  // toujours exactement "temps sec pour l'heure qui vient", sans dependre de
  // l'heure du test.
  const maintenant = Math.floor(Date.now() / 1000);
  const forecast = Array.from({ length: 9 }, (_, i) => ({
    dt: maintenant + (i + 1) * 5 * 60,
    rain: 1,
  }));
  return {
    position: { name: "Le Touquet-Paris-Plage (donnee de test)", rain_product_available: 1 },
    updated_on: maintenant,
    forecast,
  };
}

function repondreJSON(res, corps) {
  const texte = JSON.stringify(corps);
  res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
  res.end(texte);
}

const serveur = http.createServer((req, res) => {
  const u = new URL(req.url, `http://127.0.0.1:${port}`);
  const q = u.searchParams;

  if (u.pathname.includes("tide-extrema")) return repondreJSON(res, reponseExtrema());
  if (u.pathname.includes("water-levels")) return repondreJSON(res, reponseNiveaux());
  if (u.pathname.includes("nowcast")) return repondreJSON(res, reponseNowcast());

  // Catalogue de sites (lieu.go/CatalogueMaree.obtenirSites) : AVANT le test
  // "marine" ci-dessous, "maree-sites" ne le contient pas mais autant rester
  // explicite sur l'ordre.
  if (u.pathname.includes("maree-sites")) return repondreJSON(res, reponseSites());

  // Geocodage BAN (lieu.go/rechercherCommunes, inverserPoint).
  if (u.pathname.includes("/geocode/search")) return repondreJSON(res, reponseRechercheBAN(q.get("q")));
  if (u.pathname.includes("/geocode/reverse")) return repondreJSON(res, reponseReverseBAN(Number(q.get("lat")), Number(q.get("lon"))));

  if (u.pathname.includes("marine")) {
    const lat = Number(q.get("latitude"));
    const lon = Number(q.get("longitude"));
    // "capacite inconnue" (prp/05, section 8, cas 3) : LIEU_INCONNU rend le
    // marin en ERREUR (distinct de LIEU_INTERIEUR ci-dessus, qui repond mais
    // sans aucune vague) — c'est cette erreur que lieu.go/resoudreLittoral lit
    // comme littoral:null, jamais comme littoral:false.
    if (procheDe(lat, lon, LIEU_INCONNU)) {
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end("marine indisponible (stub de test)\n");
    }
    return repondreJSON(res, reponseMarine(lat, lon));
  }

  if (u.pathname.includes("forecast")) {
    // Un seul chemin sert previsions, accord et pluie (meme convention que
    // l'app : c'est la QUERY qui distingue les trois appels, jamais le
    // chemin — voir meteo.go/pluie.go). minutely_15 d'abord : recupererFine
    // pose aussi models=, il ne faut pas le confondre avec l'accord.
    if (q.has("minutely_15")) return repondreJSON(res, reponsePluieFineVide());
    if (q.has("models")) return repondreJSON(res, reponseAccordVide());
    const hourly = q.get("hourly") || "";
    if (hourly.startsWith("temperature_2m")) return repondreJSON(res, reponseForecastComplet());
    if (hourly === "precipitation") return repondreJSON(res, reponsePluieHoraire());
  }

  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("route de stub inconnue : " + req.url + "\n");
});

serveur.listen(port, "127.0.0.1", () => {
  console.log(`stub-serveur.js : a l'ecoute sur 127.0.0.1:${port}`);
});
