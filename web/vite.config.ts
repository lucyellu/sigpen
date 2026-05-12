import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Vite proxies /api/* to the FastAPI dev server so the iPad (and any other
// LAN client) only talks to the Vite host — no CORS, no NOAA exposure.
// host: true binds 0.0.0.0 so http://<dev-machine-lan-ip>:5173 is reachable.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: false,
      },
    },
  },
  preview: {
    host: true,
    port: 4173,
    strictPort: true,
  },
});
