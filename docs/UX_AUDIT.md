# 30studio UX audit

Date: 2026-11-14
Scope: authenticated local Docker workspace, desktop browser, Portuguese and English catalogs, workspace overview, monthly/list calendar, brand creation entry point, team management and campaign planning form. No brands, invitations, or publications were created.

## Navigation and information architecture

- The workspace menu is a vertical navigation list, not a tab set. Each destination has both a familiar icon and a text label (Overview, Calendar, Brands, Team). This is the right pattern for switching between distinct workspace areas and remains understandable without recognizing icons.
- The calendar Month/List control is a view switch within the same information area. It correctly uses a segmented toggle with icon and text label, and exposes selected state to accessibility tools.
- The workspace content is one long page with anchor destinations. Section links work, but the long-page pattern makes context and orientation less clear as the product grows. Consider promoting primary areas to dedicated routes once additional modules (Brand Kits, research, analytics, connections) are available.
- Tables expose filters, page size, sortable headers, and pagination labels. These controls were present in member, invitations, and access history sections in both locales.

## Findings and changes

### Fixed in this audit

1. **Dark mode, secondary CTA contrast** — the quiet button style can render as an anchor through Radix Slot. The dark-mode override targeted only `button`, leaving the “Add brand” link with dark-on-navy text. The override now applies to any workspace element carrying the shared text class.
2. **Dark mode, supporting label contrast** — the workspace eyebrow and editorial kicker inherited the brand purple, which was difficult to read on the navy surface. They now use the existing light muted palette.
3. **Calendar list empty state** — the generic empty notice and list-specific empty notice both appeared for an empty month. The generic notice now appears only in month view; list view keeps its own single empty state.
4. **Calendar add affordance** — plus icons in month cells were low contrast in dark mode. Their dark-mode color and opacity now use the light muted palette. The controls already have date-specific accessible names.
5. **Campaign default date** — the top-level “Plan a campaign” action defaulted to the first day of the selected month. When that was the current month, it could propose a date already in the past. It now defaults to today for the current month and the first day when another month is selected.
6. **Tenant Brand Kit identity** — the blank brand-color field suggested the 30studio product purple as its sample. The placeholder now uses a neutral example so customers are less likely to confuse the product identity with their own.

### Observed; follow-up needed

- The demo workspace appears as `worksapce_1` in both the selector and page heading. Workspace owners can now change the display name in profile settings; the stable slug is shown and never changed by this form. The existing name remains untouched until an owner chooses a replacement.
- The empty brand state offers a short creation form and explains that identity and channels are configured later. This is clear for a first-time user, but a guided next step should appear after brand creation to connect a channel and complete the Brand Kit.
- Brand Kit editing uses a two-column layout with audience, voice, colors, fonts, messaging, products, claims, calls to action, and sourced facts. Draft/version status is explicit, and the archive confirmation explains that related data is preserved.
- Brand assets include source, rights, expiry, alt text, review note, and upload state. The asset table has 12 sortable columns and will be dense at narrow widths; consider a compact summary table with a details view for technical metadata.
- The overview hero and calendar are aligned to the same content column. At the inspected high-resolution desktop width, substantial unused screen area remains outside the max-width content; this is acceptable for readability, but responsive widths below desktop and mobile need separate visual review.
- Calendar filters are aligned to the right of month controls on wide screens and wrap through flex behavior. Verify tablet-width wrapping and small-screen calendar horizontal scrolling before release.
- Social platform selection in the campaign form is explicit and labels each network; per-network dates and times are separated. No brand exists in this workspace, so actual campaign submission and content editing were not exercised.
- Team tables are discoverable and provide text labels; no invite was sent. Email delivery needs configuration before onboarding collaborators.

## Verification performed

- Logged into the local Docker app with the seeded development user.
- Inspected the workspace overview, navigation, empty brand creation form, calendar month/list state, campaign form, team tables, and approval policy in Portuguese and English.
- Confirmed navigation items include icon plus text; view toggles include icon, text, and selected state.
- Changes in this audit affect only display CSS and empty-state rendering. Re-run typecheck, lint, unit tests, and browser review after applying.

## Not verified

