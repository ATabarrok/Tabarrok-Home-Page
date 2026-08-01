# alextabarrok.com

Astro static site, deployed on Vercel. Replaces the WordPress site that ran on
Bluehost.

## Adding a paper

Open `src/data/publications.yaml`, copy the top block, edit it. Newest first.

```yaml
- id: some-short-slug              # required, unique, lowercase-with-hyphens
  title: "Title: With a Colon Needs Quotes"
  url: https://doi.org/10.xxxx/yyyy   # or `null` if there is no link
  year: 2026                          # or `null` if forthcoming
  links:                              # optional extra links
    - label: working paper version
      url: https://example.org/wp.pdf
  comment: >-                         # optional, e.g. "(with Eric Helland)"
    (with A. Coauthor)
  abstract: >-
    Indented continuation lines are folded into one paragraph. Blank-line
    separated blocks become separate paragraphs.
  citation: >-
    Tabarrok, Alex. 2026. "Title." Journal 1 (1): 1–20.
```

Inside `abstract` and `citation` you can use `[link text](https://url)` and bare
URLs; both render as links. Everything else is escaped, so quotes, angle
brackets and ampersands are safe to paste.

`npm run build` validates the file against a schema (`src/data/schema.ts`) and
fails with the offending field if something is wrong — a bad paste cannot ship
a broken page.

Other data files work the same way: `nonrefereed.yaml`, `consulting.yaml`,
`teaching.yaml`.

## Adding a paper explainer

Create `src/content/explainers/<id>.md`, where `<id>` matches a paper's `id`:

```markdown
---
title: Two Peas in a Pod, explained
description: Why capitalism and democracy reinforce each other.
---

Ordinary markdown.
```

The page appears at `/research/<id>/` and an "Explainer" chip shows up next to
that paper on `/research/`. No code changes needed.

While no explainers exist, the build prints
`The collection "explainers" does not exist or is empty` — harmless, and it
goes away with the first file.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server on http://localhost:4321 |
| `npm run build` | Build to `dist/` |
| `npm run preview` | Serve the built site |
| `npm run verify` | Check no content was lost vs the old WordPress site |
| `npm run links` | Check every outbound link (`-- --internal` to skip the network) |

## Content verification

`scripts/baseline/*.txt` is a snapshot of the WordPress pages taken
2026-08-01. `npm run verify` compares the built pages against it word by word
and fails if anything from the old site went missing. Deliberate edits are
listed with their reasons in `EXPECTED_MISSING` in
`scripts/verify-content.mjs`; add an entry there when you intentionally remove
old wording, or delete the baseline once the old site is gone and the check has
served its purpose.

## URLs

`/`, `/about/`, `/teaching/`, `/research/`, `/consulting/` are preserved exactly
from WordPress, trailing slash included (`trailingSlash: 'always'`). Do not
change these.

`/cv/` redirects to the CV PDF on mason.gmu.edu via `vercel.json`. That redirect
is served by Vercel, so it 404s under `npm run dev` — that is expected.

`/sample-page/` (WordPress boilerplate) intentionally 404s.

## Notes

- Almost all paper PDFs live on `mason.gmu.edu/~atabarro/` and are linked, not
  copied. If that host ever goes away, `npm run links` will say so loudly.
- Images live in `src/assets/img/` and go through Astro's image pipeline
  (resized, converted to WebP). Put new images there, not in `public/`.
- `dist/`, `node_modules/` and `.astro/` are marked
  `com.dropbox.ignored` so Dropbox does not sync build output and lock files
  mid-build. If you clone this elsewhere under Dropbox, do the same.
