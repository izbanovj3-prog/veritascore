import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In local dev the frontend talks to the backend through these proxies, so the
// app can use same-origin relative URLs (no CORS, WebSocket included). In docker
// the frontend is given VITE_API_BASE and talks to the backend directly.
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          recharts: ["recharts"],
          vendor: ["react", "react-dom", "react-router-dom"],
        },
      },
    },
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      "/audit": "http://localhost:8000",
      "/certificate": "http://localhost:8000",
      "/public-key": "http://localhost:8000",
      "/health": "http://localhost:8000",
      "/ws": { target: "ws://localhost:8000", ws: true },
    },
  },
});
