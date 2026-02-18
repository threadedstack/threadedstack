import type { TNavItem, TNavCtx } from '@TAF/types'

import { ERoutePath } from '@TAF/types'
import { isFunc } from '@keg-hub/jsutils/isFunc'
import { RobotOutlineIcon } from '@tdsk/components'
import { ProjectNavItems } from '@TAF/constants/nav'
import { buildNavRoute } from '@TAF/utils/nav/buildRoute'

export const buildProjectNavItems = (context: TNavCtx): TNavItem[] => {
  return ProjectNavItems.reduce<TNavItem[]>((acc, item) => {
    if (item.route === ERoutePath.Agents) {
      const agents = context.agents ? Object.values(context.agents) : []

      const agentChildren: TNavItem[] = agents.map((agent) => ({
        text: agent.name,
        Icon: <RobotOutlineIcon sx={{ fontSize: 16 }} />,
        to: (ctx: TNavCtx) =>
          buildNavRoute({ ...ctx, agentId: agent.id }, ERoutePath.ProjectAgent),
        items: item.items.map((child) => ({
          ...child,
          to: (ctx: TNavCtx) =>
            isFunc(child.to) ? child.to({ ...ctx, agentId: agent.id }) : child.to,
        })),
      }))

      acc.push({
        ...item,
        items: agentChildren.length > 0 ? agentChildren : undefined,
      })

      return acc
    }

    acc.push(item)
    return acc
  }, [])
}
