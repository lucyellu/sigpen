import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Vite proxies /api/* to the FastAPI dev server so the iPad (and any other
// LAN client or Cloudflare quick tunnel) only talks to the Vite host — no
// CORS, no NOAA exposure. `host: true` binds 0.0.0.0 so the same dev server
// is reachable over LAN at http://<dev-machine-lan-ip>:5173 and via the
// tunnel script (pnpm tunnel) at https://<random>.trycloudflare.com.
// allowedHosts: true keeps Vite from rejecting either of those Host headers
// in current or future Vite versions; we accept the (small) DNS-rebinding
// risk on a dev server in exchange for not having to update an allowlist
// each time the tunnel hostname rotates.
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    allowedHosts: true,
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
    allowedHosts: true,
  },
});
