import type { TTask } from '@TSA/types'

import { ChatLogic } from '@TSA/renderers/chatLogic'
import { PiTuiApp } from '@TSA/renderers/PiTuiApp'

export const chat: TTask = {
  name: `chat`,
  alias: [`ch`],
  description: `Start an interactive chat session`,
  example: `tsa chat [--org <id>] [--project <id>] [--agent <id>] [--thread <id>]`,
  options: {
    org: {
      example: `--org org_xxx`,
      description: `Organization ID`,
      alias: [`organizationId`, `organization`, `orgId`],
    },
    project: {
      description: `Project ID`,
      example: `--project proj_xxx`,
      alias: [`projectId`, `pro`, `proId`],
    },
    agent: {
      alias: [`agentId`],
      example: `--agent agent_xxx`,
      description: `Agent ID to chat with`,
    },
    thread: {
      example: `--thread thread_xxx`,
      description: `Thread ID to resume`,
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
