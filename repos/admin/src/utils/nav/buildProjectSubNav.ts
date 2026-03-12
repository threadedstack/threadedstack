import type { TNavCtx, TSubNavGroup } from '@TAF/types'

import { ERoutePath } from '@TAF/types'
import { ProjectSubNavGroups } from '@TAF/constants/nav'
import { buildAgentNav } from '@TAF/utils/nav/buildAgentNav'

export const buildProjectSubNav = (context: TNavCtx): TSubNavGroup[] => {
  return ProjectSubNavGroups.map((group) => {
    if (!group.items?.length) return group

    return {
      ...group,
      items: group.items.map((item) =>
        item.route === ERoutePath.Agents ? buildAgentNav(context, item) : item
      ),
    }
  })
}
