import type { TSlashCommand } from '@TRL/types'
import { helpCommand } from './help'
import { newThreadCommand } from './newThread'
import { switchThreadCommand } from './switchThread'
import { listThreadsCommand } from './listThreads'
import { historyCommand } from './history'
import { switchAgentCommand } from './switchAgent'
import { switchProviderCommand } from './switchProvider'
import { infoCommand } from './info'
import { contextCommand } from './context'
import { addContextCommand } from './addContext'
import { removeContextCommand } from './removeContext'
import { verboseCommand } from './verbose'
import { clearCommand } from './clear'
import { exitCommand } from './exit'

export const commands: TSlashCommand[] = [
  helpCommand,
  newThreadCommand,
  switchThreadCommand,
  listThreadsCommand,
  historyCommand,
  switchAgentCommand,
  switchProviderCommand,
  infoCommand,
  contextCommand,
  addContextCommand,
  removeContextCommand,
  verboseCommand,
  clearCommand,
  exitCommand,
]

export function findCommand(name: string): TSlashCommand | null {
  return commands.find((c) => c.name === name || c.aliases.includes(name)) || null
}

export function parseCommand(input: string): { name: string; args: string } {
  const trimmed = input.slice(1).trim()
  const spaceIdx = trimmed.indexOf(' ')
  if (spaceIdx === -1) return { name: trimmed, args: '' }
  return { name: trimmed.slice(0, spaceIdx), args: trimmed.slice(spaceIdx + 1).trim() }
}
