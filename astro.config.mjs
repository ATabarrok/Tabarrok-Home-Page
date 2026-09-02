import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://alextabarrok.com',
  integrations: [
    sitemap({
      filter: (page) => !page.endsWith('/404/'),
      // The rent-control explainer is a self-contained bundle under public/,
      // copied to dist/ rather than built as a route, so the integration
      // never sees it. Name it here or it is absent from the sitemap.
      customPages: ['https://alextabarrok.com/explainers/rent-control/'],
    }),
  ],
  // The WordPress site served every page with a trailing slash. Keep that
  // exactly so existing links and search results do not bounce through a 308.
  trailingSlash: 'always',
  build: { format: 'directory' },
  compressHTML: true,
});
