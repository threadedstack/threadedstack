import { env } from './env'

/**
 * Creates a test-only object satisfying the AuthManager interface.
 * Avoids ConfigService or filesystem interaction — credentials come from env.
 */
export const createTestAuth = (overrides?: {
  apiKey?: string
  proxyUrl?: string
  insecure?: boolean
}) => ({
  creds: () => ({
    apiKey: overrides?.apiKey ?? env.testApiKey,
    proxyUrl: overrides?.proxyUrl ?? env.proxyUrl,
    insecure: overrides?.insecure ?? true,
  }),
  loggedIn: () => true,
  login: async () => {},
  logout: () => {},
})
