import type { TTask } from '@TRL/types'

import { ApiClient } from '@TRL/api'
import { AgentRepl } from '@TRL/repl'
import { LocalAgentExecutor } from '@TRL/executor'
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
  action: requireAuth(async ({ params, auth, renderer }) => {
    const client = new ApiClient(auth)
    const executor = new LocalAgentExecutor(client)
    const repl = new AgentRepl(executor, renderer)

    await repl.start({
      orgId: params.org as string | undefined,
      agentId: params.agent as string | undefined,
      threadId: params.thread as string | undefined,
    })
  }),
}
