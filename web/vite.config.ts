import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// base: "./" -> relative Pfade, funktioniert auf GitHub Pages (Projektseite)
// ohne den Repo-Namen kennen zu muessen.
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
});
