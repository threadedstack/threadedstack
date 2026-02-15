import type { Agent } from '@tdsk/domain'
import { atom } from 'jotai'
import { atomWithReset } from 'jotai/utils'
import { getParamValue } from '@TAF/utils/nav/getParamValue'

export const agentsState = atomWithReset<Record<string, Agent>>(undefined)
export const activeAgentIdState = atomWithReset<string>(
  getParamValue((part, before) =>
    Boolean(before === `agents` && part && part !== `chat` && part !== `threads`)
  )
)

export const activeAgentState = atom((get) => {
  const agentId = get(activeAgentIdState)
  const agents = get(agentsState)
  return agentId && agents?.[agentId] ? agents[agentId] : undefined
})
