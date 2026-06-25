# CLAUDE.md — Routing

Guidance for code in `src/router/`.

## Conventions

- **Lazy-load route components.** Define route `component` with a dynamic import (`component: () => import('@/views/TodoListView.vue')`) so each route is code-split, rather than statically importing the component at the top of the file.
- **Naming.** Give every route a `name` in PascalCase matching its view, and name route view components with a `View` suffix (e.g. `TodoListView.vue`). Use kebab-case for `path`.
- **Params as props.** Set `props: true` on route definitions so views receive route params as props; read params that way rather than from `$route.params`.
