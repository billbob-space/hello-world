// apps/ramure-v2/web/tests/e2e/support/serveur.ts
//
// Demarre et arrete le VRAI serveur Go (PRP 09, tache 1 : "ce PRP consomme
// l'application entiere") pour la duree d'un fichier de specification.
// Chaque fichier possede son propre cycle demarrerServeur()/arreterServeur()
// (test.beforeAll/afterAll) plutot qu'un `webServer` unique partage par
// toute la suite (playwright.config.ts) : le test de mise a jour (F-42,
// mise-a-jour.spec.ts) a besoin de REDEMARRER le serveur en cours de route
// pour changer le contenu servi de web/dist/sw.js — chose impossible avec
// un unique serveur partage. `playwright.config.ts` fixe `workers: 1` pour
// que ces cycles ne se chevauchent jamais sur le port 8080 (main.go fixe
// ce port en dur, cf. son commentaire "le relire ici depuis
// l'environnement creerait une seconde source de verite").
//
// AUCUN appel reseau reel : le serveur tourne en repli de developpement
// (RAMURE_DATA_DIR absente, collection et reglages en memoire, annonce sur
// sa propre sortie standard) et chaque spec intercepte TOUTES les routes
// /api/... au niveau du navigateur (support/api.ts) avant que la requete
// ne quitte la page — le serveur ne contacte donc jamais MusicBrainz,
// Deezer, Odesli ni Last.fm/ListenBrainz pendant ces tests (PRD §13 :
// "tester contre des sources reelles produit des echecs intermittents").
import { exec, spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execAsync = promisify(exec);

// web/package.json porte "type": "module" : ce fichier tourne en ESM, ou
// __dirname n'existe pas -- import.meta.url est l'equivalent portable.
const ICI = dirname(fileURLToPath(import.meta.url));
/** apps/ramure-v2/ -- exportee pour mise-a-jour.spec.ts (F-42), seul test
 * qui a besoin de lire/modifier web/dist/sw.js entre deux demarrages. */
export const RACINE_APP = resolve(ICI, "../../../..");
export const PORT = 8080;
export const BASE_URL = `http://127.0.0.1:${PORT}`;

export interface ServeurRamure {
  arreter(): Promise<void>;
  /** Sortie standard cumulee, utile pour diagnostiquer un demarrage manque. */
  journal(): string;
}

async function portOccupe(): Promise<boolean> {
  try {
    await fetch(`${BASE_URL}/healthz`, { signal: AbortSignal.timeout(500) });
    return true;
  } catch {
    return false;
  }
}

// libererPort() est le filet de securite ULTIME (voir son site d'appel) :
// `fuser -k` tue TOUT processus qui ecoute encore sur le port, quelle que
// soit son origine (groupe perdu, orphelin d'un run precedent...), puis on
// attend que le port cesse reellement de repondre avant de rendre la main.
async function libererPort(): Promise<void> {
  if (!(await portOccupe())) return;
  try {
    await execAsync(`fuser -k ${PORT}/tcp`);
  } catch {
    // fuser rend un code non nul quand il ne trouve rien a tuer : pas une
    // erreur ici, seul le sondage ci-dessous fait foi.
  }
  const echeance = Date.now() + 5_000;
  while (Date.now() < echeance) {
    if (!(await portOccupe())) return;
    await new Promise((r) => setTimeout(r, 150));
  }
}

async function attendreSante(delaiMs: number, processusDejaSorti: () => boolean): Promise<void> {
  const echeance = Date.now() + delaiMs;
  let derniereErreur: unknown;
  while (Date.now() < echeance) {
    if (processusDejaSorti()) {
      throw new Error("ramure-v2 : le processus est deja sorti pendant l'attente de sante");
    }
    try {
      const reponse = await fetch(`${BASE_URL}/healthz`);
      if (reponse.ok) return;
    } catch (erreur) {
      derniereErreur = erreur;
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`ramure-v2 : le serveur n'a jamais repondu sain sur ${BASE_URL} (${String(derniereErreur)})`);
}

// demarrerServeur lance `go run .` DEPUIS apps/ramure-v2 (jamais depuis
// web/, ou le module Go ne se trouve pas). web/dist doit deja exister
// (npm run --prefix web build, joue plus tot dans test.sh) : //go:embed
// web/dist echoue sinon a la compilation, avant meme que ce code ne
// s'execute.
export function demarrerServeur(env: NodeJS.ProcessEnv = {}): Promise<ServeurRamure> {
  return new Promise((resolvePromesse, reject) => {
    const processus: ChildProcessWithoutNullStreams = spawn("go", ["run", "."], {
      cwd: RACINE_APP,
      // ANOMALIE DE CE HARNAIS DECOUVERTE EN ECRIVANT CE FICHIER (corrigee
      // ici) : "go run ." demarre le BINAIRE COMPILE comme un second
      // processus, enfant du premier. Un SIGKILL envoye au SEUL PID que
      // Node connait (celui de "go run") ne tue QUE le lanceur : le
      // binaire compile survit, orphelin, toujours lie au port 8080 --
      // observe concretement en debogant mise-a-jour.spec.ts (F-42, seul
      // test qui redemarre le serveur EN COURS DE FICHIER, donc le seul a
      // rencontrer un port encore occupe par le run precedent). `detached:
      // true` place "go run" en tete d'un groupe de processus DEDIE ; son
      // enfant compile en herite (POSIX) ; `arreter()` ci-dessous tue tout
      // le GROUPE (PID negatif), jamais un seul PID.
      detached: true,
      env: {
        ...process.env,
        ...env,
        // Repli de developpement volontaire (README, "Variables
        // d'environnement") : collection et reglages en memoire, annonce
        // sur la sortie standard. Ni RAMURE_DATA_DIR ni LASTFM_API_KEY ne
        // sont necessaires a ces tests, et le champ N-06 garantit deja que
        // leur absence degrade une fonction, jamais l'ecran.
      },
    });

    let sortie = "";
    let processusSorti = false;
    processus.stdout.on("data", (d) => (sortie += d.toString()));
    processus.stderr.on("data", (d) => (sortie += d.toString()));

    const erreurDemarrage = (err: Error) => reject(new Error(`ramure-v2 : "go run ." n'a pas demarre : ${err.message}\n${sortie}`));
    processus.once("error", erreurDemarrage);
    // ANOMALIE DE CE HARNAIS DECOUVERTE EN ECRIVANT CE FICHIER (corrigee
    // ici, pas un defaut du produit) : sans ce garde-fou, un port 8080
    // deja occupe (un processus PRECEDENT mal arrete, par exemple) faisait
    // echouer "go run ." en silence -- le processus quittait avec
    // "address already in use" pendant qu'attendreSante() continuait de
    // sonder /healthz, qui repondait quand meme sain... servi par
    // l'ANCIEN processus resté vivant sur ce port, jamais par celui que
    // cette fonction venait de lancer. mise-a-jour.spec.ts (F-42), qui
    // depend d'un VRAI redemarrage pour changer le contenu de sw.js, est
    // le seul test de la serie a l'avoir revele : les autres n'observent
    // que le comportement HTTP, identique quel que soit le processus qui
    // repond.
    processus.once("exit", (code) => {
      processusSorti = true;
      if (code !== 0 && code !== null) {
        reject(new Error(`ramure-v2 : "go run ." s'est arrete (code ${code}) avant de repondre sain -- port ${PORT} deja occupe ?\n${sortie}`));
      }
    });

    attendreSante(20_000, () => processusSorti)
      .then(() => {
        processus.off("error", erreurDemarrage);
        resolvePromesse({
          journal: () => sortie,
          arreter: async () => {
            await new Promise<void>((resolveArret) => {
              // SIGTERM sur le GROUPE (PID negatif, voir le commentaire de
              // `detached: true` plus haut) : le meme signal que docker
              // stop (main.go l'ecoute deja et ferme proprement), jamais
              // SIGKILL d'emblee — un arret sale laisserait parfois le
              // port occupe pour le demarrage suivant.
              processus.once("exit", () => resolveArret());
              try {
                process.kill(-processus.pid!, "SIGTERM");
              } catch {
                resolveArret(); // le groupe n'existe deja plus
              }
              setTimeout(() => {
                try {
                  process.kill(-processus.pid!, "SIGKILL");
                } catch {
                  // deja mort : rien a faire
                }
                resolveArret();
              }, 5_000);
            });
            // Filet de securite FINAL, independant du groupe de processus
            // ci-dessus : quoi qu'il soit arrive au processus lui-meme, le
            // port doit etre LIBRE avant que cette fonction ne rende la
            // main, sans quoi le PROCHAIN demarrerServeur() de ce meme
            // fichier (mise-a-jour.spec.ts, F-42) risque de sonder un
            // processus etranger toujours vivant sur ce port (voir le
            // commentaire au-dessus de `processus.once("exit", ...)` un
            // peu plus haut).
            await libererPort();
          },
        });
      })
      .catch((err) => {
        processus.off("error", erreurDemarrage);
        try {
          process.kill(-processus.pid!, "SIGKILL"); // le groupe entier, voir demarrerServeur() plus haut
        } catch {
          // deja mort
        }
        void libererPort().finally(() => reject(new Error(`${err.message}\n--- sortie du serveur ---\n${sortie}`)));
      });
  });
}
