# 30studio — product and technical specification

Status: working product direction; detailed UI and data decisions below are proposals for the first product slices.

## 1. Product vision

30studio is one SaaS workspace that helps a team turn brand strategy into original, approved, measurable content across social channels. It should replace scattered work between designers, documents, spreadsheets, workflow tools, and publishing dashboards with a traceable operating loop.

The value is operational, not just automated copy: clear ownership, fewer repeated decisions, consistent brand expression, faster review, safe scheduling, and learning from real results. AI proposes and prepares work; people control brand facts, approvals, and publication policy.

### First value measures

- Time from content idea to approved, publishable version.
- Percentage of scheduled posts that pass review without a second correction cycle.
- Number of missed/late posts and failed publications.
- Approval turnaround time by organization and brand.
- Cost per approved content item, separated by model, media work, and external API.
- Results by objective, channel, format, topic, and brand, with missing data visible.

Do not present vanity metrics or AI-generated scores as measured facts. Every metric needs a definition, source, time window, and quality/coverage indicator.

## 2. SaaS account and tenant boundary

- A tenant is an account/organization. It owns its brands, members, settings, usage, plans, and all marketing data.
- A tenant can contain many brands: 3035TECH, 30pay, 30grow, 30teach, Thomas's personal brand, or a future customer's brands.
- Users have a global login identity and join one or more organizations through membership. Invitations are organization-scoped.
- A brand belongs to exactly one organization. Social profiles, Brand Kits, competitors, campaigns, content, media references, approvals, publication jobs, analytics, and AI context belong to that organization and, where applicable, its brand.
- Resolve the active organization from a verified Better Auth session and current membership. Ignore any organization ID submitted by the browser/model/job unless the server proves membership and permission for it.
- Every repository method receives an authorized organization context and includes it in all reads and writes. Resource IDs alone never authorize access. Use organization-scoped uniqueness and composite references so a record cannot point to another tenant's brand.
- Workers re-resolve and validate organization/membership and permissions before changing state or calling a social network. The queue tenant ID is a routing hint, not authority.
- Start with roles: `owner`, `admin`, `editor`, `approver`, `analyst`. A tenant may have different people and approval policies per brand. Authorization is enforced in server code; hiding a button is not authorization.
- Tenant scope must flow into database rows, object-storage prefixes, cache keys, idempotency keys, audit events, telemetry dimensions, AI jobs, retrieval filters, and prompt context.

## 3. Information architecture and screens

### Sign-in and workspace onboarding

The entry screen supports account creation and sign-in in Portuguese and English. Email verification is required. After sign-in, a user creates a tenant workspace or switches among organizations they belong to. The first authenticated workspace screen lists only the active tenant's brands and allows a permitted member to create a brand. Signup is not operational until transactional email delivery and database credentials are configured.

### Workspace shell

Persistent organization switcher, navigation, user/team menu, language switcher, notifications, and a clear active-tenant indicator. Every page header repeats the current organization and brand scope where relevant.

### Overview

An operational home screen with:

- Items waiting for this user's action: drafts to review, approvals pending, connection problems, jobs requiring intervention.
- This week's planned/published content grouped by brand and channel.
- Pipeline health: jobs by state, overdue work, retry/dead-letter items, connector health.
- Small performance summary with date range and data coverage.
- Quick actions: create idea, start campaign, add a brand, invite a member.

Show empty, loading, stale, partial-data, and failed states distinctly. Do not use fabricated sample counts in a connected environment.

### Brand portfolio

Searchable organization-scoped list of brands with logo/mark, purpose, active state, social profiles and connection health, next scheduled item, approval policy, and last activity. Create, archive, and edit brands. Selecting a brand opens tabs for Overview, Brand Kit, Channels, Competitors, Content, Analytics, and Access.

### Brand Kit

Versioned structured profile containing approved logos, colors, fonts, tone, audiences, positioning, products/features, verified claims and their sources, prohibited claims, CTAs, templates, platform rules, and legal/usage notes. Import source files with provenance; a human marks facts and identity assets as approved. Content stores the exact Brand Kit version used.

### Channels and social profiles

