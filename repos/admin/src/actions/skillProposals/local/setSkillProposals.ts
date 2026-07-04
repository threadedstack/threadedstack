import type { TSkillProposal } from '@tdsk/domain'
import { setSkillProposals as setSkillProposalsState } from '@TAF/state/accessors'

export const setSkillProposals = (proposals: TSkillProposal[]) => {
  setSkillProposalsState(Object.fromEntries(proposals.map((p) => [p.id, p])))
}
