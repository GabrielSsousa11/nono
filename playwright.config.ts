import { defineConfig, devices } from "@playwright/test";

const PORT = 3200;
const MOCK = 54399;

/**
 * E2E contra o BUILD DE PRODUÇÃO, com conteúdo oficial (não sintético) e um
 * mock local do Supabase (tests/e2e/mock-supabase.mjs).
 */
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "off",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: [
    {
      command: `node tests/e2e/mock-supabase.mjs`,
      url: `http://127.0.0.1:${MOCK}/health`,
      env: { MOCK_SUPABASE_PORT: String(MOCK) },
      reuseExistingServer: !process.env.CI,
    },
    {
      command: `npm run build && npx next start -p ${PORT} -H 127.0.0.1`,
      url: `http://127.0.0.1:${PORT}`,
      timeout: 300_000,
      reuseExistingServer: !process.env.CI,
      env: {
        NEXT_PUBLIC_SITE_URL: `http://127.0.0.1:${PORT}`,
        NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${MOCK}`,
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_e2e_dummy_key_000000",
        CG_CONTENT_SOURCE: "official",
        NEXT_TELEMETRY_DISABLED: "1",
      },
    },
  ],
});