Within a brand, add a profile from a supported platform and complete that platform's native OAuth flow. Show account identity, granted scopes, connection owner, connected/expired/revoked state, last successful check, API capability matrix, and reconnect/revoke actions. Never show access or refresh tokens.

Each connector declares supported post types, media constraints, character limits, scheduling semantics, status polling/webhooks, analytics fields, permission requirements, and known restrictions. The composer reads this capability contract rather than assuming one format works everywhere.

### Editorial calendar

Calendar and list views with filters for organization, brand, channel, campaign, status, owner, and date. Distinguish idea, draft, review, approved, scheduled, published, failed, and cancelled. Dragging a card changes its proposed time and therefore invalidates approval until the updated version is approved.

### Campaign and content workspace

A campaign has objective, audience, key message, offer, dates, owner, budget/usage cap, and selected brands/channels. Content can be created independently or linked to a campaign.

The composer has one canonical content brief, then explicit channel variants. For each destination show preview, post format, caption/copy, hashtags, CTA, media, alt text, language, schedule/time zone, and validation against connector capabilities. A shared idea may create separate versions; never silently cross-post an identical payload where platform constraints differ.

AI actions are constrained and reviewable: suggest ideas, draft a channel variant, rewrite against feedback, propose a carousel outline, write a video script, or explain performance. Show source facts and Brand Kit version. The model cannot choose tenant/brand permissions, approve content, or publish.

### Approval inbox

Queue of items assigned to the current user, with organization/brand, channel, planned time, owner, required approvers, deadline, and current state. Detail view shows the exact copy and all media, full carousel/video preview, previous versions, diff, review findings, sources, comments, and approval history.

An approval is tied to a canonical SHA-256 fingerprint of the copy, assets, destination profile, format/settings, schedule, and relevant Brand Kit version. Any change creates a new immutable version and requires approval again. Support approve, reject, request changes, and configured one-person or multi-person approval rules. Missing approval blocks scheduling.

### Media library

Tenant/brand-scoped assets with preview, dimensions, duration, file type, size, hash, source, creator, license/consent, rights expiry, alt text, variants, and usage history. Preserve approved asset versions. Store media in private object storage with tenant and brand prefixes; access through short-lived authorized URLs.

### Competitor intelligence

Manage public/authorized sources by organization and brand. Each observation stores source URL, platform, captured time, content date, topic, format, available engagement measures, retrieval method, and data-quality/coverage limits. Produce opportunity themes and citations, never copy competitor text or media. If source access or metrics are unavailable, state that explicitly.

### Analytics and learning

Compare outcomes using definitions visible to the user: available impressions/reach, video views, likes/reactions, comments, shares, saves, clicks, and conversions only when the channel/API supplies them. Separate raw platform metrics from normalized rates. Allow campaign/UTM attribution where configured. Recommendations include evidence, coverage, and confidence/limitations; the system does not invent missing denominators.

### Team and account settings

Organization profile, members, invitations, roles, approval defaults, time zone, language defaults, retention, connected apps, usage limits, billing plan, and audit history. Brand-specific access and approval rules can override organization defaults without expanding tenant scope.

### Operations and job history

An internal product view (not a separate automation platform) for AI/media/connector runs: job ID, tenant, brand, input/output version IDs, state, timing, retry count, sanitized error, and safe retry/cancel actions. Do not expose prompts with secrets or credentials.

## 4. Initial data model

Auth identity and organization membership are managed by Better Auth's organization plugin and represented through its generated Drizzle schema. Product entities use Drizzle schema and migrations. All listed business tables include required `organizationId`; brand-owned rows also carry `brandId` with an organization-consistency constraint.

