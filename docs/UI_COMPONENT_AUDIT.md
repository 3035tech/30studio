# UI component and field audit

Date: 2026-11-15
Scope: shared controls and all current product forms, calendar date/time entry, field validation, and application typography.

## Acceptance

- Feature components use the shared product controls; semantic HTML controls remain encapsulated and fully styled inside those controls.
- Selects share one appearance, and dates use an application calendar in both locales.
- Field constraints match value types and server schemas. Integer form values are parsed as safe integers before entering numeric request payloads.
- Typography uses a shared scale instead of scattered pixel sizes.

## Findings and changes

- All feature selects, text inputs, textareas, checkboxes, and file inputs already used `components/ui/field.tsx`; that module had inconsistent feedback markup and relied on default select appearance. Consolidated labels, required markers, descriptions, invalid states, sizing, typography, and the select indicator there.
- Made field IDs required by the component types and limited `TextField` to text-like input types. Number, date, time, checkbox, and file controls must use their dedicated shared components.
- Replaced native date entry with a reusable bilingual calendar field. It displays a locale formatted date, submits an ISO date value, supports min/max dates, and provides clear, previous-month, and next-month actions.
- The date picker follows the locale's week start and supports roving keyboard focus with arrow keys, Home/End, and PageUp/PageDown navigation.
- Replaced native time entry with a shared `HH:MM` mask and 24-hour validation. Email and URL fields keep semantic input types and their browser validity rules; slugs keep their normalization and pattern validation.
- Localized browser constraint messages for required, email, URL, number, range, step, length, and pattern errors. Invalid controls expose `aria-invalid` and clear the native validity state as the user corrects the value.
- Added a dedicated integer field with numeric input mode, integer step, required and range constraints. A shared parser rejects missing, non-integer, unsafe, and non-string FormData values before request schemas receive the number. API schemas remain strict numeric schemas.
- Changed the Brand Kit URL limit from the unrelated 256-character source count to an explicit 2,048-character URL limit in both the form and Zod schema.
- Replaced pixel font sizes in the application stylesheet with a shared responsive type scale based on the approved Inter and Sora font tokens.
- Converted the remaining feature-level raw buttons in analytics and calendar to the shared Button component.

## Regression follow-up

- The first date/time field pass added helper rows by default. In the calendar form, those rows made the date/time columns taller than neighboring fields and broke the row alignment. Removed the redundant helper rows; the localized placeholder and calendar dialog communicate the input format, and all fields return to the same control height.
- Adjusted the shared type tokens to preserve the existing hierarchy more closely while keeping typography centralized.
- The app initially returned a Next.js module resolution error for `components/ui/disclosure`. The file existed both in the workspace and inside the web container; restarting only the local web container cleared the stale compiler state, and `/pt` returned HTTP 200 afterward. No database container was restarted.
- Visual inspection reached the sign-in and first-workspace onboarding screens after the container restart. The local demo user has no workspace; no tenant, brand, invitation, or publication was created to access the dashboard. The login form and onboarding fields were aligned in the inspected desktop viewport; keyboard, mobile, and dashboard layouts still need direct review.

## Verification and limits

- The source inventory finds no feature-level native `select` or `textarea`; the only visual `select` is encapsulated by the shared field control. Hidden inputs are used only to submit ISO date/time values from the custom controls.
- Focused ESLint, TypeScript, locale JSON parsing, and `git diff --check` pass.
- A live browser visual and keyboard review remains outstanding; the browser connection was unavailable during the preceding audit pass.
