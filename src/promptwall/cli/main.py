"""PromptWall Interactive CLI using Typer and Rich."""

import subprocess
from pathlib import Path

import typer
import uvicorn
from rich.console import Console
from rich.panel import Panel
from rich.prompt import Prompt
from rich.table import Table

from promptwall.api.proxy import create_proxy_app
from promptwall.cli.config import (
    get_api_key,
    get_base_url,
    get_config,
    get_default_upstream,
    get_proxy_host,
    get_proxy_port,
    save_config,
)
from promptwall.client import PromptWallClient
from promptwall.enforcer import Enforcer

app = typer.Typer(help="PromptWall - Runtime security middleware for AI agents")
console = Console()

PROMPTWALL_ART = """[bold cyan]
██████╗ ██████╗  ██████╗ ███╗   ███╗██████╗ ████████╗
██╔══██╗██╔══██╗██╔═══██╗████╗ ████║██╔══██╗╚══██╔══╝
██████╔╝██████╔╝██║   ██║██╔████╔██║██████╔╝   ██║   
██╔═══╝ ██╔══██╗██║   ██║██║╚██╔╝██║██╔═══╝    ██║   
██║     ██║  ██║╚██████╔╝██║ ╚═╝ ██║██║        ██║   
╚═╝     ╚═╝  ╚═╝ ╚═════╝ ╚═╝     ╚═╝╚═╝        ╚═╝   
                                                     
██╗    ██╗ █████╗ ██╗     ██╗                        
██║    ██║██╔══██╗██║     ██║                        
██║ █╗ ██║███████║██║     ██║                        
██║███╗██║██╔══██║██║     ██║                        
╚███╔███╔╝██║  ██║███████╗███████╗                   
 ╚══╝╚══╝ ╚═╝  ╚═╝╚══════╝╚══════╝                   
[/bold cyan]"""


@app.command()
def about() -> None:
    """Show information, credits, and a quick guide for PromptWall."""
    console.print(PROMPTWALL_ART, overflow="crop", no_wrap=True)

    info_text = (
        "[bold cyan]PromptWall[/bold cyan] is an advanced, enterprise-grade runtime security middleware\n"  # noqa: E501
        "designed specifically to shield AI agents and LLMs from sophisticated prompt injections,\n"
        "adversarial jailbreaks, and unauthorized data exfiltration. Deployed at the edge,\n"
        "it provides low-latency enforcement of active security policies.\n\n"
        "[bold magenta]Credits:[/bold magenta]\n"
        "Developed by [bold white]OTHMANE EL MQIDDEM[/bold white].\n\n"
        "[bold yellow]Quick Start Guide:[/bold yellow]\n"
        "1. [cyan]promptwall init[/cyan]   - Connect your edge node to the Dashboard via API Key.\n"
        "2. [cyan]promptwall status[/cyan] - View the currently active security policies enforced.\n"  # noqa: E501
        "3. [cyan]promptwall test[/cyan]   - Launch an interactive playground to test prompts.\n\n"
        "4. [cyan]promptwall serve[/cyan]  - Start the secure reverse proxy on localhost.\n"
        "5. [cyan]promptwall help[/cyan]   - Show the full help menu and available options.\n"
        "\n[dim]For comprehensive documentation and integration guides, visit the GitHub repository.[/dim]"  # noqa: E501
    )
    console.print(Panel(info_text, border_style="cyan", title="[bold]About PromptWall[/bold]"))


@app.command()
def help(ctx: typer.Context) -> None:
    """Show this help message and exit."""
    if ctx.parent:
        console.print(ctx.parent.get_help())