| Entity | Purpose / important relationships |
|---|---|
| Organization | Tenant/account, account slug, locale/time zone, plan and state. |
| User / Member / Invitation | Global login identity; tenant membership, role, status and invitation lifecycle. |
| Brand | Organization-owned brand name, slug, description, industry, state, owner and settings. |
| BrandKit / BrandKitVersion | Versioned identity, verified knowledge, claims, audiences, CTAs, source refs and template configuration. |
| SocialProfile | Organization + brand + platform + remote account ID; connection status, granted scopes and encrypted credential reference. |
| OAuthCredential | Tenant-scoped encrypted token material, key/version metadata, expiry, scopes, rotation/revocation state. No secret in logs or UI. |
| ConnectorCapability | Versioned platform capability contract: formats, media constraints, publishing/status/analytics support and restrictions. |
| CompetitorSource / Observation | Authorized source configuration and time-stamped public observation with provenance and data quality. |
| Campaign | Organization/brand objective, audience, dates, owner, budget and measured outcomes. |
| ContentItem / ContentVersion | Canonical brief and immutable channel-specific content revisions; exact Brand Kit and connector capability versions used. |
| MediaAsset / ContentAsset | Private object key, checksum, dimensions/duration, rights, creator, variants and attachment to content version. |
| ReviewFinding / Comment | Automated/manual review findings and feedback tied to an immutable version. |
| ApprovalPolicy / ApprovalDecision | Scoped required approvers/rule; append-only decision tied to version fingerprint, actor and time. |
| PublicationJob / Attempt | Approved scheduled intent, idempotency key, external profile, remote ID, attempt history, retries and final status. |
| MetricSnapshot | Raw metric values plus platform, collection time, definition, source, coverage and normalization metadata. |
| AIJob / WorkflowRun | Tenant/brand-scoped task, context/version IDs, model/provider, status, usage/cost, retries and sanitized trace references. |
| AuditEvent | Tenant-scoped actor/action/target/time/version and redacted before/after summary. Append-only. |
| UsageLedger | Organization-scoped model tokens/cost, media processing, storage and API usage for quotas/billing. |

Add composite indexes around common access paths, for example organization + brand + state/date, organization + platform + remote account, and organization + idempotency key. Build tenant-scoped foreign keys/unique constraints through Drizzle schema APIs. Evaluate PostgreSQL row-level security as defense in depth without bypassing ORM/repository scoping.

## 5. Cross-tenant and AI context handling

Resolve a request context as `{userId, organizationId, membershipRole, permissionSet}` from Better Auth session and a server-side membership check. For brand operations, load the brand using both `organizationId` and `brandId`. Workers receive a signed/opaque job reference, then reload and reauthorize all records from PostgreSQL before acting.

AI context assembly follows a fixed boundary: organization -> authorized brand -> exact Brand Kit version -> approved product facts -> allowed source observations -> current content version. Retrieval, caches, embeddings, files, and memory must filter by organization and brand before content is presented to a model. Treat competitor posts, comments, uploads, and model output as untrusted data. Never use model-generated tenant IDs or tool parameters as authorization.

## 6. Workflow and safety states

`idea -> draft -> review -> changes_requested | approved -> scheduled -> publishing -> published | failed | cancelled`

Every transition is a server-side domain command with actor, organization, target version, permission, and audit event. Publishing is enabled only by a backend release gate that rechecks organization membership, social profile ownership/health, exact approved fingerprint, approval policy, time window, and idempotency. On ambiguous network timeout, query remote status before retry. No service restart may erase business state or release a pending post.

## 7. Platform evaluation and priority

Initial candidates: LinkedIn, Instagram, Facebook, TikTok, X, YouTube, Threads, Pinterest. Build capability adapters behind 30studio's domain; do not promise a format until the target API and account type support it.

- First implementation candidates: LinkedIn, Instagram/Facebook (shared Meta app, separate account/profile capabilities), and YouTube/Shorts.
- Threads is a strong next candidate for conversational content and founder presence.
- X is in scope; confirm current API tier, write access, rate limits, and recurring cost before committing a connector timeline.
- Pinterest is optional/phase two for evergreen visual education and discovery content.
- TikTok is a validation gate: its current developer content-sharing guidelines restrict unaudited posts to private visibility and say an API client should not be limited to an internal team tool. Do not promise a production connector for a private-only 30studio deployment until its public SaaS eligibility and audit path are confirmed.

