import type { TNavItem, TNavCtx } from '@TAF/types'

import { ERoutePath } from '@TAF/types'
import { buildNavRoute } from '@TAF/utils/nav/buildRoute'
import { ProjectNavItems } from '@TAF/constants/nav'
import {
  Chat as ChatIcon,
  Forum as ThreadsIcon,
  AutoAwesome as AgentIcon,
} from '@mui/icons-material'

const buildAgentChildItems = (agentId: string): TNavItem[] => [
  {
    text: `Threads`,
    Icon: <ThreadsIcon sx={{ fontSize: 14 }} />,
    to: (ctx: TNavCtx) =>
      buildNavRoute({ ...ctx, agentId }, ERoutePath.ProjectAgentThreads),
  },
  {
    text: `Chat`,
    Icon: <ChatIcon sx={{ fontSize: 14 }} />,
    to: (ctx: TNavCtx) => buildNavRoute({ ...ctx, agentId }, ERoutePath.ProjectAgentChat),
  },
]

export const buildProjectNavItems = (context: TNavCtx): TNavItem[] => {
  return ProjectNavItems.reduce<TNavItem[]>((acc, item) => {
    // Filter out the flat Threads entry — threads now live under each agent
    if (item.text === `Threads`) return acc

    // Transform the Agents entry to include dynamic agent children
    if (item.text === `Agents`) {
      const agents = context.agents ? Object.values(context.agents) : []

      const agentChildren: TNavItem[] = agents.map((agent) => ({
        text: agent.name,
        Icon: <AgentIcon sx={{ fontSize: 16 }} />,
        to: (ctx: TNavCtx) =>
          buildNavRoute({ ...ctx, agentId: agent.id }, ERoutePath.ProjectAgent),
        items: buildAgentChildItems(agent.id),
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
