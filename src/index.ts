type ConsoleMethod = 'error' | 'warn'
type HydrationPattern = string | RegExp
type OriginalConsoleMethod = (...args: unknown[]) => void

const STATE_KEY = Symbol.for('next-hydration-silencer.console-state')
const DEFAULT_HYDRATION_PATTERNS: HydrationPattern[] = [
  'react.dev/link/hydration-mismatch',
  'A tree hydrated but some attributes',
  'Hydration failed because the server rendered',
]

type SuppressedHydrationWarning = {
  method: ConsoleMethod
  args: unknown[]
}

type HydrationSilencerState = {
  installed: boolean
  originalError: OriginalConsoleMethod
  originalWarn: OriginalConsoleMethod
  onSuppressed?: HydrationSilencerOptions['onSuppressed']
  patterns: HydrationPattern[]
}

type GlobalWithHydrationSilencer = typeof globalThis & {
  [STATE_KEY]?: HydrationSilencerState
}

export type HydrationSilencerOptions = {
  /**
   * Enables or disables the console filter.
   *
   * When omitted, the filter is enabled in development and in production only
   * when `NEXT_PUBLIC_NEXT_HYDRATION_SILENCER=enabled`.
   *
   * @example
   * installHydrationSilencer({ enabled: process.env.NODE_ENV === 'development' })
   */
  enabled?: boolean

  /**
   * Additional message signatures to suppress.
   *
   * The built-in React hydration mismatch signatures always stay active; this
   * list is additive so custom framework wrappers can be filtered without
   * weakening the default safety boundary.
   *
   * @example
   * installHydrationSilencer({ patterns: [/custom hydration warning/i] })
   */
  patterns?: HydrationPattern[]

  /**
   * Observes suppressed messages without re-printing them.
   *
   * Use this for counters or diagnostics when a team wants the console quiet
   * but still wants to know whether the filter is catching anything.
   *
   * @param event - The console method and original arguments that were hidden.
   * @returns Nothing.
   * @example
   * installHydrationSilencer({
   *   onSuppressed: ({ method, args }) => metrics.count(method, args.length),
   * })
   */
  onSuppressed?: (event: SuppressedHydrationWarning) => void
}

/**
 * Installs an idempotent console filter for known React hydration mismatch output.
 *
 * The filter only intercepts `console.error` and `console.warn` messages whose
 * text includes a known hydration mismatch signature. It does not change React,
 * DOM patching, Suspense fallback behavior, or Next.js rendering behavior.
 *
 * @param options - Runtime controls for enabling and extending the filter.
 * @returns A cleanup function that restores the original console methods.
 * @example
 * import { installHydrationSilencer } from 'next-hydration-silencer'
 *
 * installHydrationSilencer({
 *   enabled: process.env.NODE_ENV === 'development',
 * })
 */
export function installHydrationSilencer(
  options: HydrationSilencerOptions = {},
): () => void {
  if (!resolveEnabled(options.enabled)) {
    return () => undefined
  }

  const state = getHydrationSilencerState()
  state.patterns = buildPatternList(options.patterns)
  state.onSuppressed = options.onSuppressed

  if (state.installed) {
    return restoreHydrationSilencer
  }

  state.originalError = console.error
  state.originalWarn = console.warn

  console.error = createFilteredConsoleMethod('error', state)
  console.warn = createFilteredConsoleMethod('warn', state)
  state.installed = true

  return restoreHydrationSilencer
}

/**
 * Restores `console.error` and `console.warn` if this package installed wrappers.
 *
 * Calling this function multiple times is safe. It is mostly useful for tests,
 * Storybook decorators, and temporary local debugging sessions.
 *
 * @returns Nothing.
 * @example
 * const restore = installHydrationSilencer({ enabled: true })
 * restore()
 */
export function restoreHydrationSilencer(): void {
  const state = getHydrationSilencerState()

  if (!state.installed) {
    return
  }

  console.error = state.originalError
  console.warn = state.originalWarn
  state.installed = false
  state.onSuppressed = undefined
  state.patterns = DEFAULT_HYDRATION_PATTERNS
}

/**
 * Resolves the default environment toggle used by the side-effect register entry.
 *
 * @param explicitEnabled - A caller-provided override, if any.
 * @returns Whether the console filter should be installed.
 * @example
 * resolveEnabled(undefined) // true in development, false in production
 */
function resolveEnabled(explicitEnabled: boolean | undefined): boolean {
  if (typeof explicitEnabled === 'boolean') {
    return explicitEnabled
  }

  const explicitEnv = readPublicToggleEnvValue()

  // Environment overrides let teams enable or disable the filter without code changes.
  if (isEnabledEnvValue(explicitEnv)) {
    return true
  }

  if (isDisabledEnvValue(explicitEnv)) {
    return false
  }

  return readNodeEnvValue() === 'development'
}

