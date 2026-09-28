import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite-plus";

export default defineConfig({
  plugins: [
    // TanStack generates the route tree before React transforms route files.
    tanstackRouter({ target: "react", autoCodeSplitting: true }),
    react(),
  ],
  server: { port: 5174, strictPort: true },
});
