import { defineConfig } from "vite";
/** Build mono-fichier (artifact autonome) : un seul point d'entrée, tout dans un seul JS. */
export default defineConfig({
  base: "./",
  publicDir: false,
  build: { target: "es2022", outDir: "dist-single", chunkSizeWarningLimit: 2000, rollupOptions: { input: { main: "index.html" }, output: { inlineDynamicImports: true } } },
} as any);
