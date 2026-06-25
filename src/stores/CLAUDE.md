# CLAUDE.md — Pinia stores

Guidance for code in `src/stores/`.

## Conventions

- **One store per domain entity.** Each store maps to a single backend resource/domain concept (e.g. `useTodoStore`), not a grab-bag of unrelated state. Name stores `use<Entity>Store` and use the setup (function) syntax, matching the existing pattern.
- **Stores own all API calls.** Every call through the typed `@/api/client` `api` instance lives in a store action. Stores hold the fetched state and expose actions/getters for it.
- **Components never call `api` directly.** Components read state and invoke actions from stores; they must not import `@/api/client`. This keeps data-fetching and caching logic in one place per entity and out of the view layer.

> The sample `counter` store is scaffold from the Vue template — replace it; don't model real stores on its trivial shape.
