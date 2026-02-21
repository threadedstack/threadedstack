import type { TSlashCommand } from '@TRL/types'

import { helpCommand } from '@TRL/commands/help'
import { PreAuthCommands } from '@TRL/constants/values'
import { registeredCommands } from '@TRL/commands/registry'

export const isPreAuthCommand = (nameOrAlias: string): boolean => {
  return PreAuthCommands.has(nameOrAlias)
}

export const commands: TSlashCommand[] = [helpCommand, ...registeredCommands]

export const findCommand = (name: string): TSlashCommand | null => {
  return commands.find((c) => c.name === name || c.aliases.includes(name)) || null
}

export const getAvailableCommands = (isPreAuth: boolean): TSlashCommand[] => {
  if (!isPreAuth) return commands
  return commands.filter(
    (c) => PreAuthCommands.has(c.name) || c.aliases.some((a) => PreAuthCommands.has(a))
  )
}

export const parseCommand = (input: string): { name: string; args: string } => {
  const trimmed = input.slice(1).trim()
  const spaceIdx = trimmed.indexOf(' ')
  if (spaceIdx === -1) return { name: trimmed, args: '' }
  return { name: trimmed.slice(0, spaceIdx), args: trimmed.slice(spaceIdx + 1).trim() }
}
