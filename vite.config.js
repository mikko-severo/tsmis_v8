import { defineConfig } from "vite";
import marko from "@marko/vite";
//import { resolve } from "path";

export default defineConfig({
  //root: resolve(__dirname, "src"),
  plugins: [marko()],
  build: {
    sourcemap: true, // Generate sourcemaps for all builds.
    emptyOutDir: false, // Avoid server & client deleting files from each other.
    outDir: "./dist",
  },
});
