import pandas as pd
import numpy as np


def process_node(
    raw_df: pd.DataFrame,
    tags: list[str],
    resample_interval: str = '1min'
) -> pd.DataFrame:
    """
    Takes raw long-format SCADA data for a set of tags,
    filters bad readings, pivots to wide format,
    and resamples to the given interval.
    """
    node_df = raw_df[raw_df['tag'].isin(tags)].copy()

    # track data quality before filtering
    total = len(node_df)
    bad = len(node_df[node_df['quality'] == 'BAD'])

    # filter bad readings
    clean = node_df[node_df['quality'] == 'GOOD']

    # pivot to wide format
    wide = clean.pivot_table(
        index='timestamp',
        columns='tag',
        values='value',
        aggfunc='mean'
    )

    # resample to interval
    resampled = wide.resample(resample_interval).mean()

    return resampled, total, bad


def run_value_chain(raw_df: pd.DataFrame) -> dict:
    """
    Runs the two-node carbon value chain model.

    Node 1 — Capture Unit:
        gross_co2 = flow_rate * efficiency

    Node 2 — Compression & Transport:
        net_co2 = gross_co2 - leakage

    Returns a ledger dict with full accounting.
    """

    # ── Node 1: Capture Unit ─────────────────────────────────────────────────
    node1_tags = ['CAPTURE_CO2_FLOW', 'CAPTURE_EFFICIENCY_PCT', 'CAPTURE_TEMP']
    node1, n1_total, n1_bad = process_node(raw_df, node1_tags)

    # gross CO₂ captured per minute
    # flow is in kg/hr → divide by 60 for kg/min
    # efficiency is in % → divide by 100
    node1['gross_co2_kg_per_min'] = (
        (node1['CAPTURE_CO2_FLOW'] / 60) *
        (node1['CAPTURE_EFFICIENCY_PCT'] / 100)
    )

    # ── Node 2: Compression & Transport ─────────────────────────────────────
    node2_tags = ['COMPRESS_PRESSURE', 'COMPRESS_LEAKAGE_RATE']
    node2, n2_total, n2_bad = process_node(raw_df, node2_tags)

    # leakage in kg/hr → kg/min
    node2['leakage_kg_per_min'] = node2['COMPRESS_LEAKAGE_RATE'] / 60

    # ── Combine nodes ────────────────────────────────────────────────────────
    combined = pd.concat([
        node1[['gross_co2_kg_per_min']],
        node2[['leakage_kg_per_min']]
    ], axis=1).dropna()

    combined['net_co2_kg_per_min'] = (
        combined['gross_co2_kg_per_min'] - combined['leakage_kg_per_min']
    )

    # ── Totals ───────────────────────────────────────────────────────────────
    gross_kg  = combined['gross_co2_kg_per_min'].sum()
    leakage_kg = combined['leakage_kg_per_min'].sum()
    net_kg    = combined['net_co2_kg_per_min'].sum()

    return {
        'timeseries': combined,
        'gross_co2_tonnes':   gross_kg / 1000,
        'leakage_tonnes':     leakage_kg / 1000,
        'net_co2_tonnes':     net_kg / 1000,
        'node1_completeness': ((n1_total - n1_bad) / n1_total) * 100,
        'node2_completeness': ((n2_total - n2_bad) / n2_total) * 100,
        'n_minutes_modelled': len(combined),
    }