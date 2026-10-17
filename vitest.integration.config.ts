import { defineConfig } from "vitest/config";
import path from "path";
try { process.loadEnvFile(".env"); } catch {}
export default defineConfig({
  test: { environment: "node", include: ["src/__tests__/**/*.integration.test.ts"], testTimeout: 30000, hookTimeout: 30000, fileParallelism: false },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
});
