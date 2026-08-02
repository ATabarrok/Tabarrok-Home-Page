import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * Bodies for the markdown-flavoured explainers.
 *
 * These files hold prose and nothing else. Every explainer, markdown or
 * hand-built, is declared in src/data/explainers.yaml, which owns the title,
 * the blurb and the list of papers; a file here is pulled in by the `body`
 * field of one of those entries. So the filename is free, and frontmatter is
 * optional — `updated` is the only field read, and only if you set it.
 *
 * The collection is empty until the first .md file lands here, and the loader
 * says so at build time. That warning is expected.
 */
const explainers = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/explainers' }),
  schema: z.object({
    updated: z.coerce.date().optional(),
  }),
});

export const collections = { explainers };
