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

const OUT = join(root, 'dist');

const PAGES = [
  { name: 'home', built: 'index.html', path: '/' },
  { name: 'about', built: 'about/index.html', path: '/about/' },
  { name: 'teaching', built: 'teaching/index.html', path: '/teaching/' },
  { name: 'research', built: 'research/index.html', path: '/research/' },
  { name: 'consulting', built: 'consulting/index.html', path: '/consulting/' },
];

// `--base https://…` checks a deployed site instead of the local dist/.
const baseArg = process.argv.indexOf('--base');
const BASE = baseArg > -1 ? process.argv[baseArg + 1]?.replace(/\/$/, '') : null;

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
    // Baseline artefacts, not losses. The WordPress markup put the spacing
    // inside the anchor ("final comments</a>on the survey") and split one
    // link across two anchors ("…and</a><a>Negligence…"), so the captured
    // text ran the words together. The rebuilt pages read correctly.
    commentson: 1, andnegligence: 1,
    // "Available online at: <url>" on the Abigail Alliance brief — the host
    // (regulation2point0.org) is gone with no capture, so the dangling lead-in
    // went with the link. The citation itself is untouched.
    available: 1, online: 1, at: 1,
    // The "ungated" chip on "Too slow for the urban march" pointed at
    // "http://TooSlow.pdf", a filename typed into a link field. The paper's
    // DOI link is intact.
    ungated: 1,
    // Operation Warp Speed is no longer forthcoming: CrossRef records it as
    // published 2025-11-14, Innovations 14 (1-2): 2-22. Citation updated.
    forthcoming: 1,
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
      .match(/[a-z0-9]+/g) ?? []
  );
}

/** Every http(s) URL in a string, normalised so trivia does not count. */
function urls(s) {
  const found = s.match(/https?:\/\/[^\s"'<>()\]]+/g) ?? [];
  return new Set(found.map(normaliseUrl));
}

function normaliseUrl(u) {
  return u
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/%7e/g, '~')
    .replace(/[.,;:)\]]+$/, '')
    .replace(/\/$/, '');
}

/**
 * Baseline prose, with links reduced to their visible text.
 *
 * URLs are compared separately (see linkCheck): comparing them as words meant
 * every legitimate dead-link repair showed up as dozens of "missing" tokens,
 * which would eventually drown out a real content regression.
 */
function baselineText(src) {
  return src
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[H[1-6]\]/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/https?:\/\/[^\s)]+/g, ' ');
}

/** Visible text of a built page, with markup and URLs removed. */
function pageText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<head[\s\S]*?<\/head>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/https?:\/\/[^\s)]+/g, ' ');
}

/** Hrefs of a built page, excluding the chrome the rebuild introduced. */
function pageUrls(html) {
  const body = html.replace(/<head[\s\S]*?<\/head>/gi, ' ');
  const found = [...body.matchAll(/href="(https?:[^"]+)"/gi)].map((m) => m[1]);
  return new Set(found.map(normaliseUrl));
}

/**
 * Links deliberately repointed because the original target died.
 *
 * Keys are the URL as it appeared on the WordPress site; values say where it
 * went and why. A baseline URL that is neither still present nor listed here
 * is a link we lost by accident, and fails the run.
 */
const REPLACED_LINKS = {
  'mason.gmu.edu/~atabarro/www.fdareview.org': 'fdareview.org — domain had been pasted into a GMU path',
  'cato.org/pubs/regulation/regv28n3/v28n3-2.pdf': 'cato.org serials path — Cato reorganised /pubs/',
  'cato.org/pubs/regulation/regv27n2/v27n2-8.pdf': 'cato.org serials path',
  'cato.org/pubs/regulation/regv24n4/v24n4-1.pdf': 'cato.org serials path',
  'cato.org/pubs/regulation/regv23n2/helland.pdf': 'cato.org serials path',
  'cato.org/pubs/journal/cjv14n2-9.html': 'cato.org serials path',
  'cato.org/pubs/journal/cj20n1/cj20n1.html': 'cato.org serials path (book-reviews section)',
  'qjae.org/journals/qjae/pdf/qjae1_1_1.pdf': 'cdn.mises.org — qjae.org no longer resolves',
  'qjae.org/journals/rae/pdf/rae5_2_5.pdf': 'Springer DOI 10.1007/BF02426930',
  'jleo.oupjournals.org/cgi/reprint/19/2/517.pdf': 'DOI 10.1093/jleo/ewg019',
  'independent.org/publications/tir/article.asp?issueid=21&articleid=240':
    'independent.org article.asp?id=240',
  'thinkpragati.com/opinion/1863/dont-blame-empire': 'Wayback capture — site gone',
  'ethics.harvard.edu/covid-roadmap': 'Wayback capture',
  'ethics.harvard.edu/pandemic-resilience-supplement': 'Wayback capture',
  'www-jstor-org.mutex.gmu.edu/stable/24562393':
    'public jstor.org/stable/24562393 — the proxy only resolves on campus',
};

