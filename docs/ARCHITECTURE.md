# Architecture

This document describes PromptWall's internal architecture. For the full project
rationale, market context, and legal considerations, see the project reference
document maintained outside this repository (linked from the project's GitHub
description / wiki).

## Overview

PromptWall is a security proxy positioned between an AI agent and the tools it
calls. Three enforcement planes process every interaction:

```
AI Agent
   │
   ▼
┌─────────────────────────────────────────────┐
│ 1. Input Firewall   — scans inbound content  │
│ 2. Policy Engine    — enforces outbound rules│
│ 3. Audit Ledger     — records every decision │
└─────────────────────────────────────────────┘
   │
   ▼
MCP Servers / External Tools
```

## 1. Input Firewall (`src/promptwall/firewall/`)

Responsible for inspecting content the agent is about to read — tool outputs,
fetched web pages, documents — before that content reaches the model's context.

- **Rule-based scanner**: pattern matching for known injection signatures
  (instruction-like phrasing in unexpected places, encoding tricks, hidden text).
- **Semantic classifier**: a lightweight classification step evaluating whether
  content looks like it's attempting to issue instructions rather than provide
  data, to catch novel attacks that don't match a known pattern.

Output: each scan produces a `ScanResult` (see `firewall/models.py`) with a verdict
(`allow`, `block`, `sanitize`) and a list of matched signals for the audit ledger.

## 2. Policy Engine (`src/promptwall/policy/`)

Loads YAML policy files, validates them against a JSON Schema, and evaluates every
outbound tool call against the active rule set for that agent.

- Policies are loaded once at startup and can be hot-reloaded (planned).
- Each rule has a `plane` (currently always `output`), a `match` expression, an
  `action` (`allow`, `block`, `redact`, `require_approval`), and a `severity`.
- See [`POLICY_REFERENCE.md`](POLICY_REFERENCE.md) for the full rule syntax.

## 3. Audit Ledger (`src/promptwall/ledger/`)

Append-only storage for every decision PromptWall makes.

- Each entry stores: timestamp, agent ID, event type, full event payload, the
  matched rule (if any), the decision, and `entry_hash`.
- `entry_hash = SHA256(entry_data + previous_entry_hash)` — a hash chain. Modifying
  or deleting a past entry breaks every subsequent hash, making tampering
  detectable.
- Backed by SQLAlchemy; SQLite for local development, PostgreSQL for production
  (see `ledger/backends.py`).

## API layer (`src/promptwall/api/`)

A FastAPI application exposing:
- `GET /events` — paginated, filterable audit log query
- `GET /policies` — current policy state per agent
- `PUT /policies/{agent}` — update a policy (validates before applying)
- `WS /events/stream` — live event feed consumed by the dashboard

## Observability (`src/promptwall/observability/`)

OpenTelemetry instrumentation for tracing and metrics, `structlog` for structured
JSON logging. Every component emits spans so latency added by PromptWall itself
can be measured and exported to any OTel-compatible backend.

## Dashboard (`dashboard/`)

A Next.js application providing:
- A live event feed (WebSocket-driven)
- A policy editor (writes YAML, validates against the same schema as the backend)
- An audit log viewer with search and filtering
- Charts of policy violations and risk trends over time (Recharts)

## Data flow for a single tool call

1. Agent decides to call a tool.
2. Call is routed through PromptWall's middleware (`PromptWall.enforce(...)`).
3. If the call involves reading external content, the Input Firewall scans it.
4. The Policy Engine evaluates the action against the active policy.
5. The action is allowed, blocked, or routed to manual approval.
6. The full event is written to the Audit Ledger, hash-chained to the previous entry.
7. If allowed, the action executes; if blocked, the agent receives a structured
   rejection and the dashboard receives a real-time alert via WebSocket.
