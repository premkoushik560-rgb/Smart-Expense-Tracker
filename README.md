# Smart Expense Tracker

Smart Expense Tracker is an internship-level personal finance application for understanding income, expenses, budgets, and spending patterns in one calm workspace. It supports authenticated, user-isolated financial data, transaction CRUD, budget tracking, analytics, and a natural-language spending advisor.

## Project abstract

Many people record expenses inconsistently and only understand their financial position at the end of a month. Smart Expense Tracker turns everyday transaction capture into a useful feedback loop: users can record money in and out, compare spending with budgets, see trends, and receive practical next steps.

## Problem statement

Manual spreadsheets and scattered banking notes make it difficult to answer simple questions such as:

- How much money came in this month?
- Which category is costing the most?
- How much remains in my budget?
- Is my spending improving over time?

The application centralizes this information and presents it in a form that is quick to scan and simple to maintain.

## Objectives

1. Provide secure sign-in and isolated user data.
2. Make adding, editing, and deleting income and expenses straightforward.
3. Show current balance, monthly spend, savings rate, and recent activity.
4. Support monthly and category-level budgets with over-budget warnings.
5. Visualize trends and category distribution.
6. Provide advisor responses based on the user's stored spending history.
7. Work well on desktop and mobile screens.

## Proposed system

The application has a React + Vite web client, an Express API server, and a PostgreSQL database accessed through Drizzle ORM. Clerk provides authentication; the API derives the signed-in user from the Clerk session and applies that user ID to every read and write.

The original brief described Flask/SQLite. This implementation uses the project's existing Replit TypeScript workspace conventions so the result has a managed API service, generated OpenAPI clients, PostgreSQL persistence, and a publishable web artifact.

## Functional requirements

- Clerk sign-up, sign-in, sign-out, and account display.
- Dashboard totals: income, expenses, balance, monthly expenses, budget remaining, savings rate, and highest spending category.
- Expense CRUD with amount, date, category, payment method, and description.
- Income CRUD with source, amount, date, and description.
- Categories: Food, Travel, Shopping, Education, Bills, Entertainment, Healthcare, and Other.
- Monthly and category budgets with spent, remaining, and over-budget state.
- Analytics for monthly income versus expenses, spending trend, category distribution, total savings, and highest category.
- Transaction search, category filter, type filter, and date range filters.
- Advisor endpoint for a plain-language spending summary and actionable highlights.

## Non-functional requirements

- User financial data is scoped by authenticated Clerk user ID.
- API inputs and outputs are validated with generated Zod schemas.
- API contracts are defined in OpenAPI and used to generate typed React Query hooks.
- Sensitive authentication headers and cookies are redacted from server logs.
- Responsive UI with loading, empty, error, and confirmation states.
- Shared monorepo type checking must pass before delivery.

## System architecture

```text
Browser
  └─ React + Vite + Wouter
       ├─ Clerk browser session
       ├─ Generated React Query hooks
       └─ Shared proxy → /api
                          └─ Express API
                               ├─ Clerk middleware
                               ├─ Zod request validation
                               ├─ Drizzle ORM
                               └─ PostgreSQL
```

`lib/api-spec/openapi.yaml` is the API source of truth. Code generation produces the typed client in `lib/api-client-react` and server validation schemas in `lib/api-zod`.

## Database / ER diagram description

```text
Clerk user
  ├──< expenses
  ├──< income
  └──< budgets
```

- `expenses`: amount, calendar date, category, payment method, description, owner ID.
- `income`: amount, calendar date, source, description, owner ID.
- `budgets`: name, amount, month, optional category, owner ID.

The Clerk user ID is stored as `owner_id` on each financial table. There is no cross-user join path in the API: every query includes the authenticated owner ID.

## Modules

- **Authentication**: Clerk-managed registration, sign-in, sign-out, and session-aware routing.
- **Dashboard**: financial summary and recent transactions.
- **Transactions**: combined expense/income list, search, filters, and CRUD dialogs.
- **Budgets**: monthly and category limits, progress, and warning states.
- **Analytics**: six-month trend, category distribution, savings, and averages.
- **Advisor**: data-backed spending summary and suggested actions.
- **Settings**: account details, theme preference, and session controls.

## Install and run locally

Requirements: Node.js 24, pnpm, and a PostgreSQL database configured as `DATABASE_URL`.

```bash
pnpm install
pnpm --filter @workspace/db run push
pnpm run typecheck
```

The project workflows start the API and web services:

```bash
pnpm --filter @workspace/api-server run dev
pnpm --filter @workspace/smart-expense-tracker run dev
```

The generated API client can be refreshed after changing the contract:

```bash
pnpm --filter @workspace/api-spec run codegen
```

Authentication secrets are provisioned through the project's managed Clerk setup. Do not commit secret values.

## Testing strategy

1. Run the full TypeScript check with `pnpm run typecheck`.
2. Check API health at `/api/healthz`.
3. Verify signed-out routes: landing page, sign-in, and sign-up.
4. Verify authenticated routes: dashboard, transactions, budgets, analytics, advisor, and settings.
5. Test create, edit, delete, search, and filter flows after reload.
6. Confirm a second signed-in user cannot see the first user's records.
7. Check mobile-width layout and form validation.

## Expected results

After sign-in, a user sees seeded starter data on the first visit, then can replace it with their own records. Dashboard and analytics values update after successful mutations, budgets reflect current spending, and advisor responses use the user's transaction history.

## Future enhancements

- CSV import and export.
- Recurring transactions and bill reminders.
- Receipt capture with object storage.
- Bank integrations with explicit user authorization.
- More advanced AI explanations and anomaly detection.
- Shared household budgets.
- Automated monthly email summaries.

## GitHub upload

```bash
git init
git add .
git commit -m "Build Smart Expense Tracker"
git branch -M main
git remote add origin https://github.com/<username>/<repository>.git
git push -u origin main
```

Keep `.env` files and secret values out of the repository. Configure the same environment variables in the target deployment instead.

## Internship presentation points

- Contract-first API design with OpenAPI and generated clients.
- Authentication and per-user data isolation.
- CRUD workflows with validation and cache invalidation.
- Financial aggregates computed from persisted transactions.
- Responsive product design rather than a tutorial-style form page.
- Clear separation between frontend artifact, API server, shared database package, and generated API libraries.