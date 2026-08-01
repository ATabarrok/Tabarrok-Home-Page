# Dead links inherited from the WordPress site

From `npm run links` on 2026-08-01. These were already broken before the
rebuild; none were introduced by it. Nothing here is auto-fixed, because the
right replacement is a judgement call in every case.

Re-run `npm run links` any time to refresh this picture.

## Not resolving at all

| Link | Where | Note |
|---|---|---|
| `http://TooSlow.pdf` | "Too slow for the urban march" → *ungated* | Not a URL. Someone typed a filename into the link field. The intended target is unknown — the paper's main DOI link works, so the simplest fix is deleting this `links:` entry in `publications.yaml`. |
| `http://www.qjae.org/journals/qjae/pdf/qjae1_1_1.pdf` | Morgans vs Rockefellers | qjae.org no longer resolves. Try mises.org. |
| `http://www.qjae.org/journals/rae/pdf/rae5_2_5.pdf` | Preferred Tax Type | Same. |
| `http://jleo.oupjournals.org/cgi/reprint/19/2/517.pdf` | Contingency Fees | oupjournals.org is retired; use the academic.oup.com URL. |
| `http://connection.ebscohost.com/...` | Time to End America's Drug Lag | EBSCO retired this host. |

## 404

| Link | Where |
|---|---|
| `http://www.cato.org/pubs/regulation/regv28n3/v28n3-2.pdf` | What are Private Governments Worth? |
| `http://www.cato.org/pubs/regulation/regv27n2/v27n2-8.pdf` | Who Certifies Off Label? |
| `http://www.cato.org/pubs/regulation/regv24n4/v24n4-1.pdf` | The Blessed Monopolies |
| `http://www.cato.org/pubs/regulation/regv23n2/helland.pdf` | Exporting Tort Awards |
| `http://www.cato.org/pubs/journal/cj20n1/cj20n1.html` | Review of Law's Order |
| `http://www.cato.org/pubs/journal/cjv14n2-9.html` | Term Limits |
| `http://links.jstor.org/sici?sici=0038-4038...` | Avant-Garde and Popular Art |
| `http://www.independent.org/publications/tir/article.asp?issueID=21&articleID=240` | Assessing the FDA |
| `http://heartland.org/policy-documents/better-way-elect-school-boards` | A Better Way to Elect School Boards |
| `http://regulation2point0.org/.../Brief07-01_topost.pdf` | Abigail Alliance amicus |
| `https://ethics.harvard.edu/Covid-Roadmap` | Roadmap to Pandemic Resilience |
| `https://ethics.harvard.edu/pandemic-resilience-supplement` | Pandemic Resilience: Getting It Done |
| `https://github.com/wirelineio/mechanisms` | Fee Auctions for Block Inclusion |
| `https://www.thinkpragati.com/opinion/1863/dont-blame-empire/` | Don't Blame The Empire |
| `https://mason.gmu.edu/~atabarro/www.FDAReview.org` | FDAReview.org — should probably just be `https://www.fdareview.org/` |
| `https://www.wireline.io/` | About + Consulting — company appears defunct |

The cato.org ones all share a cause: Cato reorganised `/pubs/` years ago. Most
of these papers are also on `mason.gmu.edu/~atabarro/`, which is the more
durable host.

## Not broken, despite what the checker says

Roughly 55 links return `403` to an automated request but work fine in a
browser: `doi.org`, `jstor.org`, `sciencedirect.com`, `journals.uchicago.edu`,
`sagepub.com`, `pnas.org`, `science.org`, `emerald.com`, `mercatus.org`, and
`marginalrevolution.com` among them. These publishers block non-browser
traffic. Treat a 403 in the report as "unknown", not "dead".

## One link with no scheme

`sobelrs.people.cofc.edu/UC/The%20Rule%20of%20Law.pdf` (Judicial elections,
electoral incentives, and checks and balances) has no `http://` prefix in the
source. It renders as plain text rather than a link, which is deliberate — the
renderer refuses to build an href from a scheme-less string. Add `https://` in
`nonrefereed.yaml` to make it a link again, once you've confirmed it resolves.
