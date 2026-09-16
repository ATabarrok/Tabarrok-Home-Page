"""Cohort tools extracted from the pinned Chile validate.py and Stata16/20 sources."""
from datetime import datetime, timezone
import hashlib
import importlib.metadata
import json
import math
import os
from pathlib import Path
import platform
import tempfile
from typing import Annotated, Literal
from uuid import uuid4

os.environ.setdefault('MPLCONFIGDIR', str(Path(tempfile.gettempdir()) / 'chile-paper-agent' / 'matplotlib'))
import numpy as np
import pandas as pd
import pyfixest as pf
from pyfixest.demeaners import MapDemeaner
from scipy.stats import t
from fastmcp import FastMCP

REFERENCE = 'Chile source snapshot: validate.py lines 18–71; 16_paper_regressions_ordered.do v1/v4; 20_effect_sizes.do lines 40,196.'
DATA_DIR = Path(__file__).resolve().parents[1] / 'data'
DATA_SHA256 = 'fb64d3b82cbb46f86ca5d4407797533df9353bfa745f6e25454e528067e5df95'
cohort_mcp = FastMCP(name='cohort')


@cohort_mcp.tool()
def chile_run_cohort(
    specification: Annotated[Literal['baseline', 'commune'], 'Baseline subject-by-cohort fixed effects, or additional commune fixed effects.'],
    share_change_pp: Annotated[float, 'Private-share change in percentage points, between -100 and 100; scales the association without changing the data.'] = 10.0,
) -> dict:
    """Re-estimate a validated Chile cohort model and interpret its population-mean association.
    Input is a specification and percentage-point change; output is inference, provenance, and a fresh JSON artifact.
    """
    if specification not in ('baseline', 'commune'):
        raise ValueError('specification must be baseline or commune')
    if not math.isfinite(share_change_pp) or not -100 <= share_change_pp <= 100:
        raise ValueError('share_change_pp must be finite and between -100 and 100')
    run_id = str(uuid4())
    timestamp = datetime.now(timezone.utc).isoformat()
    datafile = DATA_DIR / 'cohort_va.dta'
    if hashlib.sha256(datafile.read_bytes()).hexdigest() != DATA_SHA256:
        raise ValueError('Bundled cohort data failed its validated source-hash check')
    source = json.loads((DATA_DIR / 'source.json').read_text(encoding='utf8'))
    data = pd.read_stata(datafile, convert_categoricals=False)
    data['source_row_id'] = np.arange(1, len(data) + 1)
    # Preserve source storage values; Stata computes in double precision.
    for column in ['score_2m', 'share_priv_2m', 'score_4b', 'wt_2m']:
        data[column] = data[column].astype('float64')
    for column in ['subj_cohort_fe', 'commune_fe', 'cod_com']:
        data[column] = data[column].astype('int64')
    fes = 'subj_cohort_fe' if specification == 'baseline' else 'commune_fe + subj_cohort_fe'
    formula = 'score_2m ~ share_priv_2m + score_4b | ' + fes
    ssc = dict(k_adj=True, k_fixef='nonnested', G_adj=True, G_df='min')
    fit = pf.feols(formula, data=data, weights='wt_2m', weights_type='aweights',
        vcov={'CRV1': 'cod_com'}, fixef_rm='singleton', ssc=pf.ssc(**ssc),
        demeaner=MapDemeaner(fixef_tol=1e-12, backend='rust'))
    ids = np.sort(fit._data.source_row_id.to_numpy(dtype='int64'))
    df = float(fit._df_t)
    critical = float(t.ppf(.975, df))
    terms = {}
    for term in ['share_priv_2m', 'score_4b']:
        b, se = float(fit.coef()[term]), float(fit.se()[term])
        terms[term] = dict(coefficient=b, se=se, pvalue=float(2 * t.sf(abs(b / se), df)),
            ci95=[b - critical * se, b + critical * se])
    primary = terms['share_priv_2m']
    # Script20's b/(10*50) for 10pp, generalized to the requested linear change.
    scale = share_change_pp / 100
    interval = sorted(value * scale for value in primary['ci95'])
    points = primary['coefficient'] * scale
    effect = dict(share_change_pp=share_change_pp, score_points=points,
        score_points_se=primary['se'] * abs(scale), score_points_ci95=interval,
        individual_test_sd=points / 50,
        individual_test_sd_se=primary['se'] * abs(scale) / 50,
        individual_test_sd_ci95=[value / 50 for value in interval],
        test_sd_denominator=50,
        interpretation='Change in the commune population mean implied by the fitted linear association; not an identified causal effect or an individual treatment prediction.')
    packages = {}
    for package in ['pyfixest', 'pandas', 'numpy', 'scipy', 'formulaic', 'fastmcp']:
        dist = importlib.metadata.distribution(package)
        record = dist.read_text('RECORD')
        packages[package] = dict(version=dist.version,
            distribution_record_sha256=hashlib.sha256(record.encode('utf8')).hexdigest() if record else None)
    directory = Path(tempfile.gettempdir()) / 'chile-paper-agent' / run_id
    directory.mkdir(parents=True, exist_ok=False)
    artifact = directory / 'result.json'
    result = dict(message='Re-estimated the selected model on the validated bundled cohort data.',
        reference=REFERENCE, artifacts=[dict(description='Full cohort result and source provenance', path=str(artifact.resolve()))],
        model=specification, specification=specification, formula=formula,
        **primary, N=int(fit._N), clusters=int(fit._data.cod_com.nunique()), df=df,
        terms=terms, effect=effect, run_id=run_id, timestamp=timestamp,
        sample=dict(source_rows=len(data), source_rows_sha256=hashlib.sha256(ids.astype('<i8').tobytes()).hexdigest(),
            row_id_definition='One-based row index of the hash-verified cohort_va.dta; sample hash is sorted little-endian int64 row IDs.',
            excluded_source_rows=np.setdiff1d(data.source_row_id, ids).tolist()),
        settings=dict(weights='wt_2m', weights_type='aweights', covariance={'CRV1':'cod_com'},
            fixef_rm='singleton', ssc=ssc, demeaner=dict(backend='rust', fixef_tol=1e-12)),
        provenance=dict(data_sha256=DATA_SHA256, sources=source,
            wrapper_sha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
            python_version=platform.python_version(),
            python_version_sha256=hashlib.sha256(platform.python_version().encode()).hexdigest(),
            packages=packages),
        scope='Two validated specifications on a fixed dataset. The commune-FE alternative is a distinct robustness specification. Requested share changes scale the estimate and do not refit changed data.')
    # Enforce strict JSON before writing or returning any scientific result.
    serialized = json.dumps(result, indent=2, allow_nan=False)
    artifact.write_text(serialized + '\n', encoding='utf8')
    return result
