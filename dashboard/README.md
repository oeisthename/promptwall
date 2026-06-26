# PromptWall Dashboard

Next.js 16 + React 19 + TypeScript web dashboard for PromptWall.

## Planned structure (built out in Weeks 6-7 of the roadmap)

- `app/` — App Router pages: live event feed, policy editor, audit log viewer
- `components/` — shadcn/ui-based components (alert feed, charts, data tables)
- `lib/` — API client (typed against the FastAPI OpenAPI schema), WebSocket hook

## Development

```bash
npm install
npm run dev
```

Expects the API server running at `NEXT_PUBLIC_API_URL` (defaults to
`http://localhost:8000`).
