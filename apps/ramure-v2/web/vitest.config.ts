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
    // L'axe « couverture navigateur » de scripts/revue.sh (partage, hors
    // perimetre de cette app) ne sait lire qu'un `node --test tests/*.test.js`
    // a la racine de l'app : il ne trouve rien ici, ne mesure rien, et rend
    // un verdict Go seul sans le dire. L'app porte donc sa propre barre,
    // verifiee par test.sh via `npm run test` -> `vitest run --coverage`.
    // Seuil pose au niveau mesure aujourd'hui, arrondi vers le bas : il doit
    // rester vert des l'instant ou il est ecrit, et rougir des qu'un module
    // perd de la couverture.
    coverage: {
      provider: "v8",
      include: ["src/**"],
      reporter: ["text", "json-summary"],
      thresholds: {
        lines: 53,
      },
    },
  },
});
