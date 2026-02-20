import type { TSlashCommand } from '@TRL/types'
import { helpCommand } from './help'
import { registeredCommands } from './registry'

/** Commands that work without authentication */
const PRE_AUTH_COMMANDS = new Set(['login', 'help', 'exit', 'quit', 'q', 'h', 'li'])

export function isPreAuthCommand(nameOrAlias: string): boolean {
  return PRE_AUTH_COMMANDS.has(nameOrAlias)
}

export const commands: TSlashCommand[] = [helpCommand, ...registeredCommands]

export function findCommand(name: string): TSlashCommand | null {
  return commands.find((c) => c.name === name || c.aliases.includes(name)) || null
}

export function parseCommand(input: string): { name: string; args: string } {
  const trimmed = input.slice(1).trim()
  const spaceIdx = trimmed.indexOf(' ')
  if (spaceIdx === -1) return { name: trimmed, args: '' }
  return { name: trimmed.slice(0, spaceIdx), args: trimmed.slice(spaceIdx + 1).trim() }
}
