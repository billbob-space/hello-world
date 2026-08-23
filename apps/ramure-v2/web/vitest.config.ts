// apps/ramure-v2/web/vitest.config.ts
//
// environment: 'jsdom' est indispensable des la tache 3 : canevas.ts et
// promotion.ts manipulent du vrai SVG dans un vrai document. geometrie.ts et
// camera.ts n'en ont pas besoin (ils restent purs), mais un seul
// environnement pour toute la suite evite une configuration par fichier.
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.ts"],
    watch: false,
    // Deux seuils, deux distances au code. Celui-ci est LOCAL : il rougit
    // au plus pres du developpeur, des `npm run test` (test.sh l'appelle
    // via `vitest run --coverage`), avant meme un commit. L'axe « couverture
    // navigateur » de scripts/revue.sh (partage, hors perimetre de cette
    // app) lit desormais vitest lui-meme et porte le cliquet de la revue
    // dans apps/ramure-v2/app.yml (`revue_couverture_web`) -- ce n'est plus
    // le verdict Go seul, sans le dire, que ce commentaire decrivait avant
    // que l'outillage partage n'apprenne a lire vitest. Les deux seuils
    // doivent donc rester en phase ; celui-ci ne descend jamais sous celui
    // de app.yml. Seuil arrondi vers le bas : il doit rester vert des
    // l'instant ou il est ecrit, et rougir des qu'un module perd de la
    // couverture. Remonte de 53 a 57 (revue PRP 06) apres l'extraction de
    // la couche reseau de main.ts vers passerelle.ts, couverte a 100 %.
    coverage: {
      provider: "v8",
      include: ["src/**"],
      reporter: ["text", "json-summary"],
      thresholds: {
        lines: 57,
      },
    },
  },
});
