import type { TSlashCommand } from '@TRL/types'

import { exitCommand } from './exit'
import { infoCommand } from './info'
import { clearCommand } from './clear'
import { loginCommand } from './login'
import { logoutCommand } from './logout'
import { verboseCommand } from './verbose'
import { contextCommand } from './context'
import { historyCommand } from './history'
import { newThreadCommand } from './newThread'
import { addContextCommand } from './addContext'
import { listThreadsCommand } from './listThreads'
import { switchAgentCommand } from './switchAgent'
import { switchThreadCommand } from './switchThread'
import { removeContextCommand } from './removeContext'
import { switchProviderCommand } from './switchProvider'

/** All commands except help (help imports this to avoid circular deps) */
export const registeredCommands: TSlashCommand[] = [
  infoCommand,
  exitCommand,
  loginCommand,
  clearCommand,
  logoutCommand,
  contextCommand,
  historyCommand,
  verboseCommand,
  newThreadCommand,
  addContextCommand,
  listThreadsCommand,
  switchAgentCommand,
  switchThreadCommand,
  removeContextCommand,
  switchProviderCommand,
]
