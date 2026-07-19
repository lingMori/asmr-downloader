import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [tailwindcss(), react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    proxy: {
      "/api": { target: "http://127.0.0.1:8080", changeOrigin: true },
      "/media": { target: "http://127.0.0.1:8080", changeOrigin: true },
    },
  },
});
