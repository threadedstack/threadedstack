import type { Agent } from '@tdsk/domain'
import { atom } from 'jotai'
import { atomWithReset } from 'jotai/utils'
import { getParamValue } from '@TAF/utils/nav/getParamValue'
import { activeProjectIdState } from '@TAF/state/projects'

// Keyed by contextKey (projectId or 'org')
export const agentsState = atomWithReset<Record<string, Record<string, Agent>>>(undefined)
export const activeAgentIdState = atomWithReset<string>(
  getParamValue((part, before) =>
    Boolean(before === `agents` && part && part !== `chat` && part !== `threads`)
  )
)

// Derived: org-level agents
export const orgAgentsState = atom((get) => get(agentsState)?.['org'])

// Derived: project-level agents
export const projectAgentsState = atom((get) => {
  const projectId = get(activeProjectIdState)
  return projectId ? get(agentsState)?.[projectId] : undefined
})

// Derived: active agent (searches all scopes)
export const activeAgentState = atom((get) => {
  const agentId = get(activeAgentIdState)
  if (!agentId) return undefined
  const all = get(agentsState)
  if (!all) return undefined
  for (const scope of Object.values(all)) {
    if (scope?.[agentId]) return scope[agentId]
  }
  return undefined
})
