import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./tests/helpers/test-env.js"],
    fileParallelism: false,
    sequence: { concurrent: false },
    testTimeout: 10_000,
    hookTimeout: 10_000,
  },
});
