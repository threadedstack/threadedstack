import type { TNavCtx, TNavItem, TSubNavGroup } from '@TAF/types'

import { ERoutePath } from '@TAF/types'
import { ProjectSubNavGroups } from '@TAF/constants/nav'
import { buildAgentNav } from '@TAF/utils/nav/buildAgentNav'

export const buildProjectSubNav = (context: TNavCtx): TSubNavGroup[] => {
  return ProjectSubNavGroups.reduce<TSubNavGroup[]>((acc, group) => {
    !group.items?.length
      ? acc.push(group)
      : acc.push({
          ...group,
          items: group?.items?.map<TNavItem>((item) => {
            return item.route !== ERoutePath.Agents ? item : buildAgentNav(context, item)
          }),
        })
    return acc
  }, [])
}
