import { expect, test } from '@playwright/test'

const HYDRATION_SIGNATURES = [
  'react.dev/link/hydration-mismatch',
  'A tree hydrated but some attributes',
  'Hydration failed because the server rendered',
]

/**
 * Checks whether a set of browser console messages contains a React hydration warning.
 * @param messages - Captured browser console message text.
 * @returns Whether any known hydration mismatch signature was observed.
 * @example
 * containsHydrationWarning(['https://react.dev/link/hydration-mismatch'])
 */
function containsHydrationWarning(messages: string[]) {
  const joinedMessages = messages.join('\n')

  return HYDRATION_SIGNATURES.some((signature) =>
    joinedMessages.includes(signature),
  )
}

test('filters hydration mismatch output while preserving unrelated errors', async ({
  page,
}, testInfo) => {
  const messages: string[] = []

  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      messages.push(message.text())
    }
  })

  await page.goto('/')
  await expect(page.getByRole('heading')).toHaveText(
    'next-hydration-silencer example',
  )
  await expect
    .poll(() => messages.join('\n'))
    .toContain('unrelated application error from next-hydration-silencer example')
  await page.waitForTimeout(750)

  if (testInfo.project.name === 'disabled') {
    expect(containsHydrationWarning(messages)).toBe(true)
    return
  }

  expect(containsHydrationWarning(messages)).toBe(false)
})
