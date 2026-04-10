import { tryDelete } from './cleanup'

/**
 * Clean up all resources created by a quickstart call.
 * Deletes in dependency order: endpoint → agent → project → secret → provider.
 */
export const cleanupQuickstart = async (
  orgId: string,
  result: Record<string, any>
): Promise<void> => {
  if (result.endpoint?.id && result.project?.id)
    await tryDelete(`/orgs/${orgId}/projects/${result.project.id}/endpoints/${result.endpoint.id}`)
  if (result.agent?.id)
    await tryDelete(`/orgs/${orgId}/agents/${result.agent.id}`)
  if (result.project?.id)
    await tryDelete(`/orgs/${orgId}/projects/${result.project.id}`)
  if (result.secret?.id)
    await tryDelete(`/orgs/${orgId}/secrets/${result.secret.id}`)
  if (result.provider?.id)
    await tryDelete(`/orgs/${orgId}/providers/${result.provider.id}`)
}

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
