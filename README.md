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

- **ML Input Firewall** — runs a local DeBERTa v3 model on CPU (via ONNX) alongside regex scanning to detect prompt injection attempts before they reach the LLM.
- **Native DLP** — utilizes Microsoft Presidio to automatically detect and redact PII locally before any prompt leaves your network.
- **Policy Engine** — checks every outbound tool call against YAML-defined rules (allowed domains, allowed paths, forbidden output patterns) before it executes.
- **Agentic Tracing** — automatically groups logs into conversation threads by natively extracting Session IDs from OpenAI/Anthropic SDK payloads and headers.
- **Audit Ledger** — append-only, SHA-256 hash-chained log of every decision. Tampering with any past entry breaks the chain and is detectable.

Full architecture rationale: see [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Quickstart

PromptWall offers a dual-packaging strategy for both individual developers and enterprise teams.

### 1. Enterprise Deployment (Docker Compose)
For teams that need the Next.js Control Plane Dashboard and PostgreSQL database.

```bash
git clone https://github.com/oeisthename/promptwall.git
cd promptwall
docker compose up -d
```
This spins up the Dashboard (`http://localhost:3000`), the Postgres DB, and the Python Proxy (`http://localhost:8000`).

### 2. Local Developer CLI (PyPI)
For developers who just want the edge-proxy locally using SQLite.

```bash
pip install promptwall
# Or using uv:
uv tool install promptwall

# Run the interactive configuration
promptwall start

# Start the reverse proxy
promptwall serve
```

### Routing your AI App through the Proxy

Configure your OpenAI, LangChain, or Anthropic SDKs to point to the local proxy:

```python
from openai import OpenAI

# The proxy transparently forwards the request after evaluating policies!
client = OpenAI(
    base_url="http://localhost:8000/v1",
    api_key="your-openai-api-key"
)
```

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
