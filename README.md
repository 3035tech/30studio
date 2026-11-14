# 30studio

30studio is the multi-tenant SaaS marketing workspace for the 3035 portfolio and future customer brands. The initial app is built with Next.js; PostgreSQL/Drizzle, Better Auth organizations, and `next-intl` form the account, persistence, and localization foundation.

Before changing code, read [`AGENTS.md`](./AGENTS.md) and [`docs/PRODUCT_CONTEXT.md`](./docs/PRODUCT_CONTEXT.md). Codex, Claude Code, and Cursor are configured to use these shared instructions.

For approved 30studio logos, colors, typography, and usage rules, read [`docs/PRODUCT_BRAND.md`](./docs/PRODUCT_BRAND.md). The UI uses Tailwind CSS v4 over the official brand tokens, with shared accessible controls.

The screen map, feature scope, delivery phases, dependencies, and acceptance criteria live in [`docs/PRODUCT_BACKLOG.md`](./docs/PRODUCT_BACKLOG.md). Interface copy is localized in Portuguese and English through `next-intl` message catalogs; code and technical identifiers stay in English.

The repository uses Git Flow; see [`docs/GIT_WORKFLOW.md`](./docs/GIT_WORKFLOW.md) for branch and commit conventions.

The current work is an initial product foundation. It is not a production release. Database credentials, auth/email delivery, social OAuth app credentials, customer Brand Kit import, and deployment are not configured. No social posts can be published.

## Local development

Install dependencies with `npm ci`, copy `.env.example` to `.env.local`, and configure a local PostgreSQL URL plus Better Auth settings before using authenticated routes. Generate auth tables with `npm run auth:generate`, generate the application migration with `npm run db:generate`, then review and apply migrations only to a development database with `npm run db:migrate`.

The first data slice includes Better Auth users, organizations, memberships, and invitations, plus tenant-scoped brands and social-profile metadata. The API obtains the active organization from the authenticated session and checks the user's current membership and permission. A login/signup and workspace/brand entry screen is present; email delivery is unconfigured, so account verification and invitations are not ready for end users.