@app.command()
def init() -> None:
    """Configure your PromptWall CLI connection."""
    console.print(PROMPTWALL_ART, overflow="crop", no_wrap=True)
    console.print(
        Panel.fit(
            "[bold white]Runtime Security Middleware for AI Agents[/bold white]\n[dim]Let's connect your edge node to the Dashboard.[/dim]\n\n[bold magenta]Developed by OTHMANE EL MQIDDEM[/bold magenta]",
            border_style="cyan",
        )
    )  # noqa: E501

    current_url = get_base_url() or "http://localhost:3000"
    base_url = Prompt.ask("Dashboard Base URL", default=current_url)

    current_key = get_api_key() or ""
    api_key = Prompt.ask("API Key", password=True, default=current_key)

    current_host = get_proxy_host()
    proxy_host = Prompt.ask("Proxy Host", default=current_host)

    current_port = get_proxy_port()
    proxy_port_str = Prompt.ask("Proxy Port", default=str(current_port))
    proxy_port = int(proxy_port_str) if proxy_port_str.isdigit() else 8000

    current_upstream = get_default_upstream()
    default_upstream = Prompt.ask("Default Upstream URL", default=current_upstream)

    config = get_config()
    config["base_url"] = base_url
    config["api_key"] = api_key
    config["proxy_host"] = proxy_host
    config["proxy_port"] = proxy_port
    config["default_upstream"] = default_upstream
    save_config(config)

    console.print("[bold green]✔[/bold green] Configuration saved successfully!")


@app.command()
def status(
    environment: str = typer.Option(
        "production", "--environment", "-e", help="Environment to check"
    ),
) -> None:  # noqa: E501
    """Check connection and view active policies."""
    api_key = get_api_key()
    base_url = get_base_url()

    if not api_key or not base_url:
        console.print(
            "[bold red]Not configured![/bold red] Run [cyan]promptwall init[/cyan] first."
        )  # noqa: E501
        raise typer.Exit(1)

    client = PromptWallClient(api_key=api_key, base_url=base_url)

    with console.status(f"Fetching active policies for [bold]{environment}[/bold]..."):
        try:
            policy_data = client.fetch_active_policy(environment=environment)
        except Exception as e:
            console.print(f"[bold red]Failed to connect:[/bold red] {e}")
            raise typer.Exit(1) from e

    rules = policy_data.get("rules", [])

    table = Table(title=f"Active Policies ({environment})")
    table.add_column("Rule Name", style="cyan")
    table.add_column("Plane", style="magenta")
    table.add_column("Action", style="green")

    if not rules:
        console.print("[yellow]No active rules found.[/yellow]")
        return

    for rule in rules:
        action_style = (
            "red"
            if rule.get("action") == "block"
            else "yellow"
            if rule.get("action") in ("redact", "sanitize")
            else "green"
        )  # noqa: E501
        table.add_row(
            rule.get("name", "Unnamed"),
            rule.get("plane", "output"),
            f"[{action_style}]{rule.get('action')}[/{action_style}]",
        )

    console.print(table)
    console.print("[bold green]✔[/bold green] Connected to Dashboard successfully.")


@app.command()
def test(
    environment: str = typer.Option(
        "production", "--environment", "-e", help="Environment to test against"
    ),
) -> None:  # noqa: E501
    """Interactive playground to test prompts against your policies."""
    api_key = get_api_key()
    base_url = get_base_url()

    if not api_key or not base_url:
        console.print(
            "[bold red]Not configured![/bold red] Run [cyan]promptwall init[/cyan] first."
        )  # noqa: E501
        raise typer.Exit(1)

    client = PromptWallClient(api_key=api_key, base_url=base_url)

    with console.status(f"Loading Enforcer rules for [bold]{environment}[/bold]..."):
        try:
            enforcer = Enforcer.from_api(client, environment=environment)
        except Exception as e:
            console.print(f"[bold red]Failed to load enforcer:[/bold red] {e}")
            raise typer.Exit(1) from e

    console.print(
        Panel.fit(
            f"[bold blue]PromptWall Interactive Tester[/bold blue]\nEnvironment: [cyan]{environment}[/cyan]\nType your prompt below or 'exit' to quit.",
            border_style="blue",
        )
    )  # noqa: E501

    while True:
        try:
            prompt_text = Prompt.ask("\n[bold magenta]Prompt[/bold magenta]")
            if prompt_text.lower() in ("exit", "quit"):
                break

            # Mock a tool call output
            decision = enforcer.enforce(tool_call={"name": "test_input"}, content=prompt_text)

            if decision.action == "allow":
                console.print(
                    Panel(
                        f"[bold green]ALLOWED[/bold green]\n{prompt_text}",
                        border_style="green",
                        title="Result",
                    )
                )  # noqa: E501
            elif decision.action in ("block", "require_approval"):
                console.print(
                    Panel(
                        f"[bold red]{decision.action.upper()}[/bold red]\nReason: {decision.reason}",
                        border_style="red",
                        title="Result",
                    )
                )  # noqa: E501
            else:
                # sanitize or redact
                console.print(
                    Panel(
                        f"[bold yellow]{decision.action.upper()}[/bold yellow]\nReason: {decision.reason}\n\n[bold]Sanitized Content:[/bold]\n{decision.sanitized_content}",
                        border_style="yellow",
                        title="Result",
                    )
                )  # noqa: E501

        except (KeyboardInterrupt, EOFError):
            console.print("\n[bold]Exiting...[/bold]")
            break


