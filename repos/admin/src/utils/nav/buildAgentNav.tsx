import type { TNavItem, TNavCtx } from '@TAF/types'

import { ERoutePath } from '@TAF/types'
import { isFunc } from '@keg-hub/jsutils/isFunc'
import { RobotOutlineIcon } from '@tdsk/components'
import { buildNavRoute } from '@TAF/utils/nav/buildRoute'

export const buildAgentNav = (context: TNavCtx, item: TNavItem): TNavItem => {
  const agents = context.agents ? Object.values(context.agents) : []

  const items: TNavItem[] = agents.map((agent) => ({
    text: agent.name,
    Icon: <RobotOutlineIcon sx={{ fontSize: 16 }} />,
    to: (ctx: TNavCtx) =>
      buildNavRoute({ ...ctx, agentId: agent.id }, ERoutePath.ProjectAgent),
    items: item.items?.map((child) => ({
      ...child,
      to: (ctx: TNavCtx) =>
        isFunc(child.to) ? child.to({ ...ctx, agentId: agent.id }) : child.to,
    })),
  }))

  return {
    ...item,
    items: items.length > 0 ? items : undefined,
  }
}
