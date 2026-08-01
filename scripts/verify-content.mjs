/**
 * Content-migration safety net.
 *
 * Compares the text of each built page against a snapshot of the WordPress
 * page it replaces (scripts/baseline/*.txt, captured 2026-08-01).
 *
 * Word order and layout changed deliberately in the rebuild, so this compares
 * word multisets, not sequences. Anything present on the old page but absent
 * from the new one is reported as DROPPED — that is the failure we care about.
 * ADDED words are reported for review but do not fail the run, since the
 * rebuild intentionally introduces new nav and UI text.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const PAGES = [
  { name: 'home', built: 'dist/index.html' },
  { name: 'about', built: 'dist/about/index.html' },
  { name: 'teaching', built: 'dist/teaching/index.html' },
  { name: 'research', built: 'dist/research/index.html' },
  { name: 'consulting', built: 'dist/consulting/index.html' },
];

/**
 * Words that legitimately appear on only one side.
 *
 * Old-side entries are WordPress chrome or content we deliberately rewrote;
 * each one is a decision recorded in the migration plan, not an oversight.
 */
const EXPECTED_MISSING = {
  home: {
    // Button and card labels restyled: "LEARN MORE" → "About",
    // "Marginal Revolution blog" → "Marginal Revolution".
    learn: 1, more: 1, blog: 1,
  },
  about: {
    // "Here are Alex Tabarrok's CV (PDF) and Google Scholar Page." — both
    // links now live in the sidebar, so the carrier sentence is gone.
    here: 1, are: 1, and: 1, s: 1,
  },
  teaching: {},
  research: {
    // "I have also written on several papers on the theory of voting"
    // — the stray "on" was a grammar slip; corrected.
    on: 1,
    // Typos corrected in the intro.
    acclerating: 1, disccussed: 1, difficult: 1,
    // The off-label FDA link went through a GMU library proxy
    // (www-jstor-org.mutex.gmu.edu) that only resolves on campus; the intro
    // now points at the public JSTOR record.
    mutex: 1, www: 1, gmu: 1, edu: 1,
    // CV link used a percent-encoded tilde (%7Eatabarro); we use literal ~.
    '7eatabarro': 1,
    // Footnote anchors (#_ftn1/#_ftn2) were artifacts with no targets.
    ftn1: 1, ftn2: 1,
    // The 21 "Comment:"/"Comments:" labels became styled markup.
    comment: 15, comments: 6,
    // A stray trailing period made this DOI 404; it resolves without one.
    // (Tokenises away, listed here so the decision is recorded.)
  },
  consulting: {
    // Intro sentence was cut off ("for many firms including.") and is now
    // completed; "For more info:" → "For more information".
    including: 1, info: 1,
    // "protocol that allow anyone" → "allows";
    // "as easy as as Zelle or PayPal" → duplicate "as" removed.
    allow: 1, as: 1,
  },
};

function words(s) {
  return (
    s
      .toLowerCase()
      .replace(/&[a-z]+;/g, ' ')
      // Spaces in PDF filenames are percent-encoded in hrefs.
      .replace(/%20/g, ' ')
      // Links were upgraded to https and de-www'd; compare hosts and paths,
      // not the scheme boilerplate, on both sides.
      .replace(/https?:\/\//g, ' ')
      .replace(/\bwww\./g, ' ')
      .match(/[a-z0-9]+/g) ?? []
  );
}

/**
 * Baseline text keeps links as `[text](url)` and headings as `[H2] `.
 * Drop the heading markers and the embedded images (theme chrome that the
 * rebuild replaces), but keep link text and link URLs — both are content.
 */
function baselineText(src) {
  return (
    src
      .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
      .replace(/\[H[1-6]\]/g, ' ')
      // A link whose text is its own URL counted that URL twice on the old
      // page. The rebuild prints a shortened label over the same href, so
      // count it once.
      .replace(/\[\s*([^\]]+?)\s*\]\(\s*\1\s*\)/g, '$1')
      // Internal links are relative now; the origin is not content.
      .replace(/https?:\/\/(?:www\.)?alextabarrok\.com/g, ' ')
  );
}

/**
 * Strip a built page to comparable text. Hrefs are promoted to text so a
 * URL that the old page printed inline still counts as present.
 */
function pageText(html) {
  const body = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<head\b[\s\S]*?<\/head>/gi, ' ');

  // Collect hrefs separately: substituting them in place would leave the URL
  // inside the tag, where the tag-strip below would eat it.
  const hrefs = [...body.matchAll(/href="([^"]*)"/gi)].map((m) => m[1]);

  return body.replace(/<[^>]+>/g, ' ') + ' ' + hrefs.join(' ');
}

function counts(list) {
  const m = new Map();
  for (const w of list) m.set(w, (m.get(w) ?? 0) + 1);
  return m;
}

function missing(a, b) {
  const out = [];
  for (const [w, n] of a) {
    const have = b.get(w) ?? 0;
    if (have < n) out.push([w, n - have]);
  }
  return out.sort((x, y) => y[1] - x[1]);
}

let failed = false;

for (const page of PAGES) {
  const builtPath = join(root, page.built);
  const basePath = join(root, 'scripts/baseline', `${page.name}.txt`);

  if (!existsSync(builtPath)) {
    console.error(`✗ ${page.name}: missing build output ${page.built}`);
    failed = true;
    continue;
  }

  const oldWords = counts(words(baselineText(readFileSync(basePath, 'utf8'))));
  const newWords = counts(words(pageText(readFileSync(builtPath, 'utf8'))));

  const allowed = EXPECTED_MISSING[page.name] ?? {};
  const dropped = missing(oldWords, newWords)
    .map(([w, n]) => [w, n - (allowed[w] ?? 0)])
    .filter(([, n]) => n > 0);

  if (dropped.length === 0) {
    console.log(`✓ ${page.name}: all ${oldWords.size} distinct source words present`);
  } else {
    failed = true;
    const total = dropped.reduce((s, [, n]) => s + n, 0);
    console.error(`✗ ${page.name}: ${total} word occurrences dropped`);
    for (const [w, n] of dropped.slice(0, 40)) {
      console.error(`      ${String(n).padStart(3)} × ${w}`);
    }
    if (dropped.length > 40) {
      console.error(`      … and ${dropped.length - 40} more`);
    }
  }
}

console.log(
  failed
    ? '\nFAIL — content was lost relative to the WordPress site.'
    : '\nPASS — every page retains its source content.',
);
process.exit(failed ? 1 : 0);