/**
 * Reads the public client toggle with a direct env reference that Next can replace.
 *
 * @returns The string value when available.
 * @example
 * readPublicToggleEnvValue()
 */
function readPublicToggleEnvValue(): string | undefined {
  return typeof process !== 'undefined'
    ? process.env.NEXT_PUBLIC_NEXT_HYDRATION_SILENCER
    : undefined
}

/**
 * Reads `NODE_ENV` with a direct env reference that bundlers can replace.
 *
 * @returns The current build/runtime mode when available.
 * @example
 * readNodeEnvValue()
 */
function readNodeEnvValue(): string | undefined {
  return typeof process !== 'undefined' ? process.env.NODE_ENV : undefined
}

/**
 * Detects truthy environment values used by deployment systems and shells.
 *
 * @param value - The environment value to normalize.
 * @returns Whether the value explicitly enables the filter.
 * @example
 * isEnabledEnvValue('enabled') // true
 */
function isEnabledEnvValue(value: string | undefined): boolean {
  return value === 'enabled' || value === 'true' || value === '1'
}

/**
 * Detects falsey environment values used by deployment systems and shells.
 *
 * @param value - The environment value to normalize.
 * @returns Whether the value explicitly disables the filter.
 * @example
 * isDisabledEnvValue('disabled') // true
 */
function isDisabledEnvValue(value: string | undefined): boolean {
  return value === 'disabled' || value === 'false' || value === '0'
}

/**
 * Builds the active signature list from the built-ins plus caller additions.
 *
 * @param customPatterns - Additional string or RegExp signatures.
 * @returns The full ordered pattern list used during console filtering.
 * @example
 * buildPatternList(['custom'])
 */
function buildPatternList(customPatterns: HydrationPattern[] = []) {
  return [...DEFAULT_HYDRATION_PATTERNS, ...customPatterns]
}

/**
 * Creates a stable shared state object for repeated imports and Fast Refresh.
 *
 * @returns The process-wide/browser-wide silencer state.
 * @example
 * const state = getHydrationSilencerState()
 */
function getHydrationSilencerState(): HydrationSilencerState {
  const globalScope = globalThis as GlobalWithHydrationSilencer

  globalScope[STATE_KEY] ??= {
    installed: false,
    originalError: console.error,
    originalWarn: console.warn,
    patterns: DEFAULT_HYDRATION_PATTERNS,
  }

  return globalScope[STATE_KEY]
}

/**
 * Wraps one console method while preserving the original call signature.
 *
 * @param method - The console method to wrap.
 * @param state - Shared install state containing originals and match settings.
 * @returns A console method replacement.
 * @example
 * console.error = createFilteredConsoleMethod('error', state)
 */
function createFilteredConsoleMethod(
  method: ConsoleMethod,
  state: HydrationSilencerState,
): typeof console.error {
  return function filteredConsoleMethod(this: Console, ...args: unknown[]) {
    if (findMatchingPattern(args, state.patterns)) {
      notifySuppressedHydrationWarning(method, args, state)
      return
    }

    const original = method === 'error' ? state.originalError : state.originalWarn
    original.apply(this, args)
  }
}

/**
 * Calls the optional observer and protects the application from observer failures.
 *
 * @param method - The console method that was suppressed.
 * @param args - The original console arguments.
 * @param state - Shared install state with the original `console.error`.
 * @returns Nothing.
 * @example
 * notifySuppressedHydrationWarning('error', ['message'], state)
 */
function notifySuppressedHydrationWarning(
  method: ConsoleMethod,
  args: unknown[],
  state: HydrationSilencerState,
) {
  try {
    state.onSuppressed?.({ method, args })
  } catch (error) {
    state.originalError.call(
      console,
      '[next-hydration-silencer] onSuppressed callback failed',
      error,
    )
  }
}

/**
 * Finds the first pattern that matches a combined console message.
 *
 * @param args - The original console arguments.
 * @param patterns - String and RegExp signatures to test.
 * @returns The matching pattern, if any.
 * @example
 * findMatchingPattern(['https://react.dev/link/hydration-mismatch'], patterns)
 */
function findMatchingPattern(
  args: unknown[],
  patterns: HydrationPattern[],
): HydrationPattern | undefined {
  const message = args.map(formatConsoleArgument).join(' ')

  return patterns.find((pattern) => {
    if (typeof pattern === 'string') {
      return message.includes(pattern)
    }

    pattern.lastIndex = 0
    return pattern.test(message)
  })
}

/**
 * Converts arbitrary console arguments into searchable text.
 *
 * @param value - One original console argument.
 * @returns A stable text representation for substring and RegExp matching.
 * @example
 * formatConsoleArgument(new Error('boom')) // "boom ..."
 */
function formatConsoleArgument(value: unknown): string {
  if (typeof value === 'string') {
    return value
  }

  if (value instanceof Error) {
    return [value.message, value.stack].filter(Boolean).join(' ')
  }

  return String(value)
}
