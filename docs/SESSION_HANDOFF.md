# 30studio Session Handoff

Last updated: 2026-11-16

> Current status source: `docs/PRODUCT_BACKLOG.md`. Social connections, approval, publication workers, operational dashboard, analytics snapshots and channel capability snapshots have advanced since the historical notes below. Check the backlog and `git status` before planning new work.

This file preserves product decisions and the exact engineering state so another session can resume without relying on chat history. Keep it in sync when the roadmap or implementation changes.

## Product direction

- Product: **30studio**, one SaaS product for the 3035 group and customer/personal brands. A tenant is an account/organization; it owns its brands and all related data and can have multiple users. A user may belong to multiple tenants. The initial deployment target remains a separate deployment decision.
- Example brands: 3035TECH, 30pay, 30grow, 30teach, and Thomas's personal brand.
- Product scope: native product for ideas, campaigns, channel-specific content, media, review/approval, scheduling, social connectors, analytics, and competitive/content intelligence. The user decided to bring the workflow into one product rather than depend operationally on Postiz or n8n. Postiz was considered only for early tests; current direction is in-product connectors and workflow.
- Architecture decision: Next.js application with TypeScript and a separate in-repository worker only for durable or resource-intensive jobs. The alternative Vite + React + NestJS was considered; Next.js was selected for the product.
- AWS/S3 is not required for local product development. LocalStack was approved for S3-compatible tests. Production storage and infrastructure decisions remain separate from this product implementation.
- Local services and databases must run through Docker. The user explicitly corrected that no PostgreSQL or other service should be installed natively on the host.

## Durable engineering and product requirements

- Multi-tenant scope is mandatory: every query, write, job, cache key, object key, AI context, and audit record must be scoped to the authorized tenant and, when relevant, brand. Never trust tenant IDs, roles, or permissions supplied by the browser or model.
- PostgreSQL is the source of truth. Application database access and migrations use Drizzle ORM. Do not write raw SQL in application code.
- Search for a maintained library before building a capability. Keep domain modules cohesive and components decoupled. Prefer measured scale/performance choices, explicit types, least privilege, secure defaults, and auditable behavior.
- TypeScript; Tailwind; custom reusable UI components and consistent UX/accessibility states. Do not use bare native HTML controls in product UI where the established custom components apply.
- All code, identifiers, filenames, folders, tests, and technical documentation are in English. User-visible labels/messages live in i18n catalogs for Portuguese and English (`messages/pt.json`, `messages/en.json`). Keep catalogs aligned.
- Avoid magic strings/numbers: use shared constants, enums, and types.
- Every data table must have filtering, sortable column headers, and page-size selection.
- AI may propose content but never grant permissions, approve content, or publish without the configured human approval gate. Any approval must bind to exact content/media versions.
- Never publish real social content without explicit human approval. Never deploy infrastructure or apply GitOps changes without an approved plan.

## Repository and branch

- Product repo: `/Users/thomasmetz/workspace/3035/30studio`
- Current task workspace was `/Users/thomasmetz/workspace/3035/gitops`; the 30studio repo is a sibling checkout.
- Active branch at handoff: `feature/editorial-calendar`.
- Existing commits on the branch include:
  - `a4661f8 feat(calendar): add multi-channel campaigns`
  - `0b55558 feat(content): generate channel copy drafts`
  - `67804d6 feat(media): queue generated post images`
- Latest campaign/editor delivery is committed as `c28eb09 feat(calendar): harden campaign and editing`. Check `git status` before continuing.

## Product functionality already present in the repo

- The workspace overview puts operational attention items first and selects its primary action from the user's server-returned calendar permission and active-brand availability. Campaign creation is a two-step flow with a review summary, independent per-network scheduling, and an editor warning/confirmation before discarding unsaved changes. Calendar and analytics data are keyed to the active organization to avoid showing the previous workspace during a switch.

