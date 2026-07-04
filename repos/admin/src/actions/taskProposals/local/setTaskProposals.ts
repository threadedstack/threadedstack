import type { TTaskProposal } from '@tdsk/domain'
import { setTaskProposals as setTaskProposalsState } from '@TAF/state/accessors'

export const setTaskProposals = (proposals: TTaskProposal[]) => {
  setTaskProposalsState(Object.fromEntries(proposals.map((p) => [p.id, p])))
}
