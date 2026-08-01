import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://alextabarrok.com',
  integrations: [sitemap()],
  // The WordPress site served every page with a trailing slash. Keep that
  // exactly so existing links and search results do not bounce through a 308.
  trailingSlash: 'always',
  build: { format: 'directory' },
  compressHTML: true,
});
