import { PublicRoutes } from '@TPX/constants/values'

/**
 * Check if a route is public (doesn't require authentication)
 */
export const isPublicRoute = (path: string): boolean => {
  return PublicRoutes.some((route) => path.startsWith(route))
}
