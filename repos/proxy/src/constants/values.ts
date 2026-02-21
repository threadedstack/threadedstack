export const ProcessSignals = [`SIGINT`, `SIGTERM`, `SIGQUIT`]

/**
 * List of public routes that don't require authentication
 * Note: login/register/refresh are handled client-side by Neon Auth
 */
export const PublicRoutes = [`/health`, `/domains/validate`, `/echo`]

export const BearerPrefix = `Bearer `
export const SessionPrefix = `Session `
export const SessionRoutes = [`/ai/chat`, `/ai/stream`]
export const ProxyForwardRoutes = [`/ai`, `/proxy`]

export const LoggerIgnore = {
  methods: [`OPTIONS`],
  routes: [],
}
