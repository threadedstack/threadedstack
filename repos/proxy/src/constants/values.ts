export const ProcessSignals = [`SIGINT`, `SIGTERM`, `SIGQUIT`]

/**
 * List of public routes that don't require authentication
 * Note: login/register/refresh are handled client-side by Neon Auth
 */
export const PublicRoutes = [`/health`, `/domains/validate`]

export const LoggerIgnore = {
  methods: [`OPTIONS`],
  routes: [],
}
