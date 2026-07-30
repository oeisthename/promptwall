"""Traffic replay and regression testing command."""

import sqlite3
from typing import Annotated

import httpx
import typer
from rich.console import Console
from rich.progress import Progress
from rich.table import Table

from promptwall.audit import DB_PATH
from promptwall.cli.config import get_proxy_port

replay_app = typer.Typer(help="Replay traffic from audit logs against current policies")
console = Console()


@replay_app.callback(invoke_without_command=True)
def main(
    limit: Annotated[
        int,
        typer.Option("--limit", "-n", help="Number of past requests to replay"),
    ] = 10,
) -> None:
    """Replay past allowed requests against the current proxy to test new models or policies."""
    
    if not DB_PATH.exists():
        console.print("[red]Audit database not found. Run proxy and send requests first.[/red]")
        raise typer.Exit(1)

    prompts = []
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.cursor()
        # Fetch original prompts that were previously allowed
        cursor.execute(
            """
            SELECT original_prompt FROM audit_logs 
            WHERE original_prompt IS NOT NULL AND original_prompt != ''
            ORDER BY timestamp DESC LIMIT ?
            """,
            (limit,)
        )
        rows = cursor.fetchall()
        for row in rows:
            prompts.append(row[0])
            
    if not prompts:
        console.print("[yellow]No suitable traffic found in audit log to replay.[/yellow]")
        raise typer.Exit(0)
        
    console.print(f"Replaying [bold]{len(prompts)}[/bold] recent requests against proxy...")
    
    proxy_url = f"http://127.0.0.1:{get_proxy_port()}/v1/chat/completions"
    
    results = {"pass": 0, "block": 0, "error": 0}
    
    with Progress() as progress:
        task = progress.add_task("[cyan]Replaying...", total=len(prompts))
        
        with httpx.Client(timeout=10.0) as client:
            for prompt in prompts:
                payload = {
                    "model": "gpt-3.5-turbo",
                    "messages": [{"role": "user", "content": prompt}],
                    "stream": False
                }
                
                try:
                    res = client.post(proxy_url, json=payload)
                    if res.status_code == 200:
                        results["pass"] += 1
                    elif res.status_code == 403 or res.status_code == 429:
                        results["block"] += 1
                    else:
                        # E.g. 502 bad gateway from upstream, but proxy didn't block it
                        results["pass"] += 1
                except httpx.RequestError:
                    results["error"] += 1
                
                progress.advance(task)
                
    console.print()
    table = Table(title="Replay Results")
    table.add_column("Result", justify="left")
    table.add_column("Count", justify="right")
    
    table.add_row("[green]Passed (Allowed)[/green]", str(results["pass"]))
    table.add_row("[red]Blocked (Firewall/Budget)[/red]", str(results["block"]))
    table.add_row("[yellow]Connection Error[/yellow]", str(results["error"]))
    
    console.print(table)
    if results["error"] > 0:
        console.print("[dim]Note: Ensure 'promptwall serve' is running in another terminal.[/dim]")
