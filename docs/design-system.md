# Design system

The app follows a **GitHub dark-mode aesthetic** (inspired by GitHub's Primer design
system) with **purple accents**. This document is the reference for every task that
affects look and feel. The color tokens are defined once in
[src/assets/main.css](../src/assets/main.css) and exposed as semantic Tailwind
utilities — **use the utilities, never hardcode hex values.**

## Tooling

- **Tailwind CSS v4** (via `@tailwindcss/vite`) for all styling. There is no
  `tailwind.config.js` — v4 is configured in CSS. Tokens live in the `@theme` block of
  [src/assets/main.css](../src/assets/main.css).
- **Icons: `@lucide/vue`** (the maintained successor to `lucide-vue-next`). Clean,
  stroke-based icons that sit close to GitHub's own Octicons. Import per-icon, e.g.
  `import { Check } from '@lucide/vue'`.

## Color tokens

Each token is a semantic Tailwind color, so it works across `bg-*`, `text-*`,
`border-*`, `ring-*`, etc.

| Token utility  | Value (dark) | Use for                                                    |
| -------------- | ------------ | ---------------------------------------------------------- |
| `canvas`       | `#0d1117`    | Page background                                            |
| `card`         | `#161b22`    | Card / panel background                                    |
| `subtle`       | `#30363d`    | Borders — low-contrast, **never harsh black**              |
| `default`      | `#c9d1d9`    | Primary text                                               |
| `muted`        | `#8b949e`    | Secondary / muted text                                     |
| `accent`       | `#8957e5`    | Purple — primary actions, active & focus states, icons     |
| `accent-hover` | `#9e6ffc`    | Purple hover state                                         |
| `success`      | `#3fb950`    | Green — completed todos / success states                   |
| `danger`       | `#f85149`    | Red — errors / destructive states                          |

Examples: `bg-canvas`, `bg-card`, `border border-subtle`, `text-default`,
`text-muted`, `bg-accent`, `hover:bg-accent-hover`, `ring-accent`, `text-success`.

**Use the accent color sparingly** — buttons, active/focus states, and icons — never
as a full background wash.

## Layout

- **Containers/cards:** `rounded-md` (6–8px), a **1px border (`border border-subtle`)
  instead of shadows** — shadows barely read on dark backgrounds.
- **Spacing:** generous padding and vertical spacing between sections. Avoid cramped
  layouts.
- **Content width:** center forms and content in a max-width container
  (e.g. `mx-auto max-w-2xl`).

## Components

### Inputs

Dark background matching the page, a subtle border, and a **purple focus ring**:

```
class="bg-canvas border border-subtle rounded-md px-3 py-2 text-default
       placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent"
```

### Buttons

Always add a smooth color transition on hover (**150–200ms**).

- **Primary** — solid purple:
  ```
  class="bg-accent hover:bg-accent-hover text-white rounded-md px-4 py-2
         transition-colors duration-150"
  ```
- **Secondary** — dark background + border:
  ```
  class="bg-card border border-subtle hover:border-accent text-default rounded-md
         px-4 py-2 transition-colors duration-150"
  ```

## Icons & motion

- Use `@lucide/vue` for all icons.
- Add **subtle, purposeful** transitions on interactive icons — e.g. a todo's circle
  icon scaling or filling in when marked complete, or a hover scale on buttons — using
  `transition-transform` + `duration-150`.
- **Avoid gratuitous animation.** Motion should communicate state changes and hover
  feedback, not decorate.

## Consistency

Once a pattern is established here (or in an already-styled component), reuse it across
all pages and components rather than inventing a new variant.

## Theming

Dark is the only shipped theme, but tokens are structured to be swappable: raw values
live on `:root`, and `@theme inline` keeps `var()` references in the generated
utilities. A future light theme only needs the `[data-theme='light']` block in
[src/assets/main.css](../src/assets/main.css) filled in and `data-theme="light"` set on
`<html>`. **Do not** reintroduce hardcoded colors that would defeat this.
