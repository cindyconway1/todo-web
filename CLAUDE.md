# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

`todo-web` — a Vue 3 + Vite single-page app that talks to a separate ToDo backend through a fully typed API client. The frontend lives here; the backend and its OpenAPI contract live in the sibling repo `../todo-agentic-poc`.

## Commands

```sh
npm install          # uses legacy-peer-deps=true (set in .npmrc)
npm run dev          # Vite dev server with HMR + vue-devtools
npm run build        # type-check (vue-tsc) + production build, run in parallel
npm run test:unit    # Vitest (jsdom). Add a path/pattern to scope: npm run test:unit App
npm run lint         # runs lint:oxlint then lint:eslint, both with --fix
npm run format       # Prettier over src/
npm run type-check   # vue-tsc --build only
npm run gen:api      # regenerate src/api/schema.d.ts from the backend contract
```

CI (`.github/workflows/ci.yml`) runs `lint`, `test:unit`, and `build` on PRs and pushes to `main`. Match that locally before pushing. API calls are mocked in unit tests.

## Architecture

- **Typed API client** ([src/api/client.ts](src/api/client.ts)): a single `api` instance from `openapi-fetch`, typed against the `paths` from `src/api/schema.d.ts`, with `baseUrl` from `VITE_API_URL`. Import `{ api }` from `@/api/client` to make backend calls — types (paths, params, bodies, responses) are enforced at compile time.
- **Generated schema** ([src/api/schema.d.ts](src/api/schema.d.ts)): **auto-generated, never edit by hand.** It is produced by `npm run gen:api`, which reads `../todo-agentic-poc/ToDo.Api.json` (the backend's OpenAPI spec) via `openapi-typescript`. When the backend contract changes, regenerate this file rather than editing types manually.
- **App composition** ([src/main.ts](src/main.ts)): wires Pinia and Vue Router into the root `App.vue`, registers the 401 handler (`setUnauthorizedHandler` redirects to `/login`), and primes both the auth state and the antiforgery token before mount.
- **Auth & antiforgery**: session state lives in [src/stores/auth.ts](src/stores/auth.ts); the backend uses HttpOnly cookie sessions, so mutating calls need an antiforgery token, handled by [src/api/xsrf.ts](src/api/xsrf.ts) and [src/composables/useAntiforgery.ts](src/composables/useAntiforgery.ts).
- **Router** ([src/router/index.ts](src/router/index.ts)): eight named, lazy-loaded routes — `Login`, `Register`, `Dashboard`, `Leagues`, `Teams`, `Volunteers`, `ListDetail`, `AllItems` — plus a `beforeEach` guard that awaits `primeAuth()` and bounces unauthenticated users to `Login` (and authenticated users off the public routes).
- **Stores** ([src/stores/](src/stores/)): one Pinia store per domain entity — `auth`, `league`, `team`, `volunteer`, `todoItem`, `priority`, `dashboard`, `allItems` — plus the shared [entityError](src/stores/entityError.ts) helper. The Vue template's sample `counter` store is gone; model new stores on the existing ones, not on it.
- **Views and components**: route-level views in [src/views/](src/views/) (one per route, `View` suffix), reusable pieces in [src/components/](src/components/) (`ItemRow`, `ItemEditor`, `PriorityBadge`, `TagPicker`), shared non-UI helpers in [src/composables/](src/composables/) and [src/utils/](src/utils/).

The `@` import alias maps to `src/` (configured in [vite.config.ts](vite.config.ts) and the tsconfigs).

## Conventions

- **Single-file components**: always use `<script setup lang="ts">` and `<style scoped>`. No Options API, no global (unscoped) component styles.
- **Imports**: always use the `@/` alias, never relative paths like `./Foo.vue`. Use `import type { … }` for type-only imports.
- **Domain-specific rules** live in nested CLAUDE.md files: stores ([src/stores/CLAUDE.md](src/stores/CLAUDE.md)) and routing ([src/router/CLAUDE.md](src/router/CLAUDE.md)). In short — one Pinia store per domain entity, stores own all `api` calls, components never call `@/api/client` directly, and route components are lazy-loaded.
- **Environment**: `VITE_API_URL` points at the backend (e.g. `https://localhost:7075` in `.env.development`). Only `VITE_`-prefixed vars are exposed to the client.
- **Linting is two-pass**: `oxlint` (correctness category, see [.oxlintrc.json](.oxlintrc.json)) runs first, then ESLint (flat config in [eslint.config.ts](eslint.config.ts), which also disables rules oxlint already covers). Prettier handles formatting and is kept out of lint via `eslint-config-prettier`.
- **Line endings**: enforced LF via `.gitattributes` (`* text=auto eol=lf`).
- **Tests** live in `src/**/__tests__/`, use `@vue/test-utils` `mount`, and run under jsdom.
- **Mock the API, never hit a live backend in tests.** Stub `api` calls (e.g. mock `@/api/client`) and type the mocked requests/responses against the generated `src/api/schema.d.ts` types — they are the source of truth, so don't hand-write ad-hoc response shapes. Tests must run offline; never call `VITE_API_URL` or a real server.

## Reuse before you add

> **Template note — this section must be carried forward.** `todo-web` is a
> proof-of-concept template. When these files seed a real repo, copy this section
> into that repo's CLAUDE.md. It governs any agent writing code, so it applies to
> a developer's local Claude Code session exactly as it does to a pipeline run —
> which makes it *more* important, not less, in a repo where most AI-assisted work
> happens on a dev machine and arrives as a human-opened PR.

- **Look for the existing thing first.** Before adding a store action, composable,
  util, or component, search for one that already does the job and extend it.
  Duplicated logic is a defect here even when both copies work.
- **Match the established shape.** New stores follow the existing stores, new views
  follow the existing views, new tests follow the existing tests. Consistency beats
  local cleverness.
- **Restructuring is proposed, not performed.** If the clean implementation would
  need a change outside the current scope — splitting a store, extracting a shared
  composable, moving a util — say so in the PR description and implement within the
  existing structure. A refactor is its own ticket with its own review. Never bundle
  one into a feature PR.

## Design system

**Any task that affects look and feel MUST follow [docs/design-system.md](docs/design-system.md).** The aesthetic is GitHub dark-mode (Primer-inspired) with purple accents, built on **Tailwind CSS v4** (configured in CSS — no `tailwind.config.js`). Icons come from **`@lucide/vue`**.

Color tokens are defined once in [src/assets/main.css](src/assets/main.css) and exposed as **semantic Tailwind utilities** — use them, **never hardcode hex values** (that also keeps a future light theme swappable):

- Backgrounds: `bg-canvas` (page), `bg-card` (panels)
- Borders: `border-subtle` (1px borders instead of shadows — never harsh black)
- Text: `text-default` (primary), `text-muted` (secondary)
- Accent (use sparingly — buttons, active/focus, icons): `bg-accent` / `text-accent` / `ring-accent`, hover `bg-accent-hover`
- Completed/success: `text-success` / `bg-success`; errors/destructive: `text-danger` / `border-danger`

Cards use `rounded-md` + `border border-subtle`; inputs get a purple focus ring (`focus:ring-2 focus:ring-accent`); buttons animate color on hover (`transition-colors duration-150`); interactive icons get purposeful `transition-transform duration-150` — no gratuitous motion. See the doc for full component patterns.
