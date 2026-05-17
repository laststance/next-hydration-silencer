import type { ReactNode } from 'react'

import './styles.css'

type RootLayoutProps = {
  children: ReactNode
}

/**
 * Provides the minimum document shell for the integration example.
 *
 * @param props - The page content rendered by the App Router.
 * @returns A complete HTML document.
 * @example
 * <RootLayout>content</RootLayout>
 */
export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
