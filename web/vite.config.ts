import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Production target is Netlify static hosting. The app fetches NOAA SWPC
// directly from the browser (CORS-enabled upstream), so there's no /api
// proxy and no backend in the deployed bundle. `host: true` keeps the dev
// server reachable on LAN / via tunnels for iPad testing; `allowedHosts:
// true` keeps Vite from rejecting non-localhost Host headers.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    allowedHosts: true,
  },
  preview: {
    host: true,
    port: 4173,
    strictPort: true,
    allowedHosts: true,
  },
});
