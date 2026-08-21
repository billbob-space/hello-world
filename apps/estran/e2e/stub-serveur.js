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

function reponseMarine() {
  const jours = [isoJour(0), isoJour(1)];
  const time = jours.flatMap(heuresDuJour);
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
  if (u.pathname.includes("marine")) return repondreJSON(res, reponseMarine());

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