- Better Auth accounts/workspaces, tenant membership, team management/invitations/audit.
- Tenant-scoped brand management and versioned Brand Kits, including private brand assets and human review.
- Editorial monthly calendar with month/list view and brand/channel/status filters.
- Campaign creation with a core brief and one post per selected channel; each network gets an independent scheduled date/time and time zone.
- Channel copy editor with immutable content versions and approved Brand Kit snapshot; optional AI copy suggestions through configured OpenAI provider.
- Generated image work has code for a durable PostgreSQL queue/worker, private S3-compatible storage, exact content-version linkage, preview, and image-specific human review. It is not operational until migrations, OpenAI/S3 configuration, and the worker are deployed/run.
- Competitor research now supports configured public RSS/Atom sources and a PostgreSQL collection worker; it stores citation-backed metadata only. Theme analysis, engagement metrics, source discovery, and other platform collectors remain future work. See `docs/COMPETITOR_RESEARCH.md`.

## Completed slice: campaigns and editor

The user asked to complete item 1 from the ordered roadmap: close campaigns and editor (persist and validate brief, calendar, channel copies, versions). The delivery is committed in `feature/editorial-calendar`:

- Campaign creation now requires an idempotency key and stores a request fingerprint. Identical retries return the existing campaign; reusing a key with different details returns conflict. New migration `0014_remarkable_shaman.sql` adds nullable campaign `idempotency_key` and `request_fingerprint` columns plus a tenant/creator/key unique index.
- Content version save now requires the expected current version number. The repository locks the item and returns conflict if another edit has advanced it; the route responds HTTP 409. Campaign-linked posts cannot silently change to a different brand or channel.
- The editor now shows a text preview for the selected channel variant, localizes the new conflict states, and disables changing a campaign post's channel. Disabled form fields fall back to the original brand/platform on save.
- Integration test coverage was added for campaign retries and conflicting payload reuse, concurrent version writes, and existing tenant isolation/campaign scheduling. Unit validation covers expected version and idempotency fields.
- Campaign fingerprinting lives in `lib/server/campaign-idempotency.ts`; it normalizes publication ordering. A unit test verifies ordering stability and that changed campaign content changes the fingerprint.
- `docs/PRODUCT_BACKLOG.md` now describes this status and remaining acceptance work.
- Commit: `c28eb09 feat(calendar): harden campaign and editing`.

## Validation evidence and hard blocker

Latest completed validation for the active work:

- `npm test`: 28 unit tests passed.
- `DATABASE_URL=... npm run test:integration`: 7 passed, 1 skipped (LocalStack-dependent brand asset storage replay test).
- Migrations `0000`–`0014` applied successfully to PostgreSQL 18.6 in a temporary Docker container named `30studio-f4-postgres`.
- Invitation integration used a disposable Mailpit container; email was captured locally, not sent externally.
- `npm run lint`: passed.
- `npx tsc --noEmit --incremental false`: passed.
- `npm run build`: passed.
- `DATABASE_URL=... npx drizzle-kit check`: passed.
- `git diff --check`: passed.

Integration verification ran against temporary Docker-only services and the containers have been stopped/removed. The migration was not applied to any application or production DB. Earlier attempts and correction:

- Local socket/TCP checks found no host PostgreSQL on ports 5432/5433.
- Starting a temporary `postgres:17.6` Docker container failed extracting an image layer with `no space left on device` in the Docker VM.
- Starting a temporary container from the already-present `postgres:18-alpine` image failed creating an overlay snapshot directory with the same disk-space error.
- A dedicated database create attempt inside the existing local `21mobile-gateway-postgres-1` container failed because its database storage also reported `No space left on device`. No database was created and no other project's schema/data was modified.
- A local PostgreSQL Homebrew install was briefly performed against the user's Docker-only direction. It was immediately uninstalled; its newly initialized Homebrew cluster was removed; no local service was started. Do not install services natively again.
- Read-only Docker space inspection found many old dangling images. With authorization, `docker image prune --filter until=168h --force` partially reclaimed images but returned GC errors. Docker reported image usage dropped from 30.48 GB to 13.23 GB; no volumes or containers were pruned.

The campaign/editor main flow requested by the user is now validated. Do not claim all of F4 is complete: additional variants per channel and versioned capability snapshots remain. Do not run migrations against unrelated project databases.

## Current next steps

