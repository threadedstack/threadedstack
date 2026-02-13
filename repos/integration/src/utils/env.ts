/**
 * Environment configuration for integration tests.
 *
 * Values are populated by loadEnvs() which reads from deploy/values.yaml
 * and ~/.config/tdsk/values.yaml via @keg-hub/parse-config.
 *
 * Integration-specific env vars use the TDSK_IT_ prefix.
 * Falls back to shared TDSK_ vars where appropriate.
 */
export const env = {
  /** Proxy base URL — Caddy routes to Proxy which routes to Backend */
  get proxyUrl() {
    return process.env.TDSK_IT_PROXY_URL
      || `https://${process.env.TDSK_CADDY_PX_HOST || 'px.local.threadedstack.app'}`
  },

  /** Admin SPA base URL */
  get adminUrl() {
    return process.env.TDSK_IT_ADMIN_URL
      || `http://localhost:${process.env.TDSK_AD_PORT || '5887'}`
  },

  /** API key for authenticating through the proxy (required) */
  get testApiKey() {
    return process.env.TDSK_IT_API_KEY || ''
  },

  /** Org ID to use for tests (required) */
  get testOrgId() {
    return process.env.TDSK_IT_ORG_ID || ''
  },

  /** User ID associated with the test API key */
  get testUserId() {
    return process.env.TDSK_IT_USER_ID || 'integration-test-user'
  },

  /** Neon Auth URL pattern for Playwright interception */
  neonAuthPattern: '**/neondb/auth/get-session**',
} as const
