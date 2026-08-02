# Link repairs

State after the 2026-08-01 audit and repair pass. Re-run `npm run links` to
refresh. Every replacement below was probed and returns 200, or is a DOI whose
`doi.org` redirect resolves to the publisher.

External links resolving: **90 → 105** of 162.

## Repaired

| Was | Now | Why |
|---|---|---|
| `mason.gmu.edu/~atabarro/www.FDAReview.org` | `https://www.fdareview.org/` | The domain had been pasted into a GMU path. |
| `cato.org/pubs/regulation/regv28n3/v28n3-2.pdf` | `cato.org/sites/cato.org/files/serials/files/regulation/2005/9/v28n3-2.pdf` | Cato reorganised `/pubs/` into `/serials/`. |
| `…/regv27n2/v27n2-8.pdf` | `…/regulation/2004/7/v27n2-8.pdf` | Same. |
| `…/regv24n4/v24n4-1.pdf` | `…/regulation/2001/12/v24n4-1.pdf` | Same. |
| `…/regv23n2/helland.pdf` | `…/regulation/2000/7/helland.pdf` | Same. |
| `cato.org/pubs/journal/cjv14n2-9.html` | `…/cato-journal/1994/11/cj14n2-9.pdf` | Same. |
| `cato.org/pubs/journal/cj20n1/cj20n1.html` | `…/cato-journal/2000/5/cj20n1-16.pdf` | The *Law's Order* review is in the book-reviews section; PDF text confirmed. |
| `qjae.org/journals/qjae/pdf/qjae1_1_1.pdf` | `https://cdn.mises.org/qjae1_1_1.pdf` | qjae.org no longer resolves; Mises hosts the PDFs. |
| `qjae.org/journals/rae/pdf/rae5_2_5.pdf` | `https://doi.org/10.1007/BF02426930` | Same, via the Springer DOI. |
| `jleo.oupjournals.org/cgi/reprint/19/2/517.pdf` | `https://doi.org/10.1093/jleo/ewg019` | oupjournals.org is retired. |
| `links.jstor.org/sici?sici=0038-4038…` | `https://www.jstor.org/stable/1061469` | sici-style links are gone; DOI `10.2307/1061469` gives the stable id. |
| `independent.org/…?issueID=21&articleID=240` | `independent.org/publications/tir/article.asp?id=240` | Verified by page title. |
| `sciencedirect.com/science?_ob=MImg&…` (×2) | `10.1016/0167-6296(94)90005-1`, `10.1016/0167-6296(95)00026-7` | Session-scoped 2005-era Elsevier URLs, replaced with DOIs. |
| `thinkpragati.com/opinion/1863/dont-blame-empire/` | Wayback capture (2025-09-17) | Site gone. |
| `ethics.harvard.edu/Covid-Roadmap` | Wayback capture (2024-08-06) | Page removed. |
| `ethics.harvard.edu/pandemic-resilience-supplement` | Wayback capture (2024-07-30) | Page removed. |

DOIs were found via the CrossRef API rather than guessed, and each was checked
to resolve to the right publisher record.

## Unlinked — dead with no replacement

Citation text is untouched in every case; only the anchor was removed. A link
to a 404, or to a domain-sale page, is worse than plain text.

| Link | Entry | Why |
|---|---|---|
| `http://TooSlow.pdf` | Too slow for the urban march | Not a URL — a filename typed into a link field. The paper's DOI link is intact. |
| `wireline.io` | Wireline (About + Consulting) | **Now a HugeDomains "for sale" parking page**; apex and `www` both 404. |
| `connection.ebscohost.com/c/articles/6630465/…` | Time to End America's Drug Lag | Host retired by EBSCO. No Wayback capture. |
| `heartland.org/policy-documents/better-way-elect-school-boards` | A Better Way to Elect School Boards | Document removed. No Wayback capture. |
| `regulation2point0.org/…/Brief07-01_topost.pdf` | Abigail Alliance amicus brief | AEI-Brookings site gone. No Wayback capture. Checked AEI and SSRN without luck. |
| `github.com/wirelineio/mechanisms` | Fee Auctions for Block Inclusion | Repo deleted. The `wirelineio` org still exists but the work does not. |

If you have local copies of any of these, dropping them on
`mason.gmu.edu/~atabarro/` and pointing the citation there would be the durable
fix — that host has proven the most stable of anything on the page.

## Not broken, despite the report

About 55 links return `403` to an automated request but work fine in a browser:
`doi.org`, `jstor.org`, `sciencedirect.com`, `journals.uchicago.edu`,
`sagepub.com`, `pnas.org`, `science.org`, `emerald.com`, `academic.oup.com`,
`mercatus.org` and `marginalrevolution.com` among them. These publishers block
non-browser traffic. Treat a 403 as "unknown", not "dead".

## One link with no scheme

`sobelrs.people.cofc.edu/UC/The%20Rule%20of%20Law.pdf` (Judicial elections,
electoral incentives, and checks and balances) has no `http://` prefix in the
source, so it renders as plain text rather than a link. That is deliberate —
the renderer refuses to build an href from a scheme-less string. Add `https://`
in `nonrefereed.yaml` once you have confirmed it resolves.
