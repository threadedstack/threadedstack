import type { TNavCtx, TDynamicNavConfig } from '@TAF/types'

import { ERoutePath } from '@TAF/types'
import { buildRoute } from '@TAF/utils/nav/buildRoute'
import { OrgNavItems, BottomNavItems, GlobalNavItems } from '@TAF/constants/nav'
import { buildProjectNavItems } from '@TAF/utils/nav/buildProjectNavItems'

export const getDynamicNav = (context: TNavCtx): TDynamicNavConfig => {
  const sections = []

  if (context.orgId) {
    sections.push({
      id: `org`,
      items: OrgNavItems,
      to: buildRoute(ERoutePath.Org),
      visible: (ctx: TNavCtx) => !!ctx.orgId,
      header: context.org?.name || `Organization`,
    })

    sections.push({
      id: `project`,
      items: buildProjectNavItems(context),
      to: buildRoute(ERoutePath.OrgProject),
      visible: (ctx: TNavCtx) => !!ctx.orgId && !!ctx.projectId,
      header: context.project?.name || `Project`,
    })
  } else {
    sections.push({
      id: `global`,
      header: `Navigation`,
      items: GlobalNavItems,
    })
  }

  return {
    sections,
    bottomItems: BottomNavItems,
  }
}
