import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    exclude: ["**/node_modules/**"],
    globals: true,
    setupFiles: ["src/test-setup.ts"],
    projects: [
      {
        // Main-process and shared code runs in Node in production; testing it
        // without DOM globals matches that and skips per-file DOM setup.
        extends: true,
        test: {
          name: "main",
          environment: "node",
          include: ["src/**/*.test.{ts,tsx}"],
          exclude: ["**/node_modules/**", "src/renderer/**"],
        },
      },
      {
        extends: true,
        test: {
          name: "renderer",
          environment: "happy-dom",
          include: ["src/renderer/**/*.test.{ts,tsx}"],
        },
      },
    ],
  },
});
