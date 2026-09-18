"""Bounded cohort analyses extracted from validate.py and Stata scripts 16, 21, 25.

New sample grouping and repeated exclusions were requested by the author and
independently executed in Stata before extraction; these are exploratory results.
"""
from datetime import datetime, timezone
import hashlib
import importlib.metadata
import json
import math
import os
from pathlib import Path
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
from pydantic import StrictInt, StrictFloat, Field

REFERENCE = 'Pinned Chile validate.py:18-71; Stata16:425-465; Stata21:321-329; Stata25:52-98,127-129.'
DATA_DIR = Path(__file__).resolve().parents[1] / 'data'
DATA_SHA256 = 'fb64d3b82cbb46f86ca5d4407797533df9353bfa745f6e25454e528067e5df95'
cohort_sandbox_mcp = FastMCP(name='cohort_sandbox', strict_input_validation=True)
Subject = Literal['both', 'reading', 'math']
Geography = Literal['all', 'exclude_greater_santiago', 'exclude_rm']
Adjustment = Literal['pooled_linear', 'add_initial_share', 'none', 'fixed_persistence', 'commune_fe']
SSC = dict(k_adj=True, k_fixef='nonnested', G_adj=True, G_df='min')
LABELS = dict(pooled_linear='Pooled linear baseline adjustment', add_initial_share='Also control grade-4 private share',
              none='No baseline-score control', fixed_persistence='Imposed baseline persistence',
              commune_fe='Additional commune fixed effects', cell_quadratic='Cell-specific quadratic baseline adjustment')


def _load():
    path = DATA_DIR / 'cohort_va.dta'
    if hashlib.sha256(path.read_bytes()).hexdigest() != DATA_SHA256:
        raise ValueError('Bundled cohort data failed its validated source-hash check')
    data = pd.read_stata(path, convert_categoricals=False)
    data['source_row_id'] = np.arange(1, len(data) + 1)
    for col in ['score_2m', 'score_4b', 'share_priv_2m', 'share_priv_4b', 'wt_2m']:
        data[col] = data[col].astype('float64')
    for col in ['subj_cohort_fe', 'commune_fe', 'cod_com']:
        data[col] = data[col].astype('int64')
    return data


def _bounded(value, lo, hi, name):
    if isinstance(value, bool) or not isinstance(value, (float, int)) or not math.isfinite(value) or not lo <= value <= hi:
        raise ValueError(f'{name} must be finite and between {lo} and {hi}')


