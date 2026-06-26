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
- **App composition** ([src/main.ts](src/main.ts)): standard Vue setup wiring Pinia and Vue Router into the root `App.vue`.
- **Router** ([src/router/index.ts](src/router/index.ts)) and **stores** ([src/stores/](src/stores/)): currently scaffold-only (`routes: []`, a sample `counter` store). Real routes and stores go here.

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
