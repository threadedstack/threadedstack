import type { TNavCtx, TDynamicNavConfig } from '@TAF/types'

import {
  OrgNavItems,
  GlobalNavItems,
  BottomNavItems,
  ProjectNavItems,
} from '@TAF/constants/nav'

/**
 * Get dynamic navigation configuration based on context
 * @param context - Current navigation context (orgId, projectId, etc.)
 * @returns Dynamic navigation configuration with sections and bottom items
 */
export const getDynamicNav = (context: TNavCtx): TDynamicNavConfig => {
  const sections = []

  sections.push({
    id: `global`,
    items: GlobalNavItems,
  })

  if (context.orgId) {
    sections.push({
      id: `org`,
      items: OrgNavItems,
      visible: (ctx: TNavCtx) => !!ctx.orgId,
      header: context.org?.name || `Organization`,
    })
  }

  if (context.orgId && context.projectId) {
    sections.push({
      id: `project`,
      items: ProjectNavItems,
      visible: (ctx: TNavCtx) => !!ctx.orgId && !!ctx.projectId,
      header: context.project?.name || `Project`,
    })
  }

  return {
    sections,
    bottomItems: BottomNavItems,
  }
}
