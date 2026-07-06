import type { TEndpointConfig } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { featureGate } from '@TBE/middleware/featureGate'
import { getTaskProposal } from '@TBE/endpoints/taskProposals/getTaskProposal'
import { listTaskProposals } from '@TBE/endpoints/taskProposals/listTaskProposals'
import { createTaskProposal } from '@TBE/endpoints/taskProposals/createTaskProposal'
import { updateTaskProposal } from '@TBE/endpoints/taskProposals/updateTaskProposal'
import { deleteTaskProposal } from '@TBE/endpoints/taskProposals/deleteTaskProposal'
import { reviewTaskProposal } from '@TBE/endpoints/taskProposals/reviewTaskProposal'

/**
 * Task proposals scoped under an org: /:orgId/task-proposals
 * Full CRUD plus the human veto surface for self-sensed tasks (P4a). Authoring
 * normally happens server-side (runtime-brain sensing capture), but the create
 * route lets an operator or tool seed a proposal directly; it still runs the
 * deterministic security scan at author time. Promotion stays automatic
 * (work-cycle driven once a PR opens), so the review route can only reject,
 * never approve. Gated by the `sensing` feature flag.
 */
export const orgTaskProposals: TEndpointConfig = {
  path: `/:orgId/task-proposals`,
  method: EPMethod.Use,
  middleware: [featureGate(`sensing`)],
  endpoints: {
    listTaskProposals,
    createTaskProposal,
    getTaskProposal,
    updateTaskProposal,
    deleteTaskProposal,
    reviewTaskProposal,
  },
}
