import type { TNavItem, TNavCtx } from '@TAF/types'

import { ERoutePath } from '@TAF/types'
import { ProjectNavItems } from '@TAF/constants/nav'
import { buildAgentNav } from '@TAF/utils/nav/buildAgentNav'

export const buildProjectNavItems = (context: TNavCtx): TNavItem[] => {
  return ProjectNavItems.reduce<TNavItem[]>((acc, item) => {
    item.route !== ERoutePath.Agents
      ? acc.push(item)
      : acc.push(buildAgentNav(context, item))
    return acc
  }, [])
}
