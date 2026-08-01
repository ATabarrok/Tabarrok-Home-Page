import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/**
 * Optional plain-language explainers, one per paper.
 *
 * The filename must match a publication `id` in src/data/publications.yaml.
 * The collection is empty today: dropping in `<id>.md` creates
 * /research/<id>/ and makes an "Explainer" chip appear on the research page.
 * Nothing else needs to change.
 */
const explainers = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/explainers' }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    updated: z.coerce.date().optional(),
  }),
});

export const collections = { explainers };
