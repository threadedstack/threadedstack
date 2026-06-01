import type { TTask } from '@TSA/types'

import { list } from '@TSA/tasks/sessions/list'
import { share } from '@TSA/tasks/sessions/share'
import { start } from '@TSA/tasks/sessions/start'
import { connect } from '@TSA/tasks/sessions/connect'
import { unshare } from '@TSA/tasks/sessions/unshare'
import { SandboxOptions } from '@TSA/constants/options'

export const sessions: TTask = {
  name: `sessions`,
  alias: [`session`, `sess`, `ses`],
  description: `List active sessions for a sandbox`,
  example: `tsa sessions <sandbox-id> [--org <id>] [--project <id>]`,
  options: { ...SandboxOptions },
  tasks: {
    list,
    start,
    share,
    unshare,
    connect,
  },
  action: async (ctx) => {
    const list = sessions.tasks?.list?.action
    if (list) await list(ctx)
  },
}
