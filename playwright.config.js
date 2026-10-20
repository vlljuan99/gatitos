import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

// Pruebas de extremo a extremo en un móvil (la web es mobile first). Arrancan
// el servidor real con el build del cliente y una base temporal con los
// gatitos de demostración: ver e2e/serve.js.
export default defineConfig({
  testDir: 'e2e',
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'es-ES',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'movil', use: { ...devices['Pixel 7'] } }],
  webServer: {
    command: 'node e2e/serve.js',
    url: `http://localhost:${PORT}/api/health`,
    env: { PORT: String(PORT) },
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
