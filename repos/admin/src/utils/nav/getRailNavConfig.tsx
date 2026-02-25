import type { TNavCtx, TRailNavConfig } from '@TAF/types'

import { RailNavSections, BottomNavItems } from '@TAF/constants/nav'
import { buildProjectSubNav } from '@TAF/utils/nav/buildProjectSubNav'

export const getRailNavConfig = (context: TNavCtx): TRailNavConfig => {
  return {
    sections: [
      RailNavSections.Home,
      ...((context.orgId && [
        {
          ...RailNavSections.Org,
          label: context.org?.name || RailNavSections.Org.label,
          header: context.org?.name || RailNavSections.Org.header,
        },
        {
          ...RailNavSections.Project,
          groups: buildProjectSubNav(context),
          label: context.project?.name || RailNavSections.Project.label,
          header: context.project?.name || RailNavSections.Project.header,
        },
      ]) ||
        []),
    ],
    bottomItems: BottomNavItems,
  }
}
