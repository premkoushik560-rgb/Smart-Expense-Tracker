# Smart Expense Tracker

An authenticated personal finance workspace for tracking income, expenses, budgets, and spending patterns.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/smart-expense-tracker` — React + Vite web application and responsive product UI.
- `artifacts/api-server` — Express API, Clerk middleware, and finance routes.
- `lib/api-spec/openapi.yaml` — source-of-truth API contract.
- `lib/api-client-react` — generated React Query client.
- `lib/api-zod` — generated request and response validators.
- `lib/db/src/schema` — Drizzle tables for expenses, income, and budgets.

## Architecture decisions

- Clerk owns authentication; the API scopes every financial query by the Clerk user ID.
- OpenAPI is the contract source of truth so the frontend and server share generated types and validators.
- Calendar dates use string-backed PostgreSQL date values to avoid timezone shifts in daily transactions.
- New users receive a small starter dataset so the dashboard communicates its value immediately; later mutations remain fully persistent.

## Product

Users can sign in, capture income and expenses, search and filter transactions, manage monthly/category budgets, inspect analytics, and ask a spending advisor for practical guidance.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Run API codegen after changing `lib/api-spec/openapi.yaml`.
- Run `pnpm run typecheck` after shared schema or API changes.
- Do not expose or commit Clerk or database secrets.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
