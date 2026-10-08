import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import electron from "vite-plugin-electron/simple";

// Le plugin Electron n'est activé que pour la coquille desktop
// (`--mode electron` : npm run electron:dev / npm run dist). `npm run dev` reste
// une UI web pure, utilisée notamment par les tests Playwright.

// Processus principal et preload compilés en CommonJS (.cjs), comme dans Klyra :
// le package est en "type": "module" et un preload sandboxé doit être en CommonJS.
const cjsOutput = {
  build: {
    rollupOptions: {
      external: ["electron", "electron-updater"],
      output: { format: "cjs" as const, entryFileNames: "[name].cjs", inlineDynamicImports: true },
    },
  },
};

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    tailwindcss(),
    mode === "electron" &&
      electron({
        main: {
          entry: "electron/main.ts",
          // Le plugin fusionne ses formats par défaut ("es", car le package est en
          // "type": "module") avec les nôtres : un `lib.formats: ["cjs"]` donnait deux
          // bundles (ESM + CJS) écrits en parallèle dans le même main.cjs, qui pouvait
          // ressortir corrompu. On désactive donc `lib` et on passe par rollup directement.
          vite: {
            build: { ...cjsOutput.build, lib: false, rollupOptions: { ...cjsOutput.build.rollupOptions, input: "electron/main.ts" } },
          },
        },
        preload: { input: "electron/preload.ts", vite: cjsOutput },
      }),
  ],
  // Chemins relatifs : l'UI est chargée depuis app://pediatrix/ en production.
  base: "./",
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
}));
