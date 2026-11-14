# 30studio Session Handoff

Last updated: 2026-11-14

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

- Better Auth accounts/workspaces, tenant membership, team management/invitations/audit.
- Tenant-scoped brand management and versioned Brand Kits, including private brand assets and human review.
- Editorial monthly calendar with month/list view and brand/channel/status filters.
- Campaign creation with a core brief and one post per selected channel; each network gets an independent scheduled date/time and time zone.
- Channel copy editor with immutable content versions and approved Brand Kit snapshot; optional AI copy suggestions through configured OpenAI provider.
- Generated image work has code for a durable PostgreSQL queue/worker, private S3-compatible storage, exact content-version linkage, preview, and image-specific human review. It is not operational until migrations, OpenAI/S3 configuration, and the worker are deployed/run.
- Social profile records exist, but OAuth connections, publishing, analytics, and competitive monitoring are not functional yet.

## Current active work: finish campaign/editor slice

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

1. Check `git status` and preserve any user changes before further work.
2. If code changes continue, repeat unit, lint, TypeScript, production build, Drizzle check, and integration tests as relevant.
3. Keep remaining F4 work visible: extra channel variants/capability snapshots and richer media contract preview/validation.
4. Continue later with the separate approval-policy/content-review phase. Social OAuth, real publishing, analytics, competitive intelligence, SaaS billing/quotas, and production deployment remain outside this slice.

## Broader roadmap order

1. Finish campaigns/editor and prove persistence (active).
2. Human approval policy: tenant/brand policy, one or multiple approvers, reject/request changes, append-only audit, exact copy/media/channel/schedule/Brand Kit fingerprint, and revalidate before any scheduler release.
3. Make image generation operational and add validated templates/carousels; image review is distinct from post approval.
4. Add safe AI review and source-grounded content checks.
5. Authorized competitive/trend intelligence with source provenance and limitations; never copy competitor content.
6. Native social connectors, persisted scheduler/outbox, retries/idempotency, publication status, and real analytics.
7. SaaS operational readiness: quotas/usage, privacy export/deletion, backups/recovery, observability, security and load validation.

Existing durable docs to consult first: `AGENTS.md`, `docs/PRODUCT_CONTEXT.md`, `docs/PRODUCT_SPEC.md`, `docs/PRODUCT_BACKLOG.md`, and `docs/MEDIA_STORAGE.md`.
