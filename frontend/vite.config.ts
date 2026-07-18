import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const proxyTarget = process.env.VITE_PROXY_TARGET ?? "http://localhost:8000";
const wsProxyTarget = process.env.VITE_WS_PROXY_TARGET ?? "ws://localhost:8000";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/api": { target: proxyTarget, changeOrigin: true },
      "/ws": { target: wsProxyTarget, ws: true, changeOrigin: true },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/setupTests.ts"],
  },
});