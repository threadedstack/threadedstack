import type { TSlashCommand } from '@TRL/types'
import { describe, it, expect } from 'vitest'
import { filterCommands, parseSlashInput } from './useSlashMenu'
import { commands, getAvailableCommands } from '@TRL/commands'

const mockCommands: TSlashCommand[] = [
  { name: `help`, aliases: [`h`], description: `Show help`, handler: async () => {} },
  { name: `agent`, aliases: [`a`], description: `Switch agent`, handler: async () => {} },
  { name: `add`, aliases: [], description: `Add context`, handler: async () => {} },
  {
    name: `exit`,
    aliases: [`quit`, `q`],
    description: `Exit REPL`,
    handler: async () => {},
  },
  { name: `login`, aliases: [`li`], description: `Log in`, handler: async () => {} },
]

describe(`filterCommands`, () => {
  it(`returns all commands when prefix is empty`, () => {
    const result = filterCommands(mockCommands, ``)
    expect(result).toEqual(mockCommands)
  })

  it(`filters by command name prefix`, () => {
    const result = filterCommands(mockCommands, `he`)
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe(`help`)
  })

  it(`filters by alias prefix`, () => {
    const result = filterCommands(mockCommands, `q`)
    // "q" matches exit's alias "quit"/"q"
    expect(result.some((c) => c.name === `exit`)).toBe(true)
  })

  it(`is case-insensitive`, () => {
    const result = filterCommands(mockCommands, `HE`)
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe(`help`)
  })

  it(`sorts name matches before alias matches`, () => {
    // "a" matches "agent" and "add" by name, plus "agent" alias "a"
    const result = filterCommands(mockCommands, `a`)
    expect(result[0].name).toBe(`agent`)
    expect(result[1].name).toBe(`add`)
  })

  it(`returns empty array for no matches`, () => {
    const result = filterCommands(mockCommands, `xyz`)
    expect(result).toHaveLength(0)
  })

  it(`matches partial alias`, () => {
    const result = filterCommands(mockCommands, `qu`)
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe(`exit`)
  })

  it(`does not double-include commands matching both name and alias`, () => {
    // "a" matches "agent" by name and alias — should appear once
    const result = filterCommands(mockCommands, `a`)
    const agentCount = result.filter((c) => c.name === `agent`).length
    expect(agentCount).toBe(1)
  })

  it(`matches single-char alias exactly`, () => {
    const result = filterCommands(mockCommands, `h`)
    // "h" matches "help" by name prefix, and "help" by alias "h"
    expect(result.some((c) => c.name === `help`)).toBe(true)
  })
})

describe(`parseSlashInput`, () => {
  it(`returns null when input is empty`, () => {
    expect(parseSlashInput(``)).toBeNull()
  })

  it(`returns null when input does not start with /`, () => {
    expect(parseSlashInput(`hello`)).toBeNull()
  })

  it(`returns empty string for just /`, () => {
    expect(parseSlashInput(`/`)).toBe(``)
  })

  it(`returns prefix after /`, () => {
    expect(parseSlashInput(`/ag`)).toBe(`ag`)
  })

  it(`returns null when space follows command token`, () => {
    expect(parseSlashInput(`/help args`)).toBeNull()
  })

  it(`returns null when space follows immediately after command`, () => {
    expect(parseSlashInput(`/help `)).toBeNull()
  })

  it(`returns full token for exact command name`, () => {
    expect(parseSlashInput(`/agent`)).toBe(`agent`)
  })

  it(`returns null when input contains a newline`, () => {
    expect(parseSlashInput(`/help\nmore`)).toBeNull()
  })

  it(`returns null for slash followed by newline`, () => {
    expect(parseSlashInput(`/\n`)).toBeNull()
  })
})

describe(`getAvailableCommands`, () => {
  it(`returns all commands when not pre-auth`, () => {
    const result = getAvailableCommands(false)
    expect(result).toEqual(commands)
    expect(result.length).toBeGreaterThan(5)
  })

  it(`returns only pre-auth commands when pre-auth`, () => {
    const result = getAvailableCommands(true)
    expect(result.length).toBeLessThan(commands.length)
    // Should include help, login, exit
    const names = result.map((c) => c.name)
    expect(names).toContain(`help`)
    expect(names).toContain(`login`)
    expect(names).toContain(`exit`)
  })

  it(`pre-auth commands do not include auth-required commands`, () => {
    const result = getAvailableCommands(true)
    const names = result.map((c) => c.name)
    expect(names).not.toContain(`agent`)
    expect(names).not.toContain(`new`)
    expect(names).not.toContain(`verbose`)
  })
})
