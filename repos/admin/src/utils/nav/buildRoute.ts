import type { TNavCtx } from '@TAF/types'

import type { ERoutePath } from '@TAF/types'

export const buildNavRoute = (ctx: TNavCtx, route: ERoutePath) => {
  return route
    .split(`/`)
    .map((section) => {
      if (!section.startsWith(`:`)) return section

      const key = section.slice(1)

      if (ctx[key] === undefined) {
        console.warn(
          `[NAV ERROR] Found route key ${key}, but it does not existing in context.`
        )
        return section
      }

      return String(ctx[key])
    })
    .join(`/`)
}

export const buildRoute = (route: ERoutePath) => (ctx: TNavCtx) =>
  buildNavRoute(ctx, route)
