import type { TTask } from '@TRL/types'

import { ChatLogic } from '@TRL/renderers/chatLogic'
import { PiTuiApp } from '@TRL/renderers/PiTuiApp'

export const chat: TTask = {
  name: `chat`,
  alias: [`ch`],
  description: `Start an interactive chat session`,
  example: `tsa chat [--org <id>] [--agent <id>] [--thread <id>]`,
  options: {
    org: {
      description: `Organization ID`,
      example: `--org org_xxx`,
      type: `str`,
    },
    project: {
      description: `Project ID`,
      example: `--project proj_xxx`,
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
  action: async ({ params, auth, config }) => {
    const logic = new ChatLogic({
      auth,
      config,
      initialOrgId: params.org as string | undefined,
      initialAgentId: params.agent as string | undefined,
      initialThreadId: params.thread as string | undefined,
      initialProjectId: params.project as string | undefined,
    })

    const app = new PiTuiApp(logic)
    app.start()
    await logic.init()

    // Wait until exit
    await new Promise<void>((resolve) => {
      logic.onExit = () => {
        app.stop()
        resolve()
      }
    })

    process.exit(0)
  },
}