@app.command()
def serve(
    host: str = typer.Option(None, help="Host IP to bind to (overrides config)"),
    port: int = typer.Option(None, help="Port to bind to (overrides config)"),
    target: str = typer.Option(
        None, help="Default dynamic upstream provider URL (overrides config)"
    ),  # noqa: E501
) -> None:
    """Start the PromptWall reverse proxy server."""
    api_key = get_api_key()
    base_url = get_base_url()

    if not api_key or not base_url:
        console.print(
            "[bold red]Not configured![/bold red] Run [cyan]promptwall init[/cyan] first."
        )  # noqa: E501
        raise typer.Exit(1)

    actual_host = host if host is not None else get_proxy_host()
    actual_port = port if port is not None else get_proxy_port()
    actual_target = target if target is not None else get_default_upstream()

    console.print(PROMPTWALL_ART, overflow="crop", no_wrap=True)
    console.print(
        Panel.fit(
            f"[bold green]PromptWall Proxy Running![/bold green]\n\n"
            f"Listening on: [bold cyan]http://{actual_host}:{actual_port}[/bold cyan]\n"
            f"Default Upstream: [cyan]{actual_target}[/cyan]\n\n"
            f"[yellow]To use this proxy, change your OpenAI Base URL in your AI application to:[/yellow]\n"  # noqa: E501
            f"[bold white]http://{actual_host}:{actual_port}/v1[/bold white]",
            border_style="green",
        )
    )

    app_instance = create_proxy_app(default_upstream=actual_target)

    uvicorn.run(app_instance, host=actual_host, port=actual_port, log_level="info")


dashboard_app = typer.Typer(help="Manage the PromptWall dashboard")
app.add_typer(dashboard_app, name="dashboard")


@dashboard_app.command("start")
def dashboard_start() -> None:
    """Start the Next.js local dashboard orchestrator."""
    console.print(PROMPTWALL_ART, overflow="crop", no_wrap=True)
    console.print(
        Panel.fit(
            "[bold green]Starting PromptWall Dashboard...[/bold green]\n\n"
            "[dim]Initializing infrastructure and Next.js...[/dim]",
            border_style="green",
        )
    )

    # Resolve dashboard path (assuming running from source tree for now)
    package_dir = Path(__file__).resolve().parent.parent.parent.parent
    dashboard_dir = package_dir / "dashboard"
    docker_compose_file = package_dir / "docker-compose.yml"

    if not dashboard_dir.exists():
        console.print(
            "[bold red]Error:[/bold red] Could not find the dashboard directory. "
            "Are you running from the source repository?"
        )
        raise typer.Exit(1)

    if docker_compose_file.exists():
        console.print("[cyan]Spinning up Postgres and Redis via Docker...[/cyan]")
        try:
            subprocess.run(["docker", "compose", "up", "-d"], cwd=package_dir, check=True)
        except Exception as e:
            console.print(f"[bold red]Failed to start docker containers: {e}[/bold red]")
            console.print("[yellow]Continuing anyway...[/yellow]")

    console.print("[cyan]Starting Next.js Development Server...[/cyan]")
    try:
        process = subprocess.Popen(["npm", "run", "dev"], cwd=dashboard_dir)
        process.wait()
    except KeyboardInterrupt:
        console.print("\n[bold]Shutting down dashboard...[/bold]")
        process.terminate()
    except Exception as e:
        console.print(f"[bold red]Failed to start Next.js server: {e}[/bold red]")
        raise typer.Exit(1) from e


def app_entry() -> None:
    app()
