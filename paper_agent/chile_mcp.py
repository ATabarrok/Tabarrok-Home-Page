"""Paper2Agent Chile cohort server, stdio for assistants or mounted HTTP."""
import json
from pathlib import Path
from fastmcp import FastMCP
from tools.cohort import cohort_mcp

mcp=FastMCP('Chile school competition', instructions='Research companion to Alex Tabarrok\'s paper. Run supported models before claiming fresh numerical results. Read the paper evidence resources for interpretation. Only baseline and commune-FE cohort specifications are validated. Cohorts are commune aggregates, not individual student records. The commune-FE near-zero result must not be hidden.')
mcp.mount(cohort_mcp)

@mcp.resource('chile://paper/cohort')
def cohort_evidence() -> str:
    """Author manuscript excerpts with source lines and hash."""
    return json.dumps(json.loads((Path(__file__).parent/'paper/evidence.json').read_text(encoding='utf8'))['cohort'],ensure_ascii=False)

@mcp.resource('chile://paper/discussion')
def discussion_evidence() -> str:
    """Author's magnitudes, qualifications, and identification discussion."""
    return json.dumps(json.loads((Path(__file__).parent/'paper/evidence.json').read_text(encoding='utf8'))['discussion'],ensure_ascii=False)

@mcp.prompt()
def compare_cohort_models() -> str:
    """Reproduce and compare the paper's two validated cohort models."""
    return 'Call chile_run_cohort for baseline and commune, both with share_change_pp=10. Compare the coefficient, clustered SE, 95% CI, sample size, clusters, and population-mean effect. Read chile://paper/cohort and chile://paper/discussion. Explain the identifying variation, near-zero commune-FE finding, aggregate cohort matching, and conditional nature of any per-student interpretation. Cite the returned source and provenance. Do not claim these two models validate the full paper.'

if __name__=='__main__':mcp.run()
