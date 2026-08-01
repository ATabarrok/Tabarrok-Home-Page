/**
 * One-off: normalise the images pulled from WordPress.
 *
 * The originals were up to 2560px wide for slots that render at ~380px, and
 * the card art was photographic content stored as PNG. Everything becomes
 * right-sized WebP. Astro still generates responsive variants from these;
 * this just stops the repo carrying pixels and bytes nothing ever displays.
 *
 * Safe to re-run: already-WebP files at or below the target are left alone.
 */
import {
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { join, dirname, extname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const dir = join(dirname(fileURLToPath(import.meta.url)), '../src/assets/img');

// Widest rendered size × 2 for retina.
const MAX = { 'alex-tabarrok': 1520 };
const DEFAULT_MAX = 1100;

let before = 0;
let after = 0;

for (const name of readdirSync(dir)) {
  const src = join(dir, name);
  const stem = basename(name, extname(name));
  const dest = join(dir, `${stem}.webp`);
  const size = statSync(src).size;
  before += size;

  const meta = await sharp(src).metadata();
  const target = Math.min(MAX[stem] ?? DEFAULT_MAX, meta.width);

  const out = await sharp(src)
    .resize({ width: target, withoutEnlargement: true })
    .webp({ quality: 82, effort: 6 })
    .toBuffer();

  if (extname(name).toLowerCase() === '.webp' && out.length >= size) {
    after += size;
    console.log(`${name.padEnd(22)} left alone`);
    continue;
  }

  // Write the encoded buffer verbatim. Passing it back through sharp would
  // re-encode it and throw away the settings above.
  //
  // Originals are left in place: Dropbox keeps its synced files as reparse
  // points that Node's unlink refuses to remove. Delete them from the shell
  // afterwards (see the npm script) rather than fighting it here.
  writeFileSync(dest, out);
  after += out.length;
  console.log(
    `${name.padEnd(22)} ${meta.width}px ${(size / 1024).toFixed(0)}kB → ` +
      `${stem}.webp ${target}px ${(out.length / 1024).toFixed(0)}kB`,
  );
}

console.log(
  `\ntotal ${(before / 1024).toFixed(0)}kB → ${(after / 1024).toFixed(0)}kB`,
);
