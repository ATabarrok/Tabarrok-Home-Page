# Chile interactive paper

The page lives at /research/chile/ and uses frozen manuscript estimates. It has no AI service, account requirement, or live Stata execution.

- Page: src/pages/research/chile.astro
- Assets and frozen data: public/research/chile/
- Each estimate records its source table or manuscript excerpt.
- Plotted ranges show one reported standard error, not confidence intervals.
- The manuscript PDF is the supplied 14 July 2026 build; selected headline estimates were checked against it. Its build predates the last saved LaTeX source.

Refresh estimates from a local replication folder:

```powershell
node scripts/export-chile-results.mjs "D:/Dropbox/Projects/Chile School Project Human Replication" public/research/chile
```

Then review the narrative, snapshot date, source changes, and all numerical comparisons. The exporter fails if expected source rows are absent; it does not infer unsupported combinations or missing sample counts. It uses existing Stata output, not new estimation. Build and check the site before committing. Never copy raw data, referee correspondence, or credentials into public/.
