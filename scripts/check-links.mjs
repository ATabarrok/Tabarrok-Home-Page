/**
 * Audit every outbound link in the built site.
 *
 * Reports dead links rather than fixing them: many are decades-old journal
 * URLs whose correct replacement is a judgement call, not a lookup.
 *
 *   node scripts/check-links.mjs           # external + internal
 *   node scripts/check-links.mjs --internal  # skip network calls
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const internalOnly = process.argv.includes('--internal');
const CONCURRENCY = 8;
const TIMEOUT_MS = 20_000;

// Bluehost and several publishers reject unadorned bots.
const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
};

function htmlFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...htmlFiles(p));
    else if (name.endsWith('.html')) out.push(p);
  }
  return out;
}

if (!existsSync(dist)) {
  console.error('No dist/ — run `npm run build` first.');
  process.exit(1);
}

/** url -> Set of pages linking to it */
const links = new Map();
for (const file of htmlFiles(dist)) {
  const page = file.slice(dist.length).replace(/\\/g, '/');
  const html = readFileSync(file, 'utf8');
  for (const m of html.matchAll(/href="([^"]+)"/g)) {
    const href = m[1];
    if (href.startsWith('#') || href.startsWith('mailto:')) continue;
    if (!links.has(href)) links.set(href, new Set());
    links.get(href).add(page);
  }
}

const internal = [...links.keys()].filter((h) => h.startsWith('/'));
const external = [...links.keys()].filter((h) => /^https?:\/\//i.test(h));
const odd = [...links.keys()].filter(
  (h) => !h.startsWith('/') && !/^https?:\/\//i.test(h),
);

console.log(
  `${links.size} distinct links: ${internal.length} internal, ` +
    `${external.length} external, ${odd.length} malformed\n`,
);

let problems = 0;

// --- internal ------------------------------------------------------------
for (const href of internal.sort()) {
  const clean = href.split(/[?#]/)[0];
  const candidates = [
    join(dist, clean),
    join(dist, clean, 'index.html'),
    join(dist, `${clean}.html`),
  ];
  if (!candidates.some(existsSync)) {
    problems++;
    console.log(`BROKEN INTERNAL  ${href}`);
    console.log(`                 on ${[...links.get(href)].join(', ')}`);
  }
}

for (const href of odd.sort()) {
  problems++;
  console.log(`MALFORMED        ${href}`);
  console.log(`                 on ${[...links.get(href)].join(', ')}`);
}

// --- external ------------------------------------------------------------
if (!internalOnly) {
  console.log(`\nChecking ${external.length} external links…\n`);

  async function probe(url) {
    for (const method of ['HEAD', 'GET']) {
      try {
        const ctl = AbortSignal.timeout(TIMEOUT_MS);
        const res = await fetch(url, {
          method,
          headers: HEADERS,
          redirect: 'follow',
          signal: ctl,
        });
        // Some servers refuse HEAD but serve GET fine.
        if (res.status === 405 || res.status === 501) continue;
        return { status: res.status };
      } catch (err) {
        if (method === 'GET') return { status: 0, error: String(err.message ?? err) };
      }
    }
    return { status: 0, error: 'unreachable' };
  }

  const queue = [...external].sort();
  const results = [];

  async function worker() {
    for (;;) {
      const url = queue.shift();
      if (!url) return;
      const r = await probe(url);
      results.push([url, r]);
      if (r.status >= 400 || r.status === 0) {
        problems++;
        const label = r.status === 0 ? `ERR ${r.error}` : `HTTP ${r.status}`;
        console.log(`${label.padEnd(16)} ${url}`);
        console.log(`                 on ${[...links.get(url)].join(', ')}`);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  const ok = results.filter(([, r]) => r.status >= 200 && r.status < 400).length;
  console.log(`\n${ok}/${results.length} external links OK`);
}

console.log(
  problems === 0
    ? '\nNo link problems found.'
    : `\n${problems} link problem(s) above — review, do not auto-fix.`,
);
// Dead third-party links are a reporting matter, not a build failure.
process.exit(0);
