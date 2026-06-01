import type { TSandboxSession } from '@tdsk/domain'

import { themed } from '@TSA/theme'
import type { ApiClient } from '@TSA/services/api'

export const resolveSessionSandbox = async (
  client: ApiClient,
  orgId: string,
  projectId: string,
  sessionId: string
): Promise<{ sandboxId: string; session: TSandboxSession } | undefined> => {
  const { data: sandboxes, error: listError } = await client.listSandboxes(
    orgId,
    projectId
  )
  if (listError || !sandboxes) {
    throw new Error(listError?.message || `Failed to list sandboxes`)
  }

  for (const sb of sandboxes) {
    const { data: sessions, error: sessError } = await client.getSandboxSessions(
      orgId,
      projectId,
      sb.id
    )
    if (sessError) {
      process.stderr.write(
        `${themed(`warning`, `Warning:`)} Could not check sessions for sandbox ${sb.id}: ${sessError.message}\n`
      )
      continue
    }
    const match = sessions?.find((s) => s.sessionId === sessionId)
    if (match) return { sandboxId: sb.id, session: match }
  }

  return undefined
}
