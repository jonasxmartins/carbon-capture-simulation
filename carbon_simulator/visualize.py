import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec
import pandas as pd

def plot_value_chain(timeseries: pd.DataFrame, results: dict):
    fig = plt.figure(figsize=(14, 9))
    fig.suptitle(
        'Carbon Capture Value Chain — dMRV Simulator',
        fontsize=14, fontweight='bold', y=0.98
    )

    gs = gridspec.GridSpec(3, 2, figure=fig, hspace=0.45, wspace=0.35)

    # ── Gross CO₂ captured ───────────────────────────────────────────────────
    ax1 = fig.add_subplot(gs[0, :])
    ax1.plot(timeseries.index, timeseries['gross_co2_kg_per_min'],
             color='steelblue', linewidth=1.2, label='Gross CO₂ (Node 1)')
    ax1.fill_between(timeseries.index, timeseries['gross_co2_kg_per_min'],
                     alpha=0.15, color='steelblue')
    ax1.set_ylabel('kg / min')
    ax1.set_title('Node 1 — Gross CO₂ Captured')
    ax1.legend(fontsize=8)
    ax1.grid(alpha=0.3)

    # ── Leakage ──────────────────────────────────────────────────────────────
    ax2 = fig.add_subplot(gs[1, 0])
    ax2.plot(timeseries.index, timeseries['leakage_kg_per_min'],
             color='tomato', linewidth=1.2)
    ax2.fill_between(timeseries.index, timeseries['leakage_kg_per_min'],
                     alpha=0.15, color='tomato')
    ax2.set_ylabel('kg / min')
    ax2.set_title('Node 2 — Transport Leakage')
    ax2.grid(alpha=0.3)

    # ── Net CO₂ ──────────────────────────────────────────────────────────────
    ax3 = fig.add_subplot(gs[1, 1])
    ax3.plot(timeseries.index, timeseries['net_co2_kg_per_min'],
             color='seagreen', linewidth=1.2)
    ax3.fill_between(timeseries.index, timeseries['net_co2_kg_per_min'],
                     alpha=0.15, color='seagreen')
    ax3.set_ylabel('kg / min')
    ax3.set_title('Net CO₂ — Eligible for Credits')
    ax3.grid(alpha=0.3)

    # ── Cumulative ledger ─────────────────────────────────────────────────────
    ax4 = fig.add_subplot(gs[2, :])
    cumulative_gross = timeseries['gross_co2_kg_per_min'].cumsum() / 1000
    cumulative_net   = timeseries['net_co2_kg_per_min'].cumsum() / 1000

    ax4.plot(timeseries.index, cumulative_gross,
             color='steelblue', linewidth=1.5, label='Gross (tonnes)', linestyle='--')
    ax4.plot(timeseries.index, cumulative_net,
             color='seagreen', linewidth=2.0, label='Net verified (tonnes)')
    ax4.fill_between(timeseries.index, cumulative_gross, cumulative_net,
                     alpha=0.2, color='tomato', label='Losses')
    ax4.set_ylabel('Cumulative CO₂ (tonnes)')
    ax4.set_title('Cumulative Carbon Ledger')
    ax4.legend(fontsize=9)
    ax4.grid(alpha=0.3)

    plt.savefig('carbon_value_chain.png', dpi=150, bbox_inches='tight')
    plt.show()
    print("Chart saved to carbon_value_chain.png")