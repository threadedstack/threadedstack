import type { TEndpointConfig } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { getThread } from '@TBE/endpoints/threads/getThread'
import { listThreads } from '@TBE/endpoints/threads/listThreads'
import { createThread } from '@TBE/endpoints/threads/createThread'
import { deleteThread } from '@TBE/endpoints/threads/deleteThread'
import { listMessages } from '@TBE/endpoints/threads/listMessages'
import { createMessage } from '@TBE/endpoints/threads/createMessage'
import { updateMessage } from '@TBE/endpoints/threads/updateMessage'
import { deleteMessage } from '@TBE/endpoints/threads/deleteMessage'
import { branchThread } from '@TBE/endpoints/threads/branchThread'

/**
 * Threads scoped under agents: /:orgId/agents/:agentId/threads
 * Messages scoped under threads: .../:threadId/messages
 */
export const agentThreads: TEndpointConfig = {
  path: `/:agentId/threads`,
  method: EPMethod.Use,
  endpoints: {
    getThread,
    listThreads,
    createThread,
    deleteThread,
    listMessages,
    createMessage,
    updateMessage,
    deleteMessage,
    branchThread,
  },
}