1. Start the compose stack with valid local `LOCALSTACK_AUTH_TOKEN`, `LOCAL_POSTGRES_PASSWORD`, and `BETTER_AUTH_SECRET`; the demo seed is available to the Docker development flow.
2. Validate the implemented carousel export presets against current official platform requirements when building each publishing connector; carousel page copy editing and presets are implemented.
3. Homologate AI image and review calls with configured OpenAI credentials; provider calls were not exercised in this environment.
4. Add durable review findings only if product operations need review history; current findings are intentionally ephemeral. Keep F4 channel variants/capability snapshots visible.

## Current completed slice: human approval policy and advisory AI review

The user asked to continue product functionality after the campaign/editor slice. Approval and advisory review code is implemented and validated on `feature/editorial-calendar`; all changes remain uncommitted:

- A content author can request review for a saved draft version. A PostgreSQL transaction changes the content to `in_review`; retry returns the same pending request.
- A user with `content:approve` can approve, reject, or request changes. The original submitter cannot approve their own request. Decisions are stored as append-only rows with reviewer, decision, note, timestamp, and fingerprint.
- The SHA-256 fingerprint covers tenant-owned content item identity, brand, title, channel, schedule/time zone, immutable content version and copy, approved Brand Kit version, and approved media IDs/checksums/type/size. Pending media jobs or image reviews block a review request.
- Saving a revised version creates a new version; an older approval does not match the current version. Approval actions revalidate the fingerprint in the backend before recording a decision.
- Calendar reviewers can open in-review posts. The content fields become read-only, the review history is visible, and the UI exposes approve/reject/request-changes actions. PT and EN catalogs are updated.
- Workspace owners/admins can set a default approval count and brand-specific overrides (1–5). Each approval request snapshots its required count, so policy edits do not change open reviews. Brand override reset falls back to the workspace default.
- Approvals require distinct reviewers; repeated decisions by one reviewer return a conflict. An approval below the snapshot threshold stays in review; reaching the threshold finalizes it. Rejection and change requests resolve immediately.
- The workspace Team section includes approval policy controls, and calendar history shows progress. The PostgreSQL publisher worker consumes approved scheduled content and revalidates connection, approval fingerprint, version and media before publishing; external account/provider homologation remains pending.
- The editor can request an advisory AI review for a saved version. The backend loads that tenant's exact saved copy and referenced Brand Kit version, ignores embedded instructions in brand/copy data, and returns bounded findings for grammar, unsupported/restricted claims, voice, channel fit, and clarity. Findings include severity, explanation, excerpt, and optional suggestion; the UI binds them to the returned version ID and hides them once editing starts. The feature only compares data already saved in the product; it does not fetch competitor or web content.
- The AI review is on demand and ephemeral, requires configured `OPENAI_API_KEY` and `OPENAI_MODEL`, and cannot approve, reject, or publish. Live provider behavior/cost still needs homologation with a supplied credential; there is no credential in this environment.
- The media worker accepts a local `text_card` job that creates a neutral square SVG/Sharp card from saved channel copy and an approved Brand Kit accent color. It stores a WebP through the same private S3 path and review lifecycle without calling an AI provider. SVG text is escaped and bounded; no temporary logo/brand identity is added.
- A three-page static carousel now splits the saved channel copy across ordered square cards. Pages are inserted into PostgreSQL as one idempotent group, rendered through the existing worker, displayed together, and approved/rejected atomically only after every page reaches review. Export dimensions are still generic square; page-level editing remains backlog.
- Docker development includes a local-only demo owner (`demo@30studio.local` / `30studio-local-only`) with an idempotent seed that uses Better Auth's password hasher and refuses non-development mode or non-loopback/non-Compose database hosts. It marks only the local demo account verified, and never resets an existing account. Do not use these credentials outside Docker development.
- `Dockerfile.dev` and `compose.dev.yaml` provide a Docker-only development stack: PostgreSQL 18, LocalStack S3, migration and bucket-init one-shots, web app, and opt-in media worker. Only app and LocalStack ports bind to loopback; PostgreSQL stays internal. The LocalStack Docker hostname is allowed only for the exact endpoint in development mode.
- Additive carousel migration: `0017_oval_the_stranger.sql`; it adds nullable group/page metadata to existing media rows so single-image records remain compatible.
- New Drizzle-generated migration: `0015_amazing_ben_parker.sql`. It was applied only to disposable 30studio PostgreSQL Docker databases; never to another project or production database.
- New additive policy migration: `0016_thankful_wendell_rand.sql`. It was applied to a disposable PostgreSQL 18 Docker database on port 55434 for validation only. No existing project or production database was touched.
- External release homologation and persisted review findings remain incomplete. The local publication pipeline is implemented; validate real account/provider behavior before rollout. Do not describe F5 or the product as fully complete.
- The current working tree also contains the shared CSS polish from the previous turn; preserve it.