- Mobile and tablet layout, light system theme, connected social accounts, real Brand Kit editing, populated calendar cards, AI generation, media rendering, and external publication flows.
- No real publication, invitation, or external API call was made. A temporary local brand and one clearly marked audit-only Brand Kit draft were created to inspect filled states; the brand was then archived. Its associated data is preserved by the application archive flow.

## Product-wide UX redesign direction

The current workspace combines overview, calendar creation, brand management, and team administration in one long page. The next design pass should make the primary jobs discoverable from persistent navigation: Home, Content, Calendar, Brands, Insights, and Team. Only destinations backed by working functionality should be active; integrations and analytics that are not implemented should be clearly marked as planned rather than presented as ready.

Use a light, high-contrast workspace by default, with a deliberate theme control if dark mode remains supported. Reduce simultaneous information by splitting creation, review, and settings into focused views, and use progressive disclosure for version history, asset metadata, and approval details. The content flow should begin with a visible Create content action, then guide the user through brand, idea, channels, per-channel schedule, copy and media, and approval. Brand editing should be grouped under each brand, with profile connections and Brand Kit status visible as separate setup steps.

The live browser became unavailable during the latest audit pass, so these are design requirements from user feedback and source inspection, not claims of visual verification.

## Follow-up pass — 2026-11-15

- The user added four brands to the local workspace: 30grow, 30Pay, 30sales, and 30studio. No brand records were changed during this pass. The earlier notes about an empty workspace describe the prior audit baseline.
- The shell now displays one workspace area at a time for Overview, Calendar, Brands, and Team, instead of presenting all four sections as one continuous page.
- A persistent Create content action switches to Calendar and opens the campaign form for a permitted user when at least one brand exists.
- Removed automatic system dark-mode overrides so the light palette remains in use. This has not been visually verified in Chrome.
- ESLint, TypeScript with incremental writes disabled, and `git diff --check` passed. The local Docker app returned HTTP 200 at `/pt`.
- The Chrome browser connector was unavailable, so visual contrast, mobile layout, and click-through behavior remain unverified in the running UI. No real content was created, no social account was connected, and nothing was published.
- Analytics and social account management still need follow-up review. Competitive intelligence now has a screen for configured RSS/Atom sources, collected observations, cited topic groups, and advisory editorial ideas; it remains limited to those feeds.

## Progressive disclosure pass — 2026-11-15

- Added a reusable accessible disclosure control and used it to keep Brand Kit history and assets closed until requested. The asset upload form is also collapsed by default and opens on demand. Asset metadata remains available in the existing filterable and sortable table.
- Brand cards now show each registered social profile with its platform, display name, and connection status, rather than listing names without context. This reads stored profile metadata only; it does not connect accounts.
- ESLint, TypeScript, translation JSON parsing, and `git diff --check` passed. Browser visual review is still pending because the Chrome connector is unavailable.

## Approval queue pass — 2026-11-15

- Added an Approvals destination to the workspace navigation. It reuses the existing calendar data and review actions, opens in list mode, and filters to content in review. Returning to Calendar restores the month view and clears the queue filter.
- ESLint, TypeScript, and `git diff --check` passed. The local Docker app returned HTTP 200 after the changes. Chrome visual verification is still unavailable.

## Content channel clarity pass — 2026-11-15

- Added a bilingual note under the channel selector explaining that selected networks create planned calendar posts; they do not connect social accounts or publish. This clarifies the boundary of the current local workflow.
- ESLint, TypeScript, i18n JSON parsing, and `git diff --check` passed.

## Dashboard navigation pass — 2026-11-15

- Source review found that the section visibility map had not been updated after Analytics and Competitor Intelligence were added. Those modules could remain visible while navigating to Calendar, Approvals, Brands, or Team, making the selected destination feel like a long mixed page.
- Updated the visibility map: Overview keeps the dashboard modules; Calendar and Approvals show the calendar with shared filters; Analytics shows publication analytics and competitor monitoring with shared filters; Brands and Team each show only their own area.
- The browser surface was not available for a safe visual pass in this session. The change is source-reviewed and requires a later viewport and click-through check against the running app.

## Brand setup follow-through — 2026-11-16

- After creating a brand, the Brands area now offers optional next steps to connect social networks or complete the Brand Kit, plus a dismiss action. Each shortcut opens the existing manager for that brand and scrolls it into view; neither shortcut initiates an OAuth flow or changes brand data by itself.
- The prompt is scoped to the active organization and hidden if the new brand is no longer active. PT/EN copy and a narrow-screen stacked layout are included.
- TypeScript, focused ESLint, unit tests, production build, and `git diff --check` passed. Browser click-through and responsive visual review remain unverified in this turn.

