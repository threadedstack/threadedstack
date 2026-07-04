import type { TSkillProposal } from '@tdsk/domain'
import { atomWithReset } from 'jotai/utils'

export const skillProposalsState =
  atomWithReset<Record<string, TSkillProposal>>(undefined)
export const activeSkillProposalIdState = atomWithReset<string>(undefined)
