import type { TSkillProposal } from '@tdsk/domain'
import { getSkillProposals, setSkillProposals } from '@TAF/state/accessors'

export const upsertSkillProposal = (proposal: TSkillProposal) => {
  const current = getSkillProposals() || {}
  setSkillProposals({ ...current, [proposal.id]: proposal })
}
