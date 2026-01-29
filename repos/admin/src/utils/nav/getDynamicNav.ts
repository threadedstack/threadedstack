import type { TNavCtx, TDynamicNavConfig } from '@TAF/types'

import { ERoutePath } from '@TAF/types'
import { buildRoute } from '@TAF/utils/nav/buildRoute'
import { OrgNavItems, BottomNavItems, ProjectNavItems } from '@TAF/constants/nav'

/**
 * Get dynamic navigation configuration based on context
 * @param context - Current navigation context (orgId, projectId, etc.)
 * @returns Dynamic navigation configuration with sections and bottom items
 */
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
  }

  if (context.orgId) {
    sections.push({
      id: `project`,
      items: ProjectNavItems,
      to: buildRoute(ERoutePath.Project),
      visible: (ctx: TNavCtx) => !!ctx.orgId && !!ctx.projectId,
      header: context.project?.name || `Project`,
    })
  }

  return {
    sections,
    bottomItems: BottomNavItems,
  }
}
