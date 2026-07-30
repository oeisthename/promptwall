"""Budget tracking and enforcement commands."""

import sqlite3
from typing import Annotated

import typer
from rich.console import Console
from rich.panel import Panel
from rich.table import Table

from promptwall.audit import DB_PATH
from promptwall.cli.config import get_config, get_daily_budget, save_config

budget_app = typer.Typer(help="Manage and track API cost budgets")
console = Console()


@budget_app.callback(invoke_without_command=True)
def main(
    ctx: typer.Context,
    set_limit: Annotated[
        float | None,
        typer.Option("--set-limit", help="Set the daily budget limit in USD"),
    ] = None,
    remove_limit: Annotated[
        bool,
        typer.Option("--remove-limit", help="Remove the daily budget limit (set to unlimited)"),
    ] = False,
) -> None:
    """View current token usage and estimated cost budget."""
    if remove_limit:
        config = get_config()
        if "daily_budget" in config:
            del config["daily_budget"]
            save_config(config)
        console.print("[green]✔[/green] Daily budget limit removed (now [bold cyan]Unlimited[/bold cyan])")
        if ctx.invoked_subcommand is None:
            return

    if set_limit is not None:
        config = get_config()
        config["daily_budget"] = set_limit
        save_config(config)
        console.print(f"[green]✔[/green] Daily budget limit set to [bold]${set_limit:0.2f}[/bold]")
        if ctx.invoked_subcommand is None:
            return

    if ctx.invoked_subcommand is not None:
        return

    # Calculate budget usage from audit.db
    today_cost = 0.0
    today_tokens = 0
    all_time_cost = 0.0
    all_time_tokens = 0
    
    if DB_PATH.exists():
        from datetime import UTC, datetime
        today = datetime.now(UTC).strftime("%Y-%m-%d")
        
        with sqlite3.connect(DB_PATH) as conn:
            cursor = conn.cursor()
            
            # Today
            try:
                cursor.execute(
                    "SELECT SUM(cost), SUM(tokens) FROM audit_logs WHERE timestamp LIKE ?",
                    (f"{today}%",)
                )
                row = cursor.fetchone()
                if row:
                    today_cost = float(row[0] or 0.0)
                    today_tokens = int(row[1] or 0)
                
                # All time
                cursor.execute("SELECT SUM(cost), SUM(tokens) FROM audit_logs")
                row_all = cursor.fetchone()
                if row_all:
                    all_time_cost = float(row_all[0] or 0.0)
                    all_time_tokens = int(row_all[1] or 0)
            except sqlite3.OperationalError:
                # Columns might not exist yet if proxy hasn't run the migration
                pass

    limit = get_daily_budget()
    
    table = Table(show_header=False, box=None, padding=(0, 2))
    table.add_row("[dim]Daily Limit:[/dim]", f"[bold cyan]${limit:0.2f}[/bold cyan]" if limit else "[dim]Unlimited[/dim]")
    table.add_row("[dim]Today's Spend:[/dim]", f"[bold {'red' if limit and today_cost >= limit else 'green'}]${today_cost:0.4f}[/]")
    table.add_row("[dim]Today's Tokens:[/dim]", f"[yellow]{today_tokens:,}[/yellow]")
    table.add_row("", "")
    table.add_row("[dim]All-Time Spend:[/dim]", f"${all_time_cost:0.4f}")
    table.add_row("[dim]All-Time Tokens:[/dim]", f"{all_time_tokens:,}")

    panel = Panel(
        table,
        title="[bold]PromptWall Cost Budgeting[/bold]",
        subtitle="[dim italic]* Tokens & Cost may be estimated if upstream usage data is unavailable.[/dim italic]",
        border_style="blue",
        expand=False,
    )
    
    console.print()
    console.print(panel)
    console.print()
