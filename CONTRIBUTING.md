# Contributing to PromptWall

Thanks for considering a contribution. PromptWall is an early-stage project and
contributions of all sizes are welcome — bug reports, documentation fixes, new
injection-pattern signatures, and new policy engine features.

## Getting started

```bash
git clone https://github.com/oeisthename/promptwall.git
cd promptwall
uv sync --extra dev
```

Run the test suite before making changes, to confirm your environment is set up
correctly:

```bash
uv run pytest
```

## Workflow

1. Open an issue describing the bug or feature before starting significant work,
   so we can agree on the approach first.
2. Create a branch from `main`: `git checkout -b fix/short-description`.
3. Make your change. Add or update tests — see "Testing expectations" below.
4. Run the full check suite locally before opening a PR:
   ```bash
   uv run ruff check .
   uv run ruff format --check .
   uv run mypy src/
   uv run pytest
   ```
5. Open a pull request against `main` with a clear description of what changed
   and why.

## Testing expectations

- **Unit tests** (`tests/unit/`) for individual functions and classes.
- **Integration tests** (`tests/integration/`) for end-to-end flows (e.g. a tool
  call passing through the firewall, policy engine, and ledger together).
- **Property-based tests** (`tests/property/`) for security invariants — anything
  of the form "this class of input must always be blocked/allowed regardless of
  encoding or formatting" belongs here, using `hypothesis`.

Any change to the Input Firewall's detection logic or the Policy Engine's
enforcement logic must include a property-based test demonstrating the invariant
it's supposed to uphold.

## Reporting security issues

Do not open a public GitHub issue for a security vulnerability, including a
prompt-injection bypass or a policy enforcement bypass. See [`SECURITY.md`](SECURITY.md).

## Code style

- Formatting and linting via `ruff` (config lives in `pyproject.toml`).
- Type hints are required on all new code; `mypy --strict` must pass.
- Keep functions small and single-purpose — this is a security tool, and
  reviewability matters more than cleverness.

## Commit messages

Follow [Conventional Commits](https://www.conventionalcommits.org/) (e.g.
`feat: add support for custom injection rule sets`, `fix: handle empty policy file
gracefully`). This keeps the changelog generation clean.
