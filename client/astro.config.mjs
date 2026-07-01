import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import node from '@astrojs/node';

// Hybrid SSR — most report pages render per request from the public API
// (/api/result/me) so the data shown matches what the admin published.
// PDF export still works against the served HTML via Playwright.
export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  integrations: [
    tailwind({ applyBaseStyles: false }),
  ],
  server: { port: 4321, host: true },
});
