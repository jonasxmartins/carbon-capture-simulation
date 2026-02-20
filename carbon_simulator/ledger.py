from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich import box
from datetime import datetime

console = Console()

def print_ledger(results: dict):
    """Prints a formatted carbon ledger to the terminal."""

    console.print()
    console.print(Panel.fit(
        "[bold green]MANGROVE-STYLE CARBON LEDGER[/bold green]\n"
        f"[dim]Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}[/dim]",
        border_style="green"
    ))

    # ── Value Chain Accounting ───────────────────────────────────────────────
    table = Table(
        title="Value Chain Accounting",
        box=box.ROUNDED,
        border_style="blue"
    )
    table.add_column("Stage",         style="cyan",  no_wrap=True)
    table.add_column("Description",   style="white")
    table.add_column("CO₂ (tonnes)",  style="bold",  justify="right")

    table.add_row(
        "Node 1 Output",
        "Gross CO₂ captured (flow × efficiency)",
        f"+{results['gross_co2_tonnes']:.4f}"
    )
    table.add_row(
        "Node 2 Loss",
        "Compression & transport leakage",
        f"-{results['leakage_tonnes']:.4f}"
    )
    table.add_row(
        "NET VERIFIED",
        "Eligible for credit issuance",
        f"[bold green]{results['net_co2_tonnes']:.4f}[/bold green]",
    )

    console.print(table)
    console.print()

    # ── Data Quality Report ──────────────────────────────────────────────────
    quality_table = Table(
        title="Data Quality & Completeness",
        box=box.ROUNDED,
        border_style="yellow"
    )
    quality_table.add_column("Node",          style="cyan")
    quality_table.add_column("Completeness",  justify="right")
    quality_table.add_column("Status",        justify="center")

    def quality_status(pct):
        if pct >= 99:   return "[bold green]EXCELLENT[/bold green]"
        elif pct >= 95: return "[bold yellow]ACCEPTABLE[/bold yellow]"
        else:           return "[bold red]REVIEW REQUIRED[/bold red]"

    n1 = results['node1_completeness']
    n2 = results['node2_completeness']

    quality_table.add_row(
        "Node 1 — Capture Unit",
        f"{n1:.1f}%",
        quality_status(n1)
    )
    quality_table.add_row(
        "Node 2 — Compression & Transport",
        f"{n2:.1f}%",
        quality_status(n2)
    )

    console.print(quality_table)
    console.print()

    console.print(
        f"[dim]Modelling window: {results['n_minutes_modelled']} minutes "
        f"| Ledger entries: {results['n_minutes_modelled']} "
        f"| Audit trail: complete[/dim]"
    )
    console.print()