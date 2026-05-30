export const ProcessSignals = [`SIGINT`, `SIGTERM`, `SIGQUIT`]

/**
 * List of public routes that don't require authentication
 * Note: login/register/refresh are handled client-side by Neon Auth
 */
export const PublicRoutes = [
  `/echo`,
  `/health`,
  `/domains/validate`,
  `/_/payments/webhooks`,
  `/_/subscriptions/plans`,
]

export const BearerPrefix = `Bearer `
export const SessionRoutes = [`/ai/ws`]
export const QueryTokenRoutes = [`/ai/ws`]
/**
 * Routes where the proxy does not enforce authentication.
 * Auth is deferred to the backend, which decides per-endpoint
 * whether the request requires credentials (based on the endpoint's
 * `public` flag in the database).
 */
export const DeferredAuthRoutes = [`/proxy`]
export const ProxyForwardRoutes = [`/ai`, `/proxy`]

export const LoggerIgnore = {
  methods: [`OPTIONS`],
  routes: [],
}

/**
 * Detects sandbox subdomain requests.
 * Flat format: "3000--sb-xxxx.local.threadedstack.app"
 * The first DNS label starts with digits followed by "--sb-".
 */
export const SandboxHostRx = /^\d+--sb-/