The official API references must be rechecked before implementing each connector: [TikTok Content Posting API guidelines](https://developers.tiktok.com/docs/en/content-sharing-guidelines), [YouTube `videos.insert`](https://developers.google.com/youtube/v3/docs/videos/insert), [Meta Instagram API changelog](https://developers.facebook.com/docs/instagram/platform/instagram-api/changelog/), [Meta Threads API collection](https://www.postman.com/meta/threads/documentation/dht3nzz/threads-api), [Pinterest create Pins](https://developers.pinterest.com/docs/work-with-organic-content-and-users/create-boards-and-pins/), and [X Developer Platform](https://developer.x.com/).

## 8. Implementation sequence

1. **SaaS foundation:** Better Auth users/organizations/members/invitations, custom roles, active organization context, Drizzle schema/migrations, tenant-scoped repository template, and cross-tenant authorization tests.
2. **Portfolio:** create/edit/archive brands, invite/manage members, role checks, brand-scoped Brand Kit skeleton, locale switcher and tenant-empty state.
3. **Channel setup:** profile records, connector capability registry, OAuth state/CSRF flow, encrypted token vault and connection health; begin with approved sandbox apps.
4. **Editorial operations:** calendar, campaign, canonical content/version model, per-channel variants, review queue and immutable approval gate.
5. **Media and AI:** Brand Kit import/validation, generated image/carousel, limited video pipeline, source-aware AI actions, tenant-safe context assembly and usage ledger.
6. **Publishing and analytics:** prioritized native connectors, durable scheduler/outbox, retries/status polling, metrics snapshots, dashboard and operator view.
7. **SaaS launch:** plans/quotas, self-serve onboarding, billing integration, customer data export/deletion, retention policy, recovery evidence and security review.

Do not start with a giant generalized agent framework, arbitrary workflow builder, or a separate microservice per agent. First deliver one tenant-safe content-to-approval-to-sandbox publication path.

## 9. Web/backend architecture decision

### Recommendation for the first release: Next.js + an internal worker

30studio is an authenticated SaaS workspace; public SEO is not a product requirement. Next.js App Router gives one TypeScript application for the UI, authenticated server rendering, and API Route Handlers. Better Auth has a direct Next.js adapter. Keep Route Handlers thin: validate input/session, resolve organization membership, call domain services, and serialize stable API contracts. Put authorization, business rules, and Drizzle repositories in framework-independent modules.

Run long-lived or CPU-heavy work in a worker process built from this same repository. Do not render video, wait on model APIs, poll social networks, or run weekly research inside a user-facing request. Persist job/business state in PostgreSQL, use Redis only as queue transport if the selected queue library needs it, and use idempotent jobs with bounded retries. Scale the worker independently when measurements show a need.

This keeps the first release to one product app plus an internal worker. It does not force everything into one process. The authenticated app can scale horizontally; tenant data should be explicitly uncached/private. If Next.js multi-instance page/data caching is used later, shared cache and invalidation coordination must be designed for Kubernetes.

### When Vite + NestJS would be the better choice

Choose Vite + NestJS if 30studio becomes API-first, has multiple independent clients, needs a separately scaled backend/API team, or backend modules/jobs dominate the deployment lifecycle. Vite emits static assets that can be served by a static server; Nest offers explicit modules and first-party queue patterns. That design provides a stronger frontend/API boundary, with added shared-contract, auth integration, CORS/same-origin routing, and deployment/build coordination. It is not inherently faster for the user: query shape, client bundle, cache policy, connector latency, and media queue dominate performance.

Keep domain services framework-independent so a Vite/Nest migration remains possible without moving tenant rules out of PostgreSQL repositories. Revisit after the first tenant-safe content-to-approval-to-sandbox publication path and real load measurements, not preemptively.

### Official documentation reviewed

- [Next.js Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers) and [self-hosting](https://nextjs.org/docs/app/guides/self-hosting): supports custom API handlers and Node/Docker/Kubernetes hosting; multi-instance cache invalidation needs coordination if shared caching is enabled.
- [Better Auth Next.js integration](https://better-auth.com/docs/integrations/next): native Route Handler integration and session usage.
- [Vite production build](https://vite.dev/guide/build): emits deployable static assets.
- [NestJS modules](https://docs.nestjs.com/modules) and [queues](https://docs.nestjs.com/techniques/queues): modular backend and Redis-backed worker queue patterns.

Decision status: **recommended, not yet locked**. The current Next.js package scaffold reflects this first-release recommendation; no API, database, or production deployment is considered complete.
