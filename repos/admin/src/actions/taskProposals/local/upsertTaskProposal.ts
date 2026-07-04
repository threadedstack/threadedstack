import type { TTaskProposal } from '@tdsk/domain'
import { getTaskProposals, setTaskProposals } from '@TAF/state/accessors'

export const upsertTaskProposal = (proposal: TTaskProposal) => {
  const current = getTaskProposals() || {}
  setTaskProposals({ ...current, [proposal.id]: proposal })
}
