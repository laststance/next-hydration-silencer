import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  installHydrationSilencer,
  restoreHydrationSilencer,
} from '../src/index'

const REAL_NODE_ENV = process.env.NODE_ENV
const REAL_PUBLIC_TOGGLE = process.env.NEXT_PUBLIC_NEXT_HYDRATION_SILENCER
const REAL_ERROR = console.error
const REAL_WARN = console.warn

describe('next-hydration-silencer', () => {
  let errorSpy: ReturnType<typeof vi.fn>
  let warnSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    restoreHydrationSilencer()
    process.env.NODE_ENV = 'test'
    delete process.env.NEXT_PUBLIC_NEXT_HYDRATION_SILENCER

    errorSpy = vi.fn()
    warnSpy = vi.fn()
    console.error = errorSpy as unknown as typeof console.error
    console.warn = warnSpy as unknown as typeof console.warn
  })

  afterEach(() => {
    restoreHydrationSilencer()
    console.error = REAL_ERROR
    console.warn = REAL_WARN
    process.env.NODE_ENV = REAL_NODE_ENV

    if (typeof REAL_PUBLIC_TOGGLE === 'string') {
      process.env.NEXT_PUBLIC_NEXT_HYDRATION_SILENCER = REAL_PUBLIC_TOGGLE
    } else {
      delete process.env.NEXT_PUBLIC_NEXT_HYDRATION_SILENCER
    }
  })

  it('suppresses React 19 attribute hydration mismatch output', () => {
    installHydrationSilencer({ enabled: true })

    console.error(
      "A tree hydrated but some attributes of the server rendered HTML didn't match the client properties. This won't be patched up.\n\n%s%s",
      'https://react.dev/link/hydration-mismatch',
      '\n  <App>\n+   className="client"\n-   className="server"',
    )

    expect(errorSpy).not.toHaveBeenCalled()
  })

  it("suppresses React 19 server rendered HTML didn't match output", () => {
    installHydrationSilencer({ enabled: true })

    console.error(
      new Error(
        "Hydration failed because the server rendered HTML didn't match the client. As a result this tree will be regenerated on the client.\n\nhttps://react.dev/link/hydration-mismatch",
      ),
    )

    expect(errorSpy).not.toHaveBeenCalled()
  })

  it('preserves unrelated console.error, console.warn, and custom app logs', () => {
    installHydrationSilencer({ enabled: true })

    console.error('unrelated application error', { feature: 'billing' })
    console.warn('unrelated application warning', 42)

    expect(errorSpy).toHaveBeenCalledTimes(1)
    expect(errorSpy).toHaveBeenCalledWith('unrelated application error', {
      feature: 'billing',
    })
    expect(warnSpy).toHaveBeenCalledTimes(1)
    expect(warnSpy).toHaveBeenCalledWith('unrelated application warning', 42)
  })

  it('does not catch or change thrown errors', () => {
    installHydrationSilencer({ enabled: true })

    expect(() => {
      throw new Error('Hydration failed because the server rendered HTML')
    }).toThrow('Hydration failed because the server rendered HTML')
    expect(errorSpy).not.toHaveBeenCalled()
  })

  it('installs idempotently and restores the original console methods', () => {
    installHydrationSilencer({ enabled: true })
    const firstErrorWrapper = console.error
    const firstWarnWrapper = console.warn

    const restore = installHydrationSilencer({ enabled: true })

    expect(console.error).toBe(firstErrorWrapper)
    expect(console.warn).toBe(firstWarnWrapper)

    restore()

    expect(console.error).toBe(errorSpy)
    expect(console.warn).toBe(warnSpy)
  })

  it('supports additional custom patterns and onSuppressed observers', () => {
    const onSuppressed = vi.fn()

    installHydrationSilencer({
      enabled: true,
      onSuppressed,
      patterns: [/custom hydration warning/i],
    })

    console.warn('Custom hydration warning from a framework adapter', {
      route: '/dashboard',
    })

    expect(warnSpy).not.toHaveBeenCalled()
    expect(onSuppressed).toHaveBeenCalledWith({
      method: 'warn',
      args: [
        'Custom hydration warning from a framework adapter',
        { route: '/dashboard' },
      ],
    })
  })

  it('uses development as the default enabled environment', () => {
    process.env.NODE_ENV = 'development'

    installHydrationSilencer()
    console.error('https://react.dev/link/hydration-mismatch')

    expect(errorSpy).not.toHaveBeenCalled()
  })

  it('supports production opt-in through NEXT_PUBLIC_NEXT_HYDRATION_SILENCER', () => {
    process.env.NODE_ENV = 'production'
    process.env.NEXT_PUBLIC_NEXT_HYDRATION_SILENCER = 'enabled'

    installHydrationSilencer()
    console.warn('https://react.dev/link/hydration-mismatch')

    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('supports explicit environment disablement', () => {
    process.env.NODE_ENV = 'development'
    process.env.NEXT_PUBLIC_NEXT_HYDRATION_SILENCER = 'disabled'

    installHydrationSilencer()
    console.error('https://react.dev/link/hydration-mismatch')

    expect(errorSpy).toHaveBeenCalledTimes(1)
  })

  it('reports observer failures through the original console.error', () => {
    installHydrationSilencer({
      enabled: true,
      onSuppressed: () => {
        throw new Error('observer failed')
      },
    })

    console.error('https://react.dev/link/hydration-mismatch')

    expect(errorSpy).toHaveBeenCalledTimes(1)
    expect(errorSpy).toHaveBeenCalledWith(
      '[next-hydration-silencer] onSuppressed callback failed',
      expect.any(Error),
    )
  })
})
