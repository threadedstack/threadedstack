import type { TSlashCommand } from '@TSA/types'

import { exitCommand } from './exit'
import { infoCommand } from './info'
import { treeCommand } from './tree'
import { forkCommand } from './fork'
import { clearCommand } from './clear'
import { loginCommand } from './login'
import { portsCommand } from './ports'
import { logoutCommand } from './logout'
import { verboseCommand } from './verbose'
import { contextCommand } from './context'
import { historyCommand } from './history'
import { projectsCommand } from './projects'
import { newThreadCommand } from './newThread'
import { addContextCommand } from './addContext'
import { listThreadsCommand } from './listThreads'
import { switchAgentCommand } from './switchAgent'
import { switchThreadCommand } from './switchThread'
import { removeContextCommand } from './removeContext'
import { switchProviderCommand } from './switchProvider'

import { AgentsEnabled } from '@TSA/constants/values'

/** All commands except help (help imports this to avoid circular deps) */
export const registeredCommands: TSlashCommand[] = [
  infoCommand,
  exitCommand,
  loginCommand,
  clearCommand,
  portsCommand,
  logoutCommand,
  contextCommand,
  historyCommand,
  verboseCommand,
  projectsCommand,
  addContextCommand,
  removeContextCommand,
  switchProviderCommand,
  ...(AgentsEnabled
    ? [
        treeCommand,
        forkCommand,
        newThreadCommand,
        listThreadsCommand,
        switchAgentCommand,
        switchThreadCommand,
      ]
    : []),
]
