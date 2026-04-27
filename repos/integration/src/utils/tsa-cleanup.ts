import { tryDelete } from './cleanup'

/**
 * Clean up a thread created during tests.
 */
export const cleanupThread = async (
  orgId: string,
  agentId: string,
  threadId: string
): Promise<void> => {
  await tryDelete(`/orgs/${orgId}/agents/${agentId}/threads/${threadId}`)
}
