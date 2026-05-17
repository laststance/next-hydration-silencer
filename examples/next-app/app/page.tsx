'use client'

import { useEffect } from 'react'

/**
 * Renders an intentional client/server attribute mismatch for integration checks.
 *
 * @returns A page that emits one hydration mismatch plus one unrelated app error.
 * @example
 * <Page />
 */
export default function Page() {
  const renderSide = typeof window === 'undefined' ? 'server' : 'client'

  useEffect(() => {
    console.error('unrelated application error from next-hydration-silencer example')
  }, [])

  return (
    <main className="shell" data-render-side={renderSide}>
      <h1>next-hydration-silencer example</h1>
      <p>
        This page intentionally renders a different <code>data-render-side</code>
        attribute on the server and client.
      </p>
    </main>
  )
}
