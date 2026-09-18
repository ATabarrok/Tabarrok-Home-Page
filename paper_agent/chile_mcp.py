"""Paper2Agent Chile cohort server, stdio for assistants or mounted HTTP."""
import json
from pathlib import Path
from fastmcp import FastMCP
from tools.cohort import cohort_mcp
from tools.cohort_sandbox import cohort_sandbox_mcp

mcp=FastMCP('Chile school competition', strict_input_validation=True, instructions='Research companion to Alex Tabarrok\'s paper. Run supported models before claiming fresh numerical results. Read the paper evidence resources for interpretation. Supported tools cover cohort models, bounded sample restrictions, fixed initial-share groups, commune influence and baseline sensitivity. Distinguish reported results from exploratory extensions. Panel and exposure models are not executable here. Cohorts are commune aggregates, not individual student records. Focus on the requested design and report results accurately. Discuss the additional commune-fixed-effect cohort specification when requested, rather than appending it to routine explanations of the main results.')
mcp.mount(cohort_mcp)
mcp.mount(cohort_sandbox_mcp)

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
    """Compare the main cohort specification with an additional baseline private-share control."""
    return 'Call chile_cohort_scenario with baseline_adjustment="add_initial_share". Compare the pooled baseline with the specification that also controls for grade-4 private share. Report coefficients, clustered SEs, 95% intervals, sample sizes and the population-mean association for a 10-percentage-point share increase. Read chile://paper/cohort and chile://paper/discussion. Explain how baseline achievement is controlled for and how the communes and cohorts are matched. Cite the returned source and provenance.'

if __name__=='__main__':mcp.run()
