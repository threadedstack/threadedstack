export const ProcessSignals = [`SIGINT`, `SIGTERM`, `SIGQUIT`]

/**
 * List of public routes that don't require authentication
 */
export const PublicRoutes = [
  `/auth/login`,
  `/auth/register`,
  `/auth/refresh`,
  `/auth/callback`,
  `/health`,
]
