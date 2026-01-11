import type { TNavCtx, TDynamicNavConfig } from '@TAF/types'

import {
  RepoNavItems,
  TeamNavItems,
  GlobalNavItems,
  BottomNavItems,
} from '@TAF/constants/nav'

/**
 * Get dynamic navigation configuration based on context
 * @param context - Current navigation context (teamId, repoId, etc.)
 * @returns Dynamic navigation configuration with sections and bottom items
 */
export const getDynamicNav = (context: TNavCtx): TDynamicNavConfig => {
  const sections = []

  sections.push({
    id: `global`,
    items: GlobalNavItems,
  })

  if (context.teamId) {
    sections.push({
      id: `team`,
      header: context.team.name || `Team`,
      items: TeamNavItems,
      visible: (ctx: TNavCtx) => !!ctx.teamId,
    })
  }

  if (context.teamId && context.repoId) {
    sections.push({
      id: `repo`,
      header: context.repo.name || `Repository`,
      items: RepoNavItems,
      visible: (ctx: TNavCtx) => !!ctx.teamId && !!ctx.repoId,
    })
  }

  return {
    sections,
    bottomItems: BottomNavItems,
  }
}
