import { defineConfig } from "vitest/config";
import { loadEnv } from "vite";

export default defineConfig(({ mode }) => ({
  test: {
    setupFiles: ["./tests/setup.ts"],
    env: loadEnv(mode, process.cwd(), ""),
    fileParallelism: false,
  },
}));
