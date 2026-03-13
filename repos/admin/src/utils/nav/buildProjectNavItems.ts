import type { TNavItem, TNavCtx } from '@TAF/types'

import { ERoutePath } from '@TAF/types'
import { ProjectNavItems } from '@TAF/constants/nav'
import { buildAgentNav } from '@TAF/utils/nav/buildAgentNav'

export const buildProjectNavItems = (context: TNavCtx): TNavItem[] => {
  return ProjectNavItems.map((item) =>
    item.route === ERoutePath.Agents ? buildAgentNav(context, item) : item
  )
}
