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

  /** Project ID to use for tests (required for tier2 UI tests) */
  get testProjectId() {
    return process.env.TDSK_IT_PROJECT_ID || ''
  },

  /** User ID associated with the test API key */
  get testUserId() {
    return process.env.TDSK_IT_USER_ID || 'integration-test-user'
  },

  /**
   * Agent ID with a real LLM provider key for live chat tests.
   * Required for tier3/llm-chat-flow tests. When not set, those tests are skipped.
   */
  get testAgentId() {
    return process.env.TDSK_IT_AGENT_ID || ''
  },

  /**
   * Z.AI Agent ID with a real Z.AI provider key for live Z.AI chat tests.
   * Required for tier3/zai-chat-flow tests. When not set, those tests are skipped.
   */
  get testZaiAgentId() {
    return process.env.TDSK_IT_ZAI_AGENT_ID || ''
  },

  /**
   * Real LLM provider API key for creating providers in E2E tests.
   * Used by agent-provider tests that need to create working agents with real keys.
   * When not set, tests that require live LLM calls are skipped.
   */
  get testProviderKey() {
    return process.env.TDSK_IT_PROVIDER_KEY || ''
  },

  /**
   * Echo endpoint URL reachable from inside the backend K8s pod.
   * Used as the target URL for proxy-type endpoint integration tests.
   * Defaults to the proxy's K8s internal service address.
   */
  get echoUrl() {
    return process.env.TDSK_IT_ECHO_URL || 'http://tdsk-proxy:7118/echo'
  },

  /** Neon Auth URL pattern for Playwright interception */
  neonAuthPattern: '**/neondb/auth/get-session**',

  /** Neon Auth base URL for JWT token acquisition */
  get authUrl() {
    return process.env.TDSK_IT_AUTH_URL || process.env.TDSK_AUTH_URL || ''
  },

  /** Test user email for JWT auth (user must exist in Neon Auth with emailVerified=true) */
  get testUserEmail() {
    return process.env.TDSK_IT_USER_EMAIL || ''
  },

  /** Test user password for JWT auth */
  get testUserPassword() {
    return process.env.TDSK_IT_USER_PASSWORD || ''
  },

  /** Sandbox Docker image for tests that need SSH / custom entrypoint */
  get sandboxImage() {
    const image = process.env.TDSK_SB_IMAGE || 'ghcr.io/threadedstack/tdsk-sandbox'
    const tag = process.env.TDSK_SB_IMAGE_TAG || 'latest'
    return `${image}:${tag}`
  },
} as const
