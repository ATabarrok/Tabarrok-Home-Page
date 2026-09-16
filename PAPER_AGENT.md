# Website integration

This checkout uses `paper_agent/` where the standalone package uses `src/`. The installation instructions below describe the downloadable `public/research/chile/chile-mcp.zip`, which also includes the bound scientific source scripts. For this website run `python -m uvicorn webapp:app --app-dir paper_agent --port 8765` after installing root `requirements.txt`. Vercel loads `api/chile.py`; Astro continues to build the existing static site.

# Chile paper agent

An executable companion to Alex Tabarrok's *Private School Competition and Student Achievement in Chile*. Built using Paper2Agent's Paper2MCP workflow, pinned at `c5ce59cc726eddebd6623cc70ad2a80ae55c224e`.

## Supported work

`chile_run_cohort(specification, share_change_pp=10)` freshly estimates either `baseline` or `commune` on the bundled commune-level cohort data. It returns both regression terms, clustered standard errors, t-based 95% intervals and p-values, exact sample fingerprints, observations/clusters, effect-unit conversions, and a fresh JSON artifact.

The share change scales the fitted association. It does not alter enrollment data, predict an individual student's outcome, or establish causality. Only these two specifications have been ported and checked against Stata. Other models, subject subsets, alternative datasets, and arbitrary generated code are not supported.

Two MCP resources, `chile://paper/cohort` and `chile://paper/discussion`, contain source excerpts with manuscript line numbers and source hashes. The `compare_cohort_models` prompt asks the assistant to run both models and explain their different identifying variation. This is a code conversion with curated manuscript resources, not a full Paper2Skill conversion of every manuscript page.

## Install and run locally

Tested with Python 3.12 on Windows. From the extracted package root:

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r src/requirements.txt
.\.venv\Scripts\python.exe src/chile_mcp.py
```

The final command starts the stdio MCP server; it waits for an MCP client, rather than showing a browser page. Configure an MCP-capable assistant with command pointing to that environment's Python and one argument pointing to `src/chile_mcp.py`, using absolute paths resolved on your computer. No API key or Stata license is needed to call these tools from an existing assistant. Client registration is not performed by this package.

On Linux/macOS use `.venv/bin/python`; those platforms require their own verification. Do not describe a local Windows test as a Linux deployment test.

## Website and HTTP MCP

The separate website integration uses the same MCP tool through an in-process MCP client. Run the service locally with:

```powershell
.\.venv\Scripts\python.exe -m uvicorn webapp:app --app-dir src --host 127.0.0.1 --port 8765
```

- `GET /api/chile/health`: availability and scope.
- `POST /api/chile/analyze`: JSON `{"specification":"baseline","share_change_pp":10}`; runs a fresh regression.
- `POST /api/chile/chat`: natural-language question plus recent history, using OpenAI Responses function calling. The model chooses calls to the actual MCP server; results are returned with the answer for inspection.
- `/api/chile/mcp/`: stateless Streamable HTTP MCP endpoint for external assistants.

For chat set these server-side environment variables:

| Name | Value |
|---|---|
| `OPENAI_API_KEY` | Your OpenAI API key; never commit it or enter it into the page |
| `CHILE_AGENT_ACCESS_CODE` | A private pilot passphrase, entered by the tester on the page |
| `OPENAI_MODEL` | Optional model override; default `gpt-5-mini` |

In Vercel, add the first two for Production and Preview and redeploy. Chat remains disabled until both are present. Analysis and MCP tools do not consume OpenAI API credits. The pilot passphrase gates chat; it is not a multi-user authentication system or a global spending cap. Before broad public access, configure appropriate Vercel rate limits and API spending controls.

The app sends the reader's question, up to six recent messages, relevant public manuscript excerpts, and aggregate regression output to OpenAI. It requests `store=false` and does not implement an application chat database. Provider logging and retention are governed by the provider's settings. The page keeps the passphrase only in its current input; no key is shipped to the browser.

## Provenance and maintenance

Bundled `src/data/cohort_va.dta` is the existing derived commune × subject × cohort dataset, not student microdata. Its validated SHA-256 is checked before each regression. `src/data/source.json` identifies the scientific source files. `sources/` retains the exact source scripts used for extraction; the original validation driver needs its original project layout to rerun unchanged.

MCP calls save one JSON artifact under the operating system's temporary directory in `chile-paper-agent/<run-id>/`. Callers can remove their result directories after downloading them. The web adapter removes its per-call artifact after returning the record. Every record includes a new run ID and timestamp; results are not precomputed or served from a numerical cache.

The PyFixest calls preserve analytical weights, cluster corrections, singleton removal, and tightly converged fixed-effect absorption from the validated port. The main model uses 6,142 observations/315 clusters; the commune model drops one singleton, using 6,141/314. A new data or code version requires fresh Stata parity and MCP verification before replacing this release.

Detailed development evidence is retained separately, not included as runtime dependencies. The manuscript and its canonical Stata table generator were not modified.
