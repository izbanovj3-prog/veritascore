import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// Single self-contained HTML file: runs from file://, a USB stick, or any host.
export default defineConfig({
  base: "./",
  plugins: [react(), viteSingleFile()],
  server: { port: 5199 },
  build: {
    target: "es2020",
    assetsInlineLimit: 100000000, // fonts → data: URIs
  },
});
