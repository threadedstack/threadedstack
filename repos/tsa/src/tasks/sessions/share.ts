import type { TTask } from '@TSA/types'

import { themed } from '@TSA/theme'
import { ApiClient } from '@TSA/services/api'
import { SandboxOptions } from '@TSA/constants/options'
import { ensureAuth } from '@TSA/utils/tasks/ensureAuth'
import { resolveContext } from '@TSA/utils/tasks/resolveContext'
import { resolveSessionId } from '@TSA/utils/tasks/resolveSessionId'
import { changeVisibility } from '@TSA/utils/sandbox/changeVisibility'

export const share: TTask = {
  name: `share`,
  description: `Make a session public (shareable with project members)`,
  example: `tsa sessions share [<session-id>] [--org <id>] [--project <id>]`,
  options: { ...SandboxOptions },
  action: ensureAuth(async ({ params, auth, config, options }) => {
    const explicitSessionId = options?.[0] as string | undefined
    const client = new ApiClient(auth)
    const ctx = await resolveContext({
      client,
      config,
      explicitOrg: params.org as string | undefined,
      explicitProject: params.project as string | undefined,
      explicitSandbox: params.sandbox as string | undefined,
    })

    let sessionId: string
    try {
      sessionId = await resolveSessionId(
        client,
        ctx.orgId,
        ctx.projectId,
        ctx.sandboxId,
        explicitSessionId
      )
    } catch (err) {
      process.stderr.write(`${themed(`error`, `Error:`)} ${(err as Error).message}\n`)
      process.exit(1)
    }

    try {
      const creds = auth.creds()
      await changeVisibility(client, ctx.orgId, ctx.projectId, sessionId, `public`, creds)
    } catch (err) {
      process.stderr.write(`${themed(`error`, `Error:`)} ${(err as Error).message}\n`)
      process.exit(1)
    }
  }),
}
