import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  base: "./",
  plugins: [react()],
  server: {
    strictPort: true,
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
});
