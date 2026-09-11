# PromptWall Enterprise Dashboard

The Centralized Control Plane for PromptWall.

This Next.js application provides a real-time visualization layer, policy management system, and audit log viewer for your PromptWall proxies. 

## Features

- **Global Policy Management**: Visually construct Regex, Keyword, and DLP rules and instantly enforce them across all your proxy nodes.
- **Audit Ledger**: View a searchable, unified timeline of all blocked and allowed AI agent actions.
- **Analytics & Metrics**: Monitor traffic, blocked payloads, and policy violation rates.
- **Playground**: Test your security policies instantly in the browser.

## Getting Started

The dashboard is built to run via Docker Compose alongside the PostgreSQL database and the PromptWall Proxy.

From the root of the repository, run:
```bash
docker compose up -d dashboard
```

The dashboard will be available at [http://localhost:3002](http://localhost:3002) (or the port mapped in your `docker-compose.yml`).

## Development

First, run the development server:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.
