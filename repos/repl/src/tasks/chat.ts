import type { TTask } from '@TRL/types'

import React from 'react'
import { render } from 'ink'
import { App } from '@TRL/components/App'
import { requireAuth } from '@TRL/utils/tasks/requireAuth'

export const chat: TTask = {
  name: `chat`,
  alias: [`ch`],
  description: `Start an interactive chat session`,
  example: `tdsk-agent chat [--org <id>] [--agent <id>] [--thread <id>]`,
  options: {
    org: {
      description: `Organization ID`,
      example: `--org org_xxx`,
      type: `str`,
    },
    agent: {
      description: `Agent ID to chat with`,
      example: `--agent agent_xxx`,
      type: `str`,
    },
    thread: {
      description: `Thread ID to resume`,
      example: `--thread thread_xxx`,
      type: `str`,
    },
  },
  action: requireAuth(async ({ params, auth }) => {
    const { waitUntilExit } = render(
      React.createElement(App, {
        auth,
        initialOrgId: params.org as string | undefined,
        initialAgentId: params.agent as string | undefined,
        initialThreadId: params.thread as string | undefined,
      })
    )
    await waitUntilExit()
  }),
}
