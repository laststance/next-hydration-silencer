# next-hydration-silencer

Silence known React/Next.js hydration mismatch console noise from
`instrumentation-client.ts`.

This package is intentionally small: it only filters matching `console.error`
and `console.warn` output. It does **not** change React hydration, DOM patching,
Suspense recovery, or Next.js rendering behavior.

## Why

React can report hydration mismatch messages when a still-dehydrated boundary is
hydrated later, including after a user interaction. In some app surfaces, that
warning is useful. In others, it becomes repeated development noise after the
team has intentionally accepted the mismatch boundary.

Next.js `instrumentation-client.ts` runs after the HTML document is loaded but
before React hydration begins, so it is the safest place to install a console
filter before React can print hydration diagnostics.

## Install

```sh
pnpm add next-hydration-silencer
```

## Quick Start

Add this file at the root of your Next app or inside `src/`:

```ts
// instrumentation-client.ts
import 'next-hydration-silencer/register'
```

By default, the register entry enables the filter only in development.

Production opt-in is available when you really want it:

```sh
NEXT_PUBLIC_NEXT_HYDRATION_SILENCER=enabled
```

You can also disable it without code changes:

```sh
NEXT_PUBLIC_NEXT_HYDRATION_SILENCER=disabled
```

## Manual Setup

```ts
// instrumentation-client.ts
import { installHydrationSilencer } from 'next-hydration-silencer'

installHydrationSilencer({
  enabled:
    process.env.NODE_ENV === 'development' ||
    process.env.NEXT_PUBLIC_NEXT_HYDRATION_SILENCER === 'enabled',
})
```

## API

```ts
type HydrationSilencerOptions = {
  enabled?: boolean
  patterns?: Array<string | RegExp>
  onSuppressed?: (event: { method: 'error' | 'warn'; args: unknown[] }) => void
}

function installHydrationSilencer(
  options?: HydrationSilencerOptions,
): () => void

function restoreHydrationSilencer(): void
```

### `installHydrationSilencer(options?)`

Installs an idempotent wrapper around `console.error` and `console.warn`.

The built-in signatures are:

- `react.dev/link/hydration-mismatch`
- `A tree hydrated but some attributes`
- `Hydration failed because the server rendered`

`patterns` is additive. The built-in signatures always stay active.

```ts
installHydrationSilencer({
  enabled: true,
  patterns: [/custom hydration warning/i],
  onSuppressed: ({ method, args }) => {
    analytics.count('hydration_warning_suppressed', {
      method,
      argumentCount: args.length,
    })
  },
})
```

### `restoreHydrationSilencer()`

Restores the original console methods. This is mostly useful in tests,
Storybook decorators, and temporary debugging sessions.

## Notes

- This package hides console output only. If React client-renders a subtree after
  a mismatch, that behavior still happens.
- Next.js 16 can also forward browser logs into the dev terminal. If you want to
  remove that terminal mirror too, use `logging.browserToTerminal: false` in
  `next.config`.
- It is primarily designed for Next.js App Router 15/16 and React 18/19.
- Pages Router and non-Next React apps can use the manual API, but the timing is
  up to the host app.
- Keep this out of production unless the team has explicitly chosen that
  tradeoff.

## Development

```sh
pnpm install
pnpm typecheck
pnpm test
pnpm build
pnpm pack --dry-run
```

The `examples/next-app` folder contains a small Next 16 app with an intentional
hydration mismatch and Playwright checks for enabled/disabled behavior.