### Latest validation for approval work

- `npm test`: 38 unit tests passed after carousel rendering changes.
- `npx tsc --noEmit --incremental false`: passed.
- `npm run lint`: passed without warnings or errors.
- `npm run build`: passed with the carousel and local seed changes.
- `git diff --check`: passed.
- `npx drizzle-kit check`: passed.
- All migrations through `0017` applied successfully to a temporary Docker PostgreSQL database.
- Unit tests and static checks pass after adding policy and multi-review behavior. The calendar integration run exercises policy snapshotting, distinct reviewer enforcement, partial approval, final approval, and tenant isolation; the existing invitation integration still requires Mailpit on port 8025.
- Advisory AI review adds bounded-schema unit coverage and an integration assertion that review context reads the exact Brand Kit version and fails closed across tenants. The live AI provider call is not tested without external credentials.
- Latest calendar/carousel integration test passes against disposable Docker PostgreSQL 18. The full integration suite passes its database-backed tests except the pre-existing invitation test, which requires Mailpit on localhost:8025; the LocalStack-dependent test is skipped.
- Docker image build reported 12 moderate dependency audit findings from the current package lock. No automated dependency update was applied; assess the dependency graph as a separate security task.
- The full integration command had one unrelated failure in `team-invitations.test.ts` because Mailpit was not running on localhost:8025; the other integration tests passed and the LocalStack-dependent test was skipped.
- The temporary Docker PostgreSQL container was removed after validation. Do not install PostgreSQL, Mailpit, browser tooling, or any service on the host.

## Broader roadmap order

1. Validate carousel export presets against official connector requirements. Editable page copy and channel export presets are implemented; image review remains distinct from post approval.
2. Add durable, source-grounded review findings if review history is needed for operations.
3. Authorized competitive/trend intelligence with source provenance and limitations; never copy competitor content.
4. Native social connectors, persisted scheduler/outbox, retries/idempotency, publication status, and real analytics. The initial connector/worker slice is implemented; external homologation, remote reconciliation for all networks and broader scheduled analytics remain.
5. SaaS operational readiness: quotas/usage, privacy export/deletion, backups/recovery, observability, security and load validation.

Existing durable docs to consult first: `AGENTS.md`, `docs/PRODUCT_CONTEXT.md`, `docs/PRODUCT_SPEC.md`, `docs/PRODUCT_BACKLOG.md`, and `docs/MEDIA_STORAGE.md`.

## Status update — 2026-11-16

- Added a semantic, localized breadcrumb to the workspace shell; PT/EN labels come from the message catalogs.
- The editor's on-demand AI copy action now returns three distinct channel options for comparison; only the chosen option is saved into the immutable content version. Provider credentials are still required, and retaining multiple alternatives on one post remains future work.
- Added schema-versioned social capability snapshots to new content versions, with fingerprint compatibility for historical versions that have no snapshot. Migration `0034_content_capability_snapshot.sql` was applied only to the dedicated local 30studio database.
- Validation passed: 38 unit tests, TypeScript, focused lint, Drizzle journal check, locale-key parity, `git diff --check`, and calendar integration. The full integration suite completed with six passes and two environment-dependent skips (Mailpit and LocalStack).
- Browser visual QA remains outstanding because the CUA browser host is unavailable and Playwright is not installed. SMTP/Mailpit, LocalStack, provider credentials, external social accounts and deployment homologation are also not configured here.
- The working tree contains broad pre-existing uncommitted feature work. Do not reset, clean, or assume every change belongs to this status update.
