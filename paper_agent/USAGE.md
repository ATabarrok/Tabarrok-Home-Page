# Chile paper research companion

An executable companion to Alex Tabarrok's *Private School Competition and Student Achievement in Chile*, built using the Paper2Agent/Paper2MCP workflow at commit `c5ce59cc726eddebd6623cc70ad2a80ae55c224e`.

## Research tools

The conversational assistant selects tools and runs fresh calculations on bundled commune-level cohort data:

- `chile_cohort_scenario`: subject and geographic restrictions, explicit commune exclusions, and supported baseline adjustments.
- `chile_cohort_initial_share`: compare communes with low and high initial private-enrollment shares. Assignments use each commune's earliest observed grade-4 cohort and stay fixed when the sample changes. The default cutoff is the unweighted median across communes; earliest years vary across communes.
- `chile_cohort_influence`: omit every eligible commune in turn, rank changes in the coefficient, and optionally omit the most influential communes jointly. Downloads retain every individual omission.
- `chile_cohort_baseline_sensitivity`: compare supported baseline-achievement adjustments, including imposed persistence and cell-specific quadratic controls.
- `chile_run_cohort`: reproduce the original pooled and commune-fixed-effect cohort specifications and convert a specified percentage-point change into effect units.

Read the tool input schemas for accepted parameter names, defaults and bounds. The tools reject unsupported or inadequate samples rather than silently replacing them. Filtered, subgroup and influence analyses are exploratory extensions; they are not newly published manuscript results. Separate subgroup estimates are not a formal test that effects differ. Selecting exclusions after looking at results does not provide new causal identification.

The four new tools share `subject` (`both`, `reading`, `math`), `geography` (`all`, `exclude_greater_santiago`, `exclude_rm`) and optional `exclude_communes` (at most ten distinct valid integer codes). Additional inputs are:

| Tool | Additional inputs |
|---|---|
| Scenario | `baseline_adjustment`: `pooled_linear` (default), `add_initial_share`, `none`, `fixed_persistence`, `commune_fe`; `persistence`: 0–1.2, used for fixed persistence |
| Initial share | `cutoff`: optional fraction 0–1; omitted uses the full-data commune median |
| Influence | `top_k`: 0–10, default 3; zero skips the joint exclusion |
| Baseline sensitivity | `persistence_values`: one to six distinct values in 0–1.2; default 0, 0.5, 0.8, 1, 1.2 |

For example, call `chile_cohort_scenario` with `{"geography":"exclude_greater_santiago"}`. It returns the full-data anchor and the restricted-sample estimate. Each new tool returns a labeled `results` array plus settings, warnings and provenance; influence also returns its complete `leave_one_out` array. The legacy tool accepts `specification` (`baseline` or `commune`) and `share_change_pp` (default 10, range −100 to 100).

Greater Santiago means the 34 communes defined in the source script; excluding the Metropolitan Region removes a larger set. Commune codes are provided; the bundled dataset does not contain commune names. No arbitrary code, uploaded datasets, panel re-estimation, exposure reconstruction, spline or quintile models are supported.

Each calculation reports the sample, clustered uncertainty, settings, source/data fingerprints and a unique run record. These are matched commune cohorts, not individual students followed over time. The outcome is an average across the included public and subsidized-private schools.

## Install and run

Use Python 3.12. From the extracted package directory on Windows:

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r src/requirements.txt
.\.venv\Scripts\python.exe src/chile_mcp.py
```

The last command starts a stdio MCP server and waits for an MCP client. Configure an MCP-capable assistant with the absolute path to that environment's Python as its command and the absolute path to `src/chile_mcp.py` as its argument. Calling the tools requires neither Stata nor an OpenAI API key. Client registration is not performed by this package. On Linux/macOS the interpreter path is `.venv/bin/python`.

Two resources, `chile://paper/cohort` and `chile://paper/discussion`, provide manuscript excerpts with provenance. The manuscript resources are curated; this package does not convert or verify the whole paper.

## Website service

The website uses the same tools through an MCP client. To run its backend locally:

```powershell
.\.venv\Scripts\python.exe -m uvicorn webapp:app --app-dir src --host 127.0.0.1 --port 8765
```

Routes:

- `GET /api/chile/health`: availability and scope.
- `POST /api/chile/chat`: natural-language question and recent conversation. The reader's selected model requests actual MCP tool calls; full calculation records accompany its answer.
- `/api/chile/mcp/`: stateless HTTP MCP endpoint.
- `POST /api/chile/analyze`: retained compatibility endpoint for the original two cohort models.

Chat uses the reader's own API key. Supported providers are `openrouter` (default model `openai/gpt-5-mini`) and `openai` (default model `gpt-5-mini`). Readers can choose another model ID supported by their provider, provided it supports function/tool calling. Keys are provider-specific: an OpenRouter key works with OpenRouter, not the direct OpenAI endpoint. Other providers' direct API keys are not implemented.

Send the key as `Authorization: Bearer <reader-key>`. The JSON body has `question`, optional `history` (up to six user/assistant messages), `provider`, and optional `model`. No API key belongs in the JSON conversation. The backend keeps credentials local to each request, uses fixed HTTPS provider endpoints, and blocks redirects. It never falls back to the website owner's API key. The old `OPENAI_API_KEY`, `CHILE_AGENT_ACCESS_CODE` and `OPENAI_MODEL` environment variables are not used by this version.

The page keeps the key only in its password input, clears it when leaving or switching providers, and provides a Clear key button. It does not put the key in localStorage, sessionStorage, URLs, calculation downloads or a database. Requests carry it over HTTPS through the website backend to the selected provider. Application code does not log keys or return provider error bodies; hosting and provider infrastructure remain subject to their respective policies.

The question, up to six recent messages, public manuscript excerpts and compact aggregate tool results are sent to the selected provider. OpenAI Responses requests set `store=false`; OpenRouter and downstream-provider retention follows their policies. Full influence records remain available for the reader's download. The app has no chat database. AI usage is charged to the reader's provider account; scientific tool execution itself does not consume AI API credits.

Provider protocol references: [OpenRouter tool calling](https://openrouter.ai/docs/guides/features/tool-calling), [OpenAI function calling](https://developers.openai.com/api/docs/guides/function-calling). Protocol tests use simulated model responses with real scientific MCP calls; a funded provider key is needed to verify an actual model answer.

## Reproducibility

`src/data/cohort_va.dta` is derived commune-level data, not student microdata. Runtime files carry source and data hashes; exact source scripts are retained in `sources/`. The original source drivers need their original project layout to rerun unchanged.

MCP tools create unique JSON artifacts in the operating system's temporary directory. The web adapter returns their contents and removes its temporary artifact. Numerical results are computed on demand. Downloads state uncertainty, sample sizes and limitations.

Validation uses independent native Stata references, including all 315 single-commune omissions on the full sample. Coefficients and clustered standard errors are checked at absolute tolerance `1e-8`, with exact sample membership, observation counts, cluster counts and inference degrees of freedom. This establishes agreement for the tested cohort operations, not correctness of every model in the research project. The manuscript and canonical publication tables are unchanged.
