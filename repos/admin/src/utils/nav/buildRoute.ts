import type { TNavCtx } from '@TAF/types'
import type { ERoutePath } from '@TAF/types'
import { VITEST } from '@TAF/constants/envs'

export const buildNavRoute = (ctx: TNavCtx, route: ERoutePath) => {
  const parts = route.split(`/`)
  const replaced = []

  for (const part of parts) {
    if (!part.startsWith(`:`)) {
      replaced.push(part)
      continue
    }

    const key = part.slice(1)
    if (ctx[key] === undefined) {
      !VITEST &&
        console.warn(`[NAV ERROR] Route key ${key} missing, does not exist in context.`)
      return `#`
    }

    replaced.push(String(ctx[key]))
  }

  return replaced.join(`/`)
}

export const buildRoute = (route: ERoutePath) => (ctx: TNavCtx) =>
  buildNavRoute(ctx, route)