## Narrow-screen navigation pass — 2026-11-16

- Added a localized hint for the month calendar's horizontal scroll on narrow screens. The asset table now keeps the file column visible while its metadata columns scroll, with a localized instruction when the viewport is narrow.
- The asset table retains its complete sortable columns and page controls; the responsive treatment improves orientation without hiding metadata.
- CSS and source checks passed; actual viewport rendering remains unverified in a browser.

## Workspace naming pass — 2026-11-16

- Added workspace name settings under the profile area. The owner can update the display name; the stable slug is shown as read-only and remains unchanged, preserving links and integrations. Other roles see the current name and a clear permission explanation.
- The API resolves the active organization from the authenticated session, requires the organization-management permission, validates bounded input, and delegates the update to Better Auth. The browser cannot submit an organization ID or slug.
- The existing demo workspace record was not renamed. Unit tests cover the input and response schemas; TypeScript, lint, unit tests, production build, and `git diff --check` passed. Browser interaction remains unverified.

## Asset table compact view — 2026-11-16

- The asset library now switches to compact cards on narrow screens. Each card keeps the filename, source, status actions, and a disclosure for rights, format, dimensions, checksum, and upload metadata. The full sortable table remains on larger screens.
- This compact mobile view replaces the earlier pinned-column-only treatment for the asset library; calendar month view still uses its own horizontal-scroll hint.
- Compact view retains the shared filter and page-size controls and adds a localized sort-column selector plus direction toggle covering every table column.
- TypeScript, focused ESLint, unit tests, production build, and `git diff --check` passed. Browser visual verification is still pending.

## Per-brand setup status — 2026-11-16

- Brand rows now summarize the latest Brand Kit version and social connection health, including connected and reauthentication-required profile counts. This gives the owner a clear setup state before opening either manager.
- Brand Kit status is selected from version records scoped to the active organization. The list response carries no content or credential material; only the latest version status is shown. The existing setup panel and controls remain available.
- Browser automation is unavailable in this environment, so visual review remains pending.

## Campaign handoff — 2026-11-16

- After a campaign is planned, the confirmation clarifies that its posts are not published yet and offers a direct action to prepare the first post.
- The action opens the created calendar item using its returned ID, brand, network, and planned time. Existing calendar navigation handles loading and selection, so the workflow does not create a second draft or initiate publication.
- TypeScript, focused ESLint, translation JSON parsing, and `git diff --check` passed. Browser click-through remains unverified because the browser connector is unavailable.

## Approval readiness — 2026-11-16

- The content editor now lists only the approval blockers that apply to the selected post: creating or saving its current version, pending media review, choosing or connecting a publishing account, or an existing approval request for that version.
- The guidance comes from the scoped calendar response plus the editor's unsaved state. It does not infer publication readiness from client-only brand/network assumptions, and the server remains authoritative when approval is submitted.
- TypeScript, focused ESLint, translation JSON parsing, and `git diff --check` passed. Browser interaction and visual review remain pending.

## Sign-in and password recovery — 2026-11-16

- Added a localized “Remember me” option to both regular sign-in and invitation sign-in and passed its value to Better Auth. It defaults to checked, matching Better Auth's persistent-session default; unchecking requests a session that is not remembered.
- The sign-in screen's recovery action now presents a distinct recovery title and instructions. The generic confirmation points users to their inbox and spam folder, then offers a resend action; changing the email clears the confirmation. The one-hour token expiry, bilingual email templates, and reset page remain in use; password reset revokes existing sessions.
- Password creation and reset forms now state the minimum length next to the field, using the same shared limit as client-side validation.
- A shared password field now lets users reveal or hide the value in sign-in, invitation, reset, and account password forms. The toggle has localized accessible names and a visible keyboard focus state.
- Invitation sign-in now offers password recovery without losing the invitation context. The reset link returns to the pending invitation after the password is changed.
- TypeScript, focused ESLint, translation JSON parsing, and `git diff --check` passed. Actual delivery still depends on SMTP being configured; browser/email click-through was not exercised.
