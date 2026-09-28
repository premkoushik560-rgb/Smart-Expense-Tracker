---
name: Existing workspace stack
description: How to adapt framework-specific briefs to this Replit monorepo
---

When a brief names Flask/SQLite but the project is already a TypeScript Replit monorepo, preserve the requested product behavior while using the existing React + Express + Drizzle + PostgreSQL architecture. Keep the API contract in OpenAPI and use Clerk for browser authentication.

**Why:** The workspace template already provides managed artifact routing, generated clients, database tooling, and auth provisioning; replacing that foundation would add risk without improving the user-facing result.

**How to apply:** Check the current workspace conventions before translating a technology-specific brief. Explain the adaptation in the project README rather than creating a disconnected second stack.