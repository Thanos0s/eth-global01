import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/__tests__/**/*.test.ts"],
    exclude: ["src/__tests__/erc7579Execution.test.ts", "**/node_modules/**"],
    testTimeout: 15000,
    fileParallelism: false,
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    env: {
      NODE_ENV: "test",
      DEMO_MODE: "false",
      DATABASE_PATH: "./data/tokenization.db",
      HEDERA_NETWORK: "testnet",
      HEDERA_OPERATOR_ID: "0.0.10521086",
      HEDERA_OPERATOR_KEY: "0xa5521c1ab443772d4993015cf5591b9178c3f3118d0097d8d7383e19dbda07ee",
      TOKENIZATION_AGENT_SECRET: "test-agent-secret-key-1234567890abcdef",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