def _filter(data, subject, geography, exclude_communes):
    if subject not in ('both', 'reading', 'math') or geography not in ('all', 'exclude_greater_santiago', 'exclude_rm'):
        raise ValueError('Unknown subject or geography')
    codes = [] if exclude_communes is None else exclude_communes
    if not isinstance(codes, list) or len(codes) > 10 or any(type(c) is not int for c in codes):
        raise ValueError('exclude_communes must contain at most 10 integer commune codes')
    if len(set(codes)) != len(codes):
        raise ValueError('exclude_communes must not contain duplicate codes')
    unknown = sorted(set(codes) - set(data.cod_com))
    if unknown:
        raise ValueError(f'Unknown commune codes in bundled cohort data: {unknown}')
    mask = ~data.cod_com.isin(codes)
    if subject != 'both':
        mask &= data.subject.eq({'reading': 'lect', 'math': 'mate'}[subject])
    if geography == 'exclude_greater_santiago':
        mask &= ~data.cod_com.isin(list(range(13101, 13133)) + [13201, 13401])
    elif geography == 'exclude_rm':
        mask &= (data.cod_com // 1000).ne(13)
    return data.loc[mask].copy(), dict(subject=subject, geography=geography, exclude_communes=sorted(codes))


def _fit(data, model='pooled_linear', persistence=1.0, label=None):
    if model not in LABELS:
        raise ValueError('Unknown baseline adjustment')
    if model == 'fixed_persistence':
        _bounded(persistence, 0, 1.2, 'persistence')
    if data.empty or data.cod_com.nunique() < 2:
        raise ValueError('Requested sample has fewer than two communes; clustered inference is unavailable')
    # Source25 uses the baseline eligible sample. With complete pinned inputs,
    # removing singletons in the one absorbed dimension gives that same sample.
    x = data.loc[data.groupby('subj_cohort_fe').source_row_id.transform('size').gt(1)].copy()
    if x.empty or x.cod_com.nunique() < 2:
        raise ValueError('Insufficient sample after subject-by-cohort singleton removal')
    y, rhs, fe = 'score_2m', 'share_priv_2m + score_4b', 'subj_cohort_fe'
    if model == 'commune_fe':
        fe += ' + commune_fe'
    elif model == 'add_initial_share':
        rhs += ' + share_priv_4b'
    elif model in ('none', 'fixed_persistence'):
        rhs = 'share_priv_2m'
        if model == 'fixed_persistence':
            # Stata25 gen y_l stores a float, after double arithmetic.
            x['y_l'] = (x.score_2m - persistence * x.score_4b).astype('float32').astype('float64')
            y = 'y_l'
    elif model == 'cell_quadratic':
        g = x.groupby('subj_cohort_fe').score_4b
        std = g.transform('std')
        if std.isna().any() or std.le(0).any():
            raise ValueError('Cell quadratic requires nonzero baseline-score variation in every cell')
        z = (x.score_4b - g.transform('mean')) / std
        terms = []
        for cell in sorted(x.subj_cohort_fe.unique()):
            for power in (1, 2):
                term = f'z{power}_{cell}'
                x[term] = np.where(x.subj_cohort_fe.eq(cell), z ** power, 0.)
                terms.append(term)
        rhs = 'share_priv_2m + ' + ' + '.join(terms)
    formula = f'{y} ~ {rhs} | {fe}'
    fit = pf.feols(formula, data=x, weights='wt_2m', weights_type='aweights',
        vcov={'CRV1': 'cod_com'}, fixef_rm='singleton', ssc=pf.ssc(**SSC),
        demeaner=MapDemeaner(fixef_tol=1e-12, backend='rust'))
    if 'share_priv_2m' not in fit.coef().index:
        raise ValueError('Private-share coefficient is not identified in the requested sample')
    b, se, df = float(fit.coef()['share_priv_2m']), float(fit.se()['share_priv_2m']), float(fit._df_t)
    if not all(math.isfinite(v) for v in (b, se, df)) or se <= 0 or df <= 0:
        raise ValueError('Requested fit does not support finite clustered inference')
    ids = np.sort(fit._data.source_row_id.to_numpy(dtype='int64'))
    critical = float(t.ppf(.975, df))
    out = dict(label=label or LABELS[model], model=model, coefficient=b, se=se, df=df,
        ci95=[b-critical*se, b+critical*se], pvalue=float(2*t.sf(abs(b/se), df)),
        N=int(fit._N), clusters=int(fit._data.cod_com.nunique()), formula=formula,
        sample=dict(source_rows=len(data), source_rows_sha256=hashlib.sha256(ids.astype('<i8').tobytes()).hexdigest(),
            excluded_source_rows=np.setdiff1d(data.source_row_id, ids).tolist()),
        effect_10pp=dict(score_points=b/10, score_points_ci95=[(b-critical*se)/10, (b+critical*se)/10]),
        coefficient_units='Score points per unit private share (0 to 1); divide by 10 for a 10-percentage-point increase.')
    if model == 'fixed_persistence':
        out['imposed_persistence'] = persistence
    if 'score_4b' in fit.coef().index:
        out['estimated_baseline_persistence'] = float(fit.coef()['score_4b'])
    return out


def _finish(title, results, settings, warnings=None, **extra):
    run_id = str(uuid4())
    directory = Path(tempfile.gettempdir()) / 'chile-paper-agent' / run_id
    directory.mkdir(parents=True, exist_ok=False)
    artifact = directory / 'result.json'
    result = dict(title=title, message=title, reference=REFERENCE, results=results, settings=settings,
        settings_summary=f"Subject: {settings['subject']}; geography: {settings['geography']}; explicit exclusions: {settings['exclude_communes']}.",
        warnings=warnings or [], scope='Exploratory cohort analyses of the pinned data. Outcomes are commune average grade-10 scores across public and private schools. These adjusted associations do not establish causality.',
        run_id=run_id, timestamp=datetime.now(timezone.utc).isoformat(),
        artifacts=[dict(description='Complete calculation and provenance', path=str(artifact.resolve()))],
        provenance=dict(data_sha256=DATA_SHA256, sources=json.loads((DATA_DIR/'sandbox_source.json').read_text(encoding='utf8')),
            wrapper_sha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
            packages={p: importlib.metadata.version(p) for p in ['pyfixest','pandas','numpy','scipy','fastmcp']}),
        estimation_settings=dict(weights='wt_2m', weights_type='aweights', covariance={'CRV1':'cod_com'},
            fixef_rm='singleton', ssc=SSC, demeaner=dict(backend='rust', fixef_tol=1e-12)),
        sample_hash_definition='SHA256 of sorted one-based source row IDs encoded as little-endian int64; row IDs assigned before filters.', **extra)
    artifact.write_text(json.dumps(result, indent=2, allow_nan=False)+'\n', encoding='utf8')
    return result


@cohort_sandbox_mcp.tool()
def chile_cohort_scenario(
    subject: Annotated[Subject, Field(description='Use both subjects, reading, or math.')] = 'both',
    geography: Annotated[Geography, Field(description='Retain all communes or exclude Greater Santiago (34 communes) or the entire Metropolitan Region.')] = 'all',
    exclude_communes: Annotated[list[StrictInt] | None, Field(description='Up to 10 distinct commune codes present in the bundled cohort data.')] = None,
    baseline_adjustment: Annotated[Adjustment, Field(description='Source-supported baseline control or additional commune fixed effects.')] = 'pooled_linear',
    persistence: Annotated[StrictFloat, Field(description='Imposed baseline-score persistence, 0 to 1.2; used only with fixed_persistence.')] = 1.0,
) -> dict:
    """Compare a requested cohort specification and sample with the full-data baseline.
    Input is bounded sample and control choices; output is estimates, clustered intervals and a fresh calculation record.
    """
    _bounded(persistence, 0, 1.2, 'persistence')
    if baseline_adjustment not in ('pooled_linear','add_initial_share','none','fixed_persistence','commune_fe'):
        raise ValueError('Unknown baseline adjustment')
    data = _load()
    x, settings = _filter(data, subject, geography, exclude_communes)
    anchor = _fit(data, label='Full-data pooled baseline')
    rows = [anchor]
    changed = len(x) != len(data)
    if changed:
        rows.append(_fit(x, label='Requested sample, pooled baseline'))
    if baseline_adjustment != 'pooled_linear':
        rows.append(_fit(x, baseline_adjustment, persistence))
    settings.update(baseline_adjustment=baseline_adjustment, persistence=persistence if baseline_adjustment=='fixed_persistence' else None)
    return _finish('Cohort scenario comparison', rows, settings,
        ['The full-data anchor and requested sample can differ in composition; coefficient changes are descriptive.'])


@cohort_sandbox_mcp.tool()
def chile_cohort_initial_share(
    subject: Annotated[Subject, Field(description='Use both subjects, reading, or math.')] = 'both',
    geography: Annotated[Geography, Field(description='Retain all, exclude Greater Santiago, or exclude the Metropolitan Region.')] = 'all',
    exclude_communes: Annotated[list[StrictInt] | None, Field(description='Up to 10 distinct existing commune codes to exclude.')] = None,
    cutoff: Annotated[StrictFloat | None, Field(description='Private-share fraction from 0 to 1; omitted uses the full-data unweighted commune median.')] = None,
) -> dict:
    """Compare cohort associations in communes with lower and higher initial private share.
    Input is a cutoff and bounded sample choices; output is fixed group membership, estimates and a fresh calculation record.
    """
    if cutoff is not None:
        _bounded(cutoff, 0, 1, 'cutoff')
    data = _load()
    if data.groupby(['cod_com','cohort_yr']).share_priv_4b.nunique().max() != 1:
        raise ValueError('Source subjects disagree on commune initial private share')
    initial = data.sort_values(['cod_com','cohort_yr','source_row_id']).drop_duplicates('cod_com')[['cod_com','cohort_yr','share_priv_4b']].copy()
    threshold = float(initial.share_priv_4b.median()) if cutoff is None else cutoff
    low = set(initial.loc[initial.share_priv_4b.le(threshold), 'cod_com'])
    x, settings = _filter(data, subject, geography, exclude_communes)
    rows = [_fit(x, label='All eligible communes'),
            _fit(x.loc[x.cod_com.isin(low)], label='Lower initial private share'),
            _fit(x.loc[~x.cod_com.isin(low)], label='Higher initial private share')]
    eligible = set(x.cod_com)
    members = [dict(cod_com=int(r.cod_com), initial_cohort=int(r.cohort_yr), initial_share=float(r.share_priv_4b),
        group='low' if r.cod_com in low else 'high', eligible=r.cod_com in eligible) for r in initial.itertuples()]
    settings.update(cutoff=threshold, cutoff_definition='full-data unweighted commune median' if cutoff is None else 'user-specified fraction', low_rule='initial_share <= cutoff', high_rule='initial_share > cutoff')
    return _finish('Initial private-share comparison', rows, settings,
        ['Initial means each commune\'s earliest observed grade-4 cohort, not a common calendar year; earliest cohort years range from 2006 to 2018.',
         'Membership and the default median are fixed using the full bundled data before restrictions.',
         'Separate group estimates are descriptive; their significance does not test a difference between groups.'],
        commune_membership=members)


@cohort_sandbox_mcp.tool()
def chile_cohort_influence(
    subject: Annotated[Subject, Field(description='Use both subjects, reading, or math.')] = 'both',
    geography: Annotated[Geography, Field(description='Retain all, exclude Greater Santiago, or exclude the Metropolitan Region.')] = 'all',
    exclude_communes: Annotated[list[StrictInt] | None, Field(description='Up to 10 distinct existing commune codes excluded before influence analysis.')] = None,
    top_k: Annotated[StrictInt, Field(description='Jointly exclude the 0 to 10 most influential communes; 0 skips joint exclusion.')] = 3,
) -> dict:
    """Check every single-commune omission and optionally jointly omit the most influential communes.
    Input is a bounded sample and top-k choice; output is all omission fits, ranked changes and a fresh calculation record.
    """
    if type(top_k) is not int or not 0 <= top_k <= 10:
        raise ValueError('top_k must be an integer from 0 to 10')
    data = _load()
    x, settings = _filter(data, subject, geography, exclude_communes)
    baseline = _fit(x, label='Eligible-sample baseline')
    codes = sorted(map(int, x.cod_com.unique()))
    if len(codes)-max(1,top_k) < 2:
        raise ValueError('Too few communes remain for the requested influence analysis')
    fits = []
    for code in codes:
        row = _fit(x.loc[x.cod_com.ne(code)], label=f'Omit commune {code}')
        row.update(excluded_commune=code, coefficient_change=row['coefficient']-baseline['coefficient'])
        row['absolute_change'] = abs(row['coefficient_change'])
        fits.append(row)
    ranked = sorted(fits, key=lambda r: (-r['absolute_change'], str(r['excluded_commune'])))
    rows = [baseline] + ranked[:5]
    joint_codes = [r['excluded_commune'] for r in ranked[:top_k]]
    if top_k:
        joint = _fit(x.loc[~x.cod_com.isin(joint_codes)], label=f'Joint omission of top {top_k} influential communes')
        joint['excluded_communes'] = joint_codes
        rows.append(joint)
    settings.update(top_k=top_k, joint_excluded_communes=joint_codes)
    summary = dict(communes_checked=len(fits), coefficient_min=min(r['coefficient'] for r in fits),
        coefficient_max=max(r['coefficient'] for r in fits), maximum_absolute_change=ranked[0]['absolute_change'])
    return _finish('Commune influence analysis', rows, settings,
        ['Ranking and joint exclusions are selected using observed coefficient changes and are exploratory.',
         'Single-commune stability is not proof against all possible joint exclusions or against confounding.',
         'Commune identifiers are official codes; commune names are not in the bundled data.'],
        summary=summary, ranking=ranked[:10], leave_one_out=fits)


@cohort_sandbox_mcp.tool()
def chile_cohort_baseline_sensitivity(
    subject: Annotated[Subject, Field(description='Use both subjects, reading, or math.')] = 'both',
    geography: Annotated[Geography, Field(description='Retain all, exclude Greater Santiago, or exclude the Metropolitan Region.')] = 'all',
    exclude_communes: Annotated[list[StrictInt] | None, Field(description='Up to 10 distinct existing commune codes to exclude.')] = None,
    persistence_values: Annotated[list[StrictFloat] | None, Field(description='One to six distinct imposed persistences in [0,1.2]; omitted uses 0,0.5,0.8,1,1.2.')] = None,
) -> dict:
    """Compare source-supported baseline-achievement adjustments on a common eligible sample.
    Input is bounded sample and persistence choices; output is adjustment comparisons and a fresh calculation record.
    """
    values = [0., .5, .8, 1., 1.2] if persistence_values is None else persistence_values
    if not isinstance(values, list) or not 1 <= len(values) <= 6:
        raise ValueError('persistence_values must contain one to six values')
    for value in values:
        _bounded(value, 0, 1.2, 'persistence')
    if len(set(values)) != len(values):
        raise ValueError('persistence_values must be distinct')
    data = _load()
    x, settings = _filter(data, subject, geography, exclude_communes)
    rows = [_fit(x, model) for model in ['pooled_linear','add_initial_share','none','cell_quadratic']]
    rows += [_fit(x, 'fixed_persistence', value, f'Imposed persistence {value:g}') for value in values]
    settings.update(persistence_values=values, common_sample_rule='Baseline eligible rows; identical subject-by-cohort singleton removal before all adjustments.')
    return _finish('Baseline-achievement sensitivity', rows, settings,
        ['Imposed persistence is a fixed assumption, distinct from the estimated baseline-score coefficient.',
         'Cell quadratic uses unweighted within-cell sample standardization and separate linear and quadratic slopes in each subject-by-cohort cell.',
         'The fixed-persistence outcome preserves the Stata source\'s float storage; lambda=1 is a sensitivity result, not an added manuscript table column.'])
