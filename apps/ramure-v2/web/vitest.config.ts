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
  },
});
