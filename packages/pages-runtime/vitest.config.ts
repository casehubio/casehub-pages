import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "happy-dom",
    include: ["src/**/*.test.ts"],
    pool: "vmForks",
    poolOptions: {
      vmForks: {
        memoryLimit: "512MB",
        execArgv: ["--max-old-space-size=6144"],
      },
    },
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/index.ts"],
    },
  },
});
