import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  // Astro deletes and recreates the output directory on every build. Inside a
  // Dropbox-synced folder that races the sync client and fails with EBUSY, so
  // locally the output can be redirected outside the synced tree. Vercel sets
  // nothing and gets the normal ./dist.
  outDir: process.env.ASTRO_OUT_DIR || './dist',
  site: 'https://alextabarrok.com',
  integrations: [
    sitemap({ filter: (page) => !page.endsWith('/404/') }),
  ],
  // The WordPress site served every page with a trailing slash. Keep that
  // exactly so existing links and search results do not bounce through a 308.
  trailingSlash: 'always',
  build: { format: 'directory' },
  compressHTML: true,
});
