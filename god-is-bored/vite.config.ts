import { defineConfig } from "vite";
export default defineConfig({
  base: "./",
  build: { target: "es2022", chunkSizeWarningLimit: 900 },
  test: { environment: "node", include: ["tests/**/*.test.ts"], testTimeout: 120000 },
} as any);
