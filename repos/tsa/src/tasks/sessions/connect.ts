import type { TTask } from '@TSA/types'

import { themed } from '@TSA/theme'
import { ApiClient } from '@TSA/services/api'
import { SandboxOptions } from '@TSA/constants/options'
import { ensureAuth } from '@TSA/utils/tasks/ensureAuth'
import { saveContext } from '@TSA/utils/tasks/saveContext'
import { resolveContext } from '@TSA/utils/tasks/resolveContext'
import { connectAndAttach } from '@TSA/utils/tasks/connectAndAttach'
import { resolveSessionSandbox } from '@TSA/utils/sandbox/resolveSessionSandbox'

export const connect: TTask = {
  name: `connect`,
  alias: [`join`, `attach`],
  description: `Connect to an existing session`,
  example: `tsa sessions connect <session-id>`,
  options: { ...SandboxOptions },
  action: ensureAuth(async ({ params, auth, config, options }) => {
    const sessionId = options?.[0] as string | undefined
    if (!sessionId) {
      process.stderr.write(`Usage: tsa sessions connect <session-id>\n`)
      process.exit(1)
    }

    const client = new ApiClient(auth)
    const base = await resolveContext({
      client,
      config,
      explicitOrg: params.org as string | undefined,
      explicitProject: params.project as string | undefined,
      skipSandbox: true,
    })

    let sandboxId = params.sandbox as string | undefined
    let sessionInstanceId: string | undefined

    if (sandboxId) {
      const { data: sessions, error: sessError } = await client.getSandboxSessions(
        base.orgId,
        base.projectId,
        sandboxId
      )
      if (sessError) {
        process.stderr.write(
          `${themed(`error`, `Error:`)} Failed to fetch sessions for sandbox ${sandboxId}: ${sessError.message}\n`
        )
        process.exit(1)
      }
      const match = sessions?.find((s) => s.sessionId === sessionId)
      if (match) {
        sessionInstanceId = match.instanceId
      } else {
        process.stderr.write(
          `${themed(`warning`, `Warning:`)} Session ${sessionId} not found in sandbox ${sandboxId} — server will pick an instance\n`
        )
      }
    } else {
      const result = await resolveSessionSandbox(
        client,
        base.orgId,
        base.projectId,
        sessionId
      )
      if (!result) {
        process.stderr.write(
          `${themed(`error`, `Error:`)} Could not find session ${sessionId} in any sandbox\n`
        )
        process.exit(1)
      }
      sandboxId = result.sandboxId
      sessionInstanceId = result.session.instanceId
    }

    if (config) saveContext(config, base.orgId, base.projectId, sandboxId)

    try {
      await connectAndAttach({
        client,
        auth,
        orgId: base.orgId,
        projectId: base.projectId,
        sandboxId,
        sessionId,
        ...(sessionInstanceId && { instanceOpts: { instanceId: sessionInstanceId } }),
      })
    } catch (err) {
      process.stderr.write(`${themed(`error`, `Error:`)} ${(err as Error).message}\n`)
      process.exitCode = 1
    }
  }),
}
