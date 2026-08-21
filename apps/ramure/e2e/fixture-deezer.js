#!/usr/bin/env node
// Fixture Deezer minimaliste pour le bout en bout de ramure.
//
// Pourquoi ce fichier existe : la §13 du PRD impose que "les parcours
// dependant de sources externes sont testes contre un reseau simule" — et
// c'est le seul moyen d'atteindre l'ecran B (l'arbre planté) sans jamais
// sortir sur Internet. baseDeezer (apps/ramure/deezer.go) est desormais lu
// depuis RAMURE_BASE_DEEZER (main.go, fonction env) ; lancer.sh pointe cette
// variable ici.
//
// Les reponses sont deterministes et minimales : juste ce que deezer.go
// consomme (voir artisteDeezer, albumDeezer). Toute illustration pointe vers
// CE serveur (portrait.svg, silence.mp3) plutot que vers le vrai Deezer : un
// <img> ou un <audio> du navigateur qui la chargerait sortirait sinon sur le
// reseau sans que l'app elle-meme n'y soit pour rien.
'use strict';
const http = require('http');
const { URL } = require('url');

const PORT = Number(process.env.FIXTURE_PORT || '18087');
const ORIGINE = `http://127.0.0.1:${PORT}`;

// Le nom qui declenche sciemment une recherche VIDE (F-36 : "rien a montrer"
// n'est pas une panne). Un vrai nom introuvable produirait exactement la meme
// reponse Deezer — une liste "data" vide.
const NOM_VIDE = 'Nom Introuvable';

// registre associe chaque identifiant distribue a son nom, pour que /artist/
// :id (Detail, promotion depuis une branche) reste cohérent avec la
// resolution initiale par /search/artist.
const registre = new Map();

function idPour(nom) {
  let h = 0;
  for (const c of nom) h = (h * 31 + c.codePointAt(0)) >>> 0;
  const id = String(100000000 + (h % 700000000));
  registre.set(id, nom);
  return id;
}

// Un vivier fixe de voisins, suffisant (> branchesMin) pour que l'arbre se
// dispose normalement (arbre.go). Image et audience non nulles : sinon
// Elague() (arbre.go) les retirerait, ce qui n'est pas ce que ce test veut
// observer.
const VOISINS = Array.from({ length: 8 }, (_, i) => {
  const id = String(900000001 + i);
  const nom = `Voisin ${i + 1}`;
  registre.set(id, nom);
  return { id, nom, fans: 90000 - i * 5000 };
});

const ALBUMS = [
  { id: '910000001', titre: 'Album Un', date: '2020-01-01', genre: 'album' },
  { id: '910000002', titre: 'Album Deux', date: '2018-06-15', genre: 'album' },
  { id: '910000003', titre: 'Single Trois', date: '2015-03-02', genre: 'single' },
];

function artiste(id, nom, fans) {
  return {
    id: Number(id),
    name: nom,
    picture_medium: `${ORIGINE}/portrait.svg`,
    picture_big: `${ORIGINE}/portrait.svg`,
    nb_fan: fans ?? 10000,
    link: `${ORIGINE}/artiste/${id}`,
  };
}

const PORTRAIT_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"><rect width="4" height="4" fill="#345"/></svg>';

function repond(res, corps, statut = 200) {
  res.writeHead(statut, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(corps));
}

const serveur = http.createServer((req, res) => {
  const url = new URL(req.url, ORIGINE);
  const chemin = url.pathname;

  if (chemin === '/portrait.svg') {
    res.writeHead(200, { 'Content-Type': 'image/svg+xml' });
    res.end(PORTRAIT_SVG);
    return;
  }
  if (chemin === '/silence.mp3') {
    res.writeHead(200, { 'Content-Type': 'audio/mpeg' });
    res.end();
    return;
  }

  if (chemin === '/search/artist') {
    const q = (url.searchParams.get('q') || '').trim();
    if (q === NOM_VIDE) {
      repond(res, { data: [] });
      return;
    }
    const id = idPour(q);
    repond(res, { data: [artiste(id, q)] });
    return;
  }

  let m = chemin.match(/^\/artist\/(\d+)$/);
  if (m) {
    const nom = registre.get(m[1]);
    if (!nom) {
      repond(res, { error: { type: 'DataException', message: 'artiste inconnu', code: 800 } });
      return;
    }
    repond(res, artiste(m[1], nom));
    return;
  }

  m = chemin.match(/^\/artist\/(\d+)\/related$/);
  if (m) {
    repond(res, { data: VOISINS.map((v) => artiste(v.id, v.nom, v.fans)) });
    return;
  }

  m = chemin.match(/^\/artist\/(\d+)\/albums$/);
  if (m) {
    repond(res, {
      data: ALBUMS.map((a) => ({
        id: Number(a.id),
        title: a.titre,
        cover_medium: `${ORIGINE}/portrait.svg`,
        cover_big: `${ORIGINE}/portrait.svg`,
        release_date: a.date,
        record_type: a.genre,
        link: `${ORIGINE}/album/${a.id}`,
      })),
    });
    return;
  }

  m = chemin.match(/^\/artist\/(\d+)\/top$/);
  if (m) {
    repond(res, {
      data: ALBUMS.map((a, i) => ({
        title: `Titre ${i + 1}`,
        preview: `${ORIGINE}/silence.mp3`,
        album: { cover_medium: `${ORIGINE}/portrait.svg` },
      })),
    });
    return;
  }

  repond(res, { error: { type: 'DataException', message: 'route inconnue', code: 800 } }, 404);
});

serveur.listen(PORT, '127.0.0.1', () => {
  console.log(`fixture deezer sur ${ORIGINE}`);
});
