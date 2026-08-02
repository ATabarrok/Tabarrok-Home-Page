import { z } from 'astro/zod';
import yaml from 'js-yaml';

import publicationsRaw from './publications.yaml?raw';
import nonrefereedRaw from './nonrefereed.yaml?raw';
import consultingRaw from './consulting.yaml?raw';
import teachingRaw from './teaching.yaml?raw';
import explainersRaw from './explainers.yaml?raw';

const publication = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/, 'id must be a lowercase slug'),
  title: z.string().min(1),
  url: z.string().url().nullable().default(null),
  year: z.number().int().min(1980).max(2100).nullable().default(null),
  links: z
    .array(z.object({ label: z.string(), url: z.string().url() }))
    .default([]),
  comment: z.string().nullable().default(null),
  abstract: z.string().nullable().default(null),
  citation: z.string().nullable().default(null),
});

const firm = z.object({
  name: z.string(),
  url: z.string().url().nullable().default(null),
  logo: z.string(),
  years: z.string().nullable().default(null),
  description: z.string(),
});

const course = z.object({
  title: z.string(),
  url: z.string().url(),
  level: z.string(),
});

/**
 * An explainer covering one or more papers, served at /explainers/<slug>/.
 *
 * This file is the single declaration point: it owns the title, the blurb and
 * the papers the piece covers, whatever the body is written in. `body` names a
 * markdown file for a plain-prose piece; omitting it means the body is a
 * hand-built page at src/pages/explainers/<slug>.astro.
 */
const explainer = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/, 'slug must be a lowercase slug'),
  title: z.string().min(1),
  description: z.string().min(1),
  papers: z.array(z.string()).min(1),
  body: z
    .string()
    .regex(/^[a-z0-9-]+\.md$/, 'body must be a markdown filename, e.g. foo.md')
    .nullable()
    .default(null),
});

/** Parse + validate a YAML file, failing the build with a useful message. */
function load<T>(raw: string, schema: z.ZodType<T>, file: string): T {
  const parsed = schema.safeParse(yaml.load(raw));
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  ${file} → ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid content in ${file}:\n${issues}`);
  }
  return parsed.data;
}

export type Publication = z.infer<typeof publication>;
export type Firm = z.infer<typeof firm>;
export type Course = z.infer<typeof course>;
export type Explainer = z.infer<typeof explainer>;

export const publications = load(
  publicationsRaw,
  z.array(publication),
  'publications.yaml',
);

export const nonrefereed = load(
  nonrefereedRaw,
  z.array(z.string()),
  'nonrefereed.yaml',
);

export const consulting = load(consultingRaw, z.array(firm), 'consulting.yaml');
export const teaching = load(teachingRaw, z.array(course), 'teaching.yaml');

export const explainers = load(
  explainersRaw,
  z.array(explainer),
  'explainers.yaml',
);

// A duplicate id would silently collide with a future explainer route.
const seen = new Set<string>();
for (const p of publications) {
  if (seen.has(p.id)) throw new Error(`Duplicate publication id: ${p.id}`);
  seen.add(p.id);
}

/**
 * paper id → the long-form explainer that covers it, so the research page can
 * place a chip without every paper repeating the link. Built here rather than
 * in the page so a typo in `papers` fails the build instead of silently
 * dropping a chip.
 */
export const explainerByPaper = new Map<string, Explainer>();
const slugs = new Set<string>();

for (const e of explainers) {
  if (slugs.has(e.slug)) throw new Error(`Duplicate explainer slug: ${e.slug}`);
  slugs.add(e.slug);

  for (const id of e.papers) {
    if (!seen.has(id)) {
      throw new Error(
        `explainers.yaml → ${e.slug} lists an unknown paper id: ${id}`,
      );
    }
    const other = explainerByPaper.get(id);
    if (other) {
      throw new Error(
        `Paper ${id} is claimed by two explainers: ${other.slug} and ${e.slug}`,
      );
    }
    explainerByPaper.set(id, e);
  }
}
