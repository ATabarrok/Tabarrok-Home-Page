/**
 * Render the limited inline markdown used in the publication data:
 * `[text](url)` links and bare http(s) URLs. Everything else is escaped.
 *
 * The data is authored by hand in YAML, but escaping first means a stray
 * angle bracket in an abstract can never become markup.
 */

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ESCAPES[c]!);
}

/**
 * Only allow schemes that are safe to put in an href.
 *
 * Several PDFs on mason.gmu.edu have spaces in their filenames
 * ("2022 Bjoerkheim Tabarrok.pdf"), so encode those rather than truncate.
 */
function safeHref(url: string): string | null {
  const u = url.trim().replace(/ /g, '%20');
  if (/^https?:\/\//i.test(u) || /^mailto:/i.test(u) || u.startsWith('/')) {
    return u;
  }
  return null;
}

/** Shorten a bare URL so it does not blow out the line length. */
function prettyUrl(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

export function inlineMarkdown(input: string | null): string {
  if (!input) return '';

  const linked = input.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (whole, text: string, url: string) => {
      const href = safeHref(url);
      if (!href) return escapeHtml(text);
      const label = /^https?:\/\//i.test(text.trim())
        ? prettyUrl(text.trim())
        : text;
      return `<a href="${escapeHtml(href)}">${escapeHtml(label)}</a>`;
    },
  );

  // Escape anything that was not part of a link we just built.
  const parts = linked.split(/(<a href="[^"]*">[^<]*<\/a>)/g);
  return parts
    .map((p, i) => (i % 2 === 1 ? p : autolink(escapeHtml(p))))
    .join('');
}

/** Turn bare URLs in already-escaped text into links. */
function autolink(escaped: string): string {
  return escaped.replace(/\bhttps?:\/\/[^\s<>()]+[^\s<>().,;:]/g, (m) => {
    return `<a href="${m}">${prettyUrl(m)}</a>`;
  });
}

/** Plain-text projection, used for the client-side filter index. */
export function toPlainText(input: string | null): string {
  if (!input) return '';
  return input.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1');
}
