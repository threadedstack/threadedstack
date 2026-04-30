import { tryDelete } from './cleanup'
import type { WSResult } from './ws-client'

export const cleanupThread = async (
  orgId: string,
  agentId: string,
  threadId: string
): Promise<void> => {
  await tryDelete(`/orgs/${orgId}/agents/${agentId}/threads/${threadId}`)
}

export const extractThreadId = (result: WSResult): string | null => {
  const msg = result.messages?.find(m => m.type === 'thread_created')
  return (msg?.threadId as string) || null
}
