import { defineConfig, devices } from '@playwright/test'

const port = Number(process.env.PORT ?? 3460)
const silencerMode =
  process.env.NEXT_PUBLIC_NEXT_HYDRATION_SILENCER === 'disabled'
    ? 'disabled'
    : 'enabled'

export default defineConfig({
  projects: [
    {
      name: silencerMode,
      use: {
        ...devices['Desktop Chrome'],
        baseURL: `http://localhost:${port}`,
      },
    },
  ],
  testDir: './tests',
  webServer: {
    command: `pnpm exec kill-port ${port} || true && NEXT_PUBLIC_NEXT_HYDRATION_SILENCER=${silencerMode} pnpm exec next dev -p ${port}`,
    reuseExistingServer: false,
    timeout: 120_000,
    url: `http://localhost:${port}`,
  },
})
