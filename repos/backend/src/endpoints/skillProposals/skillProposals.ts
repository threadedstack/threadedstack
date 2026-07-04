import type { TEndpointConfig } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { featureGate } from '@TBE/middleware/featureGate'
import { getSkillProposal } from '@TBE/endpoints/skillProposals/getSkillProposal'
import { listSkillProposals } from '@TBE/endpoints/skillProposals/listSkillProposals'
import { reviewSkillProposal } from '@TBE/endpoints/skillProposals/reviewSkillProposal'

/**
 * Skill proposals scoped under an org: /:orgId/skill-proposals
 * The human veto surface for self-authored skills (P3b). Authoring happens
 * in-process (agent tools / runtime-brain capture), not via HTTP, so there is
 * no create route here. Gated by the `skills` feature flag.
 */
export const orgSkillProposals: TEndpointConfig = {
  path: `/:orgId/skill-proposals`,
  method: EPMethod.Use,
  middleware: [featureGate(`skills`)],
  endpoints: {
    listSkillProposals,
    getSkillProposal,
    reviewSkillProposal,
  },
}
