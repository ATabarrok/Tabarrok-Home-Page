Prose bodies for explainers live here.

An explainer is a piece written for readers rather than referees. Some draw
together several of Alex's papers; others are about a subject he has never
written up formally. Every one of them is declared as a block in
src/data/explainers.yaml and listed on /explainers/.

There are three flavours, and at most one field in the block says which.

1. MARKDOWN — body: something.md

Add the block, naming a file in this directory:

    - slug: two-peas
      title: Two peas in a pod, explained
      description: Why capitalism and democracy reinforce each other.
      papers:
        - two-peas-in-a-pod-democracy-and-capitalism
      body: two-peas.md

Then write src/content/explainers/two-peas.md and put nothing in it but the
writing. No frontmatter is needed, because the title, the blurb and the papers
are already declared above. The one field that is read, if you want it:

    ---
    updated: 2026-08-02
    ---

The filename is free — it is referenced explicitly by `body`, so it does not
have to match a paper id. Naming a file that does not exist fails the build
with a list of the files that do.

The page comes out at /explainers/two-peas/ with a standard heading, the blurb,
the date if you set one, then the writing. Headings, lists, quotes, tables,
code and rules are all styled. If the block names papers, they are listed at
the foot of the piece, after the argument rather than before it.

2. A HAND-BUILT PAGE — no body, no url

For anything prose cannot carry — charts, interactive figures, custom tables —
write src/pages/explainers/<slug>.astro. Wrap the content in
<div class="explainer"> and import src/styles/explainer.css, which carries the
shared furniture: figure cards, stat tiles, payoff matrices, application grids,
reference lists. See refund-bonuses.astro.

Astro gives that static file priority over the [slug].astro route, and the
route skips entries without a `body` in any case, so the two never collide.

3. SOMEWHERE ELSE ENTIRELY — url: https://...

A piece that already lives at its own address. Nothing is built; the index and
any paper chips link straight out to it, and the index shows the host so a
reader knows the link leaves the site. See the rent-control entry.

PAPERS ARE OPTIONAL

List paper ids under `papers` and each of those papers gets an "Explainer" chip
on /research/ pointing at the piece. An id matching no paper fails the build, as
does a paper claimed by two explainers. Leave the field out for a piece that
belongs to no paper.

WHAT A PAGE OWNS, AND WHAT IT DOES NOT

The frame belongs to the site: page colour, ink, rules, type stacks and page
width all come from the global tokens. That is what keeps the sticky header the
same colour as the content scrolling under it, so do not give an explainer its
own background.

What a page may own is its accent and its chart series, set as --ex-* overrides
in its own scoped <style> block. A markdown explainer takes the site accent,
since it has nowhere to put an override.

There is no theme toggle. Dark mode follows the operating system, as everywhere
else on the site.

SWITCHING FLAVOURS

Start a piece in markdown, then outgrow it: write the .astro file and delete the
`body` line. The slug, the chips and the URL do not change.

This file is named .txt so the collection loader ignores it. Until the first .md
file lands here the loader warns that the collection is empty. That is expected.