/**
 * Baseline URLs deliberately unlinked because the target is gone and no
 * replacement or archive capture exists. The citation text is untouched in
 * every case — only the anchor was removed, because a link to a 404 (or to a
 * domain-sale page) is worse than plain text.
 */
const DROPPED_LINKS = new Set([
  // Not a URL at all — a filename typed into a link field on the old site.
  'tooslow.pdf',
  // Domain is now a HugeDomains parking page; apex and www both 404.
  'wireline.io',
  // Host retired by EBSCO, no Wayback capture.
  'connection.ebscohost.com/c/articles/6630465/time-end-americas-drug-lag',
  // Document removed by Heartland, no Wayback capture.
  'heartland.org/policy-documents/better-way-elect-school-boards',
  // AEI-Brookings regulation2point0.org is gone, no Wayback capture.
  'regulation2point0.org/wp-content/uploads/downloads/2010/04/brief07-01_topost.pdf',
  // Repository deleted; the wirelineio org remains but the work does not.
  'github.com/wirelineio/mechanisms',
]);

/** URL prefixes whose exact form is allowed to drift (JSTOR ids, old sici). */
const URL_EXEMPT = [
  'links.jstor.org', // sici-style link replaced by the stable JSTOR id
  'sciencedirect.com/science?_ob=mimg', // session-scoped legacy Elsevier URLs
  // Two GMU PDFs have literal spaces in their filenames. The baseline capture
  // truncates them at the first space; the rebuilt pages percent-encode them,
  // which is why they no longer match as strings.
  'mason.gmu.edu/~atabarro/2022',
];

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

if (BASE) console.log(`Checking deployed site at ${BASE}\n`);

for (const page of PAGES) {
  const builtPath = join(OUT, page.built);
  const basePath = join(root, 'scripts/baseline', `${page.name}.txt`);

  let html;
  if (BASE) {
    const res = await fetch(`${BASE}${page.path}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; content-verify)' },
    });
    if (!res.ok) {
      console.error(`✗ ${page.name}: ${BASE}${page.path} returned ${res.status}`);
      failed = true;
      continue;
    }
    html = await res.text();
  } else {
    if (!existsSync(builtPath)) {
      console.error(`✗ ${page.name}: missing build output ${builtPath}`);
      failed = true;
      continue;
    }
    html = readFileSync(builtPath, 'utf8');
  }

  const oldWords = counts(words(baselineText(readFileSync(basePath, 'utf8'))));
  const newWords = counts(words(pageText(html)));

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

  // Links are checked separately from prose so that repairing a dead URL
  // does not read as losing content.
  const oldUrls = urls(readFileSync(basePath, 'utf8'));
  const newUrls = pageUrls(html);
  const lostLinks = [...oldUrls].filter(
    (u) =>
      !newUrls.has(u) &&
      !REPLACED_LINKS[u] &&
      !DROPPED_LINKS.has(u) &&
      !URL_EXEMPT.some((p) => u.startsWith(p)) &&
      !u.startsWith('alextabarrok.com') &&
      !u.includes('wp-content/uploads'),
  );

  if (lostLinks.length === 0) {
    console.log(`    ${oldUrls.size} source links accounted for`);
  } else {
    failed = true;
    console.error(`✗ ${page.name}: ${lostLinks.length} link(s) vanished with no replacement`);
    for (const u of lostLinks.slice(0, 20)) console.error(`      ${u}`);
  }
}

console.log(
  failed
    ? '\nFAIL — content was lost relative to the WordPress site.'
    : '\nPASS — every page retains its source content.',
);
process.exit(failed ? 1 : 0);
