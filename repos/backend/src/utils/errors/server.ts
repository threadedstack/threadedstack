import { withEx } from '@TBE/utils/errors/withEx'

export const ServerErr = withEx(
  {
    httpMethod: (method?: string) => [
      500,
      `Invalid HTTP method ${method}. Only valid HTTP methods are allowed`,
      `route-method`,
    ],
    routePath: (name?: string) => [
      500,
      `Invalid route config for route ${name}. The "path" property is required`,
      `route-path`,
    ],
    customRoute: (name?: string) => [
      500,
      `Invalid custom route. The route ${name} is not allowed`,
      `route-custom`,
    ],
  },
  `server`
)
