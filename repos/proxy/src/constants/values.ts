export const ProcessSignals = [`SIGINT`, `SIGTERM`, `SIGQUIT`]

/**
 * List of public routes that don't require authentication
 * Note: login/register/refresh are handled client-side by Neon Auth
 */
export const PublicRoutes = [`/health`, `/domains/validate`, `/echo`]

export const BearerPrefix = `Bearer `
export const SessionRoutes = [`/ai/ws`]
export const QueryTokenRoutes = [`/ai/ws`]
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
