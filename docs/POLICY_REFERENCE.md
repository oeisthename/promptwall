# Policy Reference

PromptWall policies are written in YAML and validated against a JSON Schema at load
time. A policy file defines the rules for a single agent.

## Minimal example

```yaml
agent: research-agent
rules:
  - name: no-outbound-to-unknown-hosts
    plane: output
    match: tool_call.url not in allowlist
    action: block
    severity: critical
```

## Top-level fields

| Field   | Type   | Required | Description                                  |
|---------|--------|----------|-----------------------------------------------|
| `agent` | string | yes      | Identifier for the agent this policy applies to |
| `rules` | list   | yes      | One or more rule objects (see below)          |

## Rule fields

| Field      | Type   | Required | Description |
|------------|--------|----------|-------------|
| `name`     | string | yes | Unique, human-readable rule identifier |
| `plane`    | string | yes | Currently always `output` (input-plane rules are configured separately — see below) |
| `match`    | string | yes | A match expression evaluated against the tool call |
| `action`   | string | yes | One of `allow`, `block`, `redact`, `require_approval` |
| `severity` | string | yes | One of `low`, `medium`, `high`, `critical` — used for dashboard sorting and alerting, does not affect enforcement |

## Match expressions

Match expressions reference fields on the tool call being evaluated:

| Field                 | Meaning                                  |
|-----------------------|-------------------------------------------|
| `tool_call.url`       | Destination URL of an HTTP-based tool call |
| `tool_call.path`      | File path for a filesystem tool call       |
| `tool_call.name`      | Name of the tool being called              |
| `output`              | The content the agent is about to emit/write |

Supported operators: `in`, `not in`, `contains`, `not contains`, `startswith`,
`==`, `!=`.

`allowlist` and `pattern:NAME` reference named lists/patterns defined in a separate
`definitions` block (see below).

## Definitions block

```yaml
definitions:
  allowlist:
    - api.internal-service.com
    - api.partner.com
  patterns:
    SECRET_PATTERN: '(?i)(api[_-]?key|secret|token)\s*[:=]\s*\S+'

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

## Actions

| Action            | Effect |
|--------------------|--------|
| `allow`            | The action proceeds normally |
| `block`            | The action is prevented; the agent receives a structured rejection |
| `redact`           | The matched content is removed/masked, then the action proceeds |
| `require_approval` | The action is paused and queued for manual approval via the dashboard |

## Input-plane configuration (Input Firewall)

Input scanning is configured separately from output policy rules, since it applies
uniformly to all content the agent reads rather than per-tool-call:

```yaml
agent: research-agent
input_firewall:
  mode: block        # or "sanitize"
  sensitivity: high   # low | medium | high
```

See [`ARCHITECTURE.md`](ARCHITECTURE.md) for how this fits into the overall request
flow, and [`policies/example-agent.yaml`](../policies/example-agent.yaml) for a
complete, runnable example.
