# 30studio product brand

Status: official product identity kit v1 integrated in the application shell.

## Identity

- Product: 30studio
- Concept: **Play Criativo**. The play mark inside the zero represents creation, production, and publishing.
- Tagline (pt-BR): **Crie, planeje e publique com inteligência.**
- Brand kit source: `30studio-brand-kit.zip`, provided for this project.

## Brand assets

The complete source set is preserved under `public/brand/`:

- `logos/`: default, light, on-light, and on-dark logo lockups in PNG and SVG.
- `icons/`: favicon and square icons for browser, Apple touch, and PWA sizes, including light, dark, and transparent variants.
- `branding/tokens.json` and `branding/tokens.css`: approved brand color and font tokens.
- `site.webmanifest`: PWA name, colors, and 192/512 icons.

The application uses the PNG wordmark to preserve the kit's exact letter shapes across machines. On light surfaces it uses `logo-default.png`; on dark surfaces it uses the transparent white `logo-light.png`. Keep SVG versions for vector design and export workflows. The source SVG wordmark contains editable text and may render differently when its specified font is unavailable.

`components/ui/brand-logo.tsx` is the shared application wordmark. `lib/constants.ts` owns public asset paths. Favicon, Apple touch icon, manifest, Open Graph, and Twitter metadata are configured in the Next.js root metadata.

## Tokens and typography

| Token | Value | Use |
|---|---|---|
| Primary | `#6A00FF` | Main actions, focus, and active states |
| Accent | `#FF8A00` | Secondary emphasis; pair with dark text when used as a fill |
| Dark | `#0B1B3B` | Main text and dark surfaces |
| Secondary | `#8B5CF6` | Supporting highlights |
| Surface | `#F8FAFC` | Light page background |
| Text | `#0B1B3B` | Main text on light surfaces |

- Display: Sora.
- Interface: Inter.
- Both variable WOFF2 Latin subsets are served locally from `public/fonts/`; no browser request goes to Google Fonts.
- Font licenses are included next to each binary as `public/fonts/{sora,inter}/OFL.txt`.
- `app/globals.css` imports the official CSS tokens and maps them into Tailwind CSS v4's CSS-first theme. Components should use these theme utilities instead of repeating brand hex values.

## Interface rules

- Use the approved wordmark and icons; do not redraw them, recolor the play mark, stretch the aspect ratio, or use temporary text as a replacement logo.
- Select the light or dark logo variant for the actual surface. Keep adequate clear space and don't place the wordmark over busy imagery.
- Keep body copy in Inter and headings in Sora. Use the shared `Button`, `TextField`, `SelectField`, and `BrandLogo` components rather than unstyled browser controls.
- Use the primary purple for high-priority actions. Use the orange accent sparingly and preserve readable contrast; never make color the only status cue.
- Preserve visible keyboard focus, responsive layouts, reduced-motion preferences, and both system light/dark modes.
- User-facing copy remains in the `pt` and `en` next-intl catalogs. Translate the tagline and metadata per locale.

## Verification and pending brand work

- The application shell, authentication entry, organization onboarding, and initial brand list use the official assets and tokens.
- Verify at desktop and mobile widths, under light and dark system themes, and in both locales before considering the visual integration complete.
- The kit describes the logo art as original to the package but says it is not a faithful extraction from earlier conceptual mockups. This document records use of the delivered kit; it does not represent trademark registration or legal clearance.
- Brand Kits for customer-created brands are separate tenant data. Never apply the 30studio product identity as a customer's Brand Kit by default.
