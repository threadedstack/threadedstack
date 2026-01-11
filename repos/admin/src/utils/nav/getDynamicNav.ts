import type { TNavCtx, TDynamicNavConfig } from '@TAF/types'

import {
  RepoNavItems,
  OrgNavItems,
  GlobalNavItems,
  BottomNavItems,
} from '@TAF/constants/nav'

/**
 * Get dynamic navigation configuration based on context
 * @param context - Current navigation context (orgId, repoId, etc.)
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
      header: context.org?.name || `Org`,
      items: OrgNavItems,
      visible: (ctx: TNavCtx) => !!ctx.orgId,
    })
  }

  if (context.orgId && context.repoId) {
    sections.push({
      id: `repo`,
      header: context.repo?.name || `Repository`,
      items: RepoNavItems,
      visible: (ctx: TNavCtx) => !!ctx.orgId && !!ctx.repoId,
    })
  }

  return {
    sections,
    bottomItems: BottomNavItems,
  }
}
