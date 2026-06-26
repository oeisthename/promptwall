# PromptWall

**Open source runtime security middleware for AI agents.**

PromptWall sits between your AI agents and the tools they use. It inspects everything
an agent reads for hidden prompt injection attempts, enforces policy on every action
an agent tries to take before it executes, and writes every decision to a
tamper-evident, hash-chained audit log.

> Status: early development (pre-alpha). Architecture and APIs will change.

---

## Why

AI agents now take real actions with real credentials — writing files, calling APIs,
moving data — but no equivalent of a runtime access-control layer exists for them.
Prompt injection (malicious instructions hidden in content an agent reads) is the
most pressing unsolved vulnerability class in agentic AI, and there is currently no
open source tool that enforces policy on agent behavior at runtime. PromptWall is
built to close that gap.

## How it works

```
AI Agent (LangChain / CrewAI / raw MCP client)
        │  all tool calls pass through
        ▼
┌─────────────────────────────────────────────┐
│              PROMPTWALL CORE                │
│  ┌───────────┐  ┌──────────┐  ┌───────────┐ │
│  │  Input    │─▶│  Policy  │─▶│  Audit    │ │
│  │  Firewall │  │  Engine  │  │  Ledger   │ │
│  └───────────┘  └──────────┘  └───────────┘ │
└─────────────────────────────────────────────┘
        │ enforced / blocked
        ▼
MCP Servers / External Tools

         Dashboard (Next.js) — live alerts,
         policy editor, audit log viewer
```

- **Input Firewall** — scans external content (tool outputs, fetched pages) for
  prompt injection before it reaches the model.
- **Policy Engine** — checks every outbound tool call against YAML-defined rules
  (allowed domains, allowed paths, forbidden output patterns) before it executes.
- **Audit Ledger** — append-only, SHA-256 hash-chained log of every decision. Tampering
  with any past entry breaks the chain and is detectable.

Full architecture rationale: see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Quickstart

```bash
git clone https://github.com/oeisthename/promptwall.git
cd promptwall
docker compose up
```

This starts the API server, the audit database, and the dashboard at
`http://localhost:3000`.

### Installing the middleware in your own agent

```bash
uv add promptwall
```

```python
from promptwall import PromptWall

guard = PromptWall(policy_file="policies/example-agent.yaml")

# Wrap your existing tool-calling logic
result = guard.enforce(tool_call)
```

See [`examples/`](examples) for full LangChain and CrewAI integration examples.

## Writing a policy

Policies are plain YAML, meant to be reviewed and version-controlled like code:

```yaml
agent: research-agent
rules:
  - name: no-outbound-to-unknown-hosts
    plane: output
    match: tool_call.url not in allowlist
    action: block
    severity: critical
  - name: no-secret-shaped-strings
    plane: output
    match: output contains pattern:SECRET_PATTERN
    action: redact
    severity: high
```

See [`policies/example-agent.yaml`](policies/example-agent.yaml) for a complete example
and [`docs/POLICY_REFERENCE.md`](docs/POLICY_REFERENCE.md) for the full rule syntax.

## Project structure

```
promptwall/
├── src/promptwall/        # Core Python package
│   ├── firewall/          # Input scanning (injection detection)
│   ├── policy/            # YAML policy loading + enforcement
│   ├── ledger/             # Hash-chained audit log
│   ├── api/               # FastAPI server (REST + WebSocket)
│   └── observability/     # OpenTelemetry + structlog setup
├── dashboard/              # Next.js web dashboard
├── policies/                # Example policy files
├── examples/                # LangChain, CrewAI, raw MCP integration examples
├── tests/                  # unit / integration / property-based tests
├── docs/                   # Architecture, policy reference, threat model
└── docker-compose.yml
```

## Development

```bash
uv sync --extra dev
uv run pytest
uv run ruff check .
uv run mypy src/
```

See [`CONTRIBUTING.md`](CONTRIBUTING.md) for the full contribution workflow.

## Tech stack

Python 3.12 · Anthropic MCP SDK · Pydantic v2 · FastAPI · SQLite/PostgreSQL ·
OpenTelemetry · Next.js 16 · React 19 · TypeScript · Tailwind v4 · shadcn/ui

## Security

Found a way to bypass the firewall or policy engine? Please **do not** open a public
issue. See [`SECURITY.md`](SECURITY.md) for responsible disclosure instructions.

## License

[MIT](LICENSE)
