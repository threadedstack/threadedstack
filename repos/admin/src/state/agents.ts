import type { Agent } from '@tdsk/domain'
import { atomWithReset } from 'jotai/utils'

export const agentsState = atomWithReset<Record<string, Agent>>(undefined)
export const activeAgentIdState = atomWithReset<string>(undefined)
