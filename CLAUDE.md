# Working in this repository

`README.md` is the guide to the content: how to add a paper, a working paper or
an explainer, what each data file feeds, and the commands. Read it first. This
file covers only what the README does not — the things a session has to know
before it touches anything, and the things that have gone wrong.

## This is the live site

This repository is `ATabarrok/Tabarrok-Home-Page`, and it builds
**alextabarrok.com**. All the content lives here.

There is a second, older repository, `ATabarrok/ATabarrok-github.io`: three
hand-written files (`index.html`, `styles.css`, `README.md`), last touched in
January 2026, superseded by this site and never deployed — its
`atabarrok.github.io` URLs 404. It was archived in October 2026, so it is
read-only and a push to it will be rejected. Nothing there is current. A session
that opens in that repository is in the wrong place and should switch to this one
before doing any work.

## Deploying

Pushing to `main` is the deploy. The Vercel project `tabarrok-home-page` is
connected to this repository and builds production on every push; there is no
separate deploy step to run and no CLI to invoke.

Confirm a deploy by fetching the live page and checking for the change, not by
asking Vercel. In these sessions the Vercel API returns `403 forbidden` for
`list_deployments`, so build status and build logs are not readable from here.
A push is usually live in 30–120 seconds, so poll the URL rather than assuming
either success or failure.

## Validate before pushing

`npm run build` is the real check: it runs the Zod schemas in
`src/data/schema.ts` over every YAML file and fails on a bad id, a duplicate id,
a malformed URL or a missing explainer body. A content change that builds is
very unlikely to break the site.

`npm run verify` needs a build to exist first. On a fresh clone it fails with
`missing build output .../dist/index.html`, which means only that `dist/` has
not been created — not that content was lost. The order is:

```
npm ci && npm run build && npm run verify
```

Note that `verify` compares the built *Astro* pages against the WordPress
baseline. It does not cover anything served straight out of `public/`.

## Explainers have a fourth flavour

The comment at the top of `src/data/explainers.yaml` lists three ways an
explainer's body can be declared: a `body:` markdown file, an offsite `url:`, or
neither, meaning a hand-built page at `src/pages/explainers/<slug>.astro`.

`rent-control` declares neither, but there is no
`src/pages/explainers/rent-control.astro`. It is a self-contained static page at
`public/explainers/rent-control/` (`index.html`, `app.js`, `style.css`,
`images/`), copied verbatim into `dist/` by Astro's `public/` passthrough. Edit
that HTML directly; no build step transforms it, and `npm run verify` does not
check it. `refund-bonuses`, by contrast, really is the third flavour, at
`src/pages/explainers/refund-bonuses.astro`.

So when an explainer is not where `explainers.yaml` implies, look in `public/`
before concluding it is missing.

## What these sessions cannot do

The GitHub proxy allows code pushes but refuses repository settings writes:
`PATCH /repos/...` returns `403 Repository settings writes are not permitted
through this proxy`. Archiving a repository, renaming one, or changing its
settings has to be done by hand in the GitHub UI. There is also no
repository-deletion tool. Account permissions are not the limit here, so do not
retry or look for another route — say what is blocked and give the UI steps.

## Editorial conventions in the prose pages

The explainer HTML uses typographic punctuation: curly quotes and apostrophes
(`’`, `“`, `”`) and em dashes, not ASCII substitutes. Match the surrounding
text when editing, and wrap body lines at roughly 95 columns as the existing
paragraphs do.

Chapter-opening paragraphs carry `class="dropcap"`; preserve it when rewriting
one. Key terms the later text pays off are marked with `<b>` on first use — in
`rent-control`, removing the bolded "insurance against displacement" from
Chapter VIII orphaned two later references to "insurance", so check what a cut
phrase is holding up before dropping it.
