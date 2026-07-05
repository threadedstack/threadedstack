import type { TTaskProposal } from '@tdsk/domain'
import { atomWithReset } from 'jotai/utils'

export const taskProposalsState = atomWithReset<Record<string, TTaskProposal>>(undefined)
export const activeTaskProposalIdState = atomWithReset<string>(undefined)
