import { describe, it, expect } from 'vitest'
import { parseCommand, findCommand, commands } from './index'

describe(`Command Registry`, () => {
  it(`parseCommand extracts command name and args`, () => {
    const { name, args } = parseCommand(`/switch 3`)
    expect(name).toBe(`switch`)
    expect(args).toBe(`3`)
  })

  it(`parseCommand handles command with no args`, () => {
    const { name, args } = parseCommand(`/help`)
    expect(name).toBe(`help`)
    expect(args).toBe(``)
  })

  it(`findCommand finds by name`, () => {
    const cmd = findCommand(`help`)
    expect(cmd).toBeDefined()
    expect(cmd!.name).toBe(`help`)
  })

  it(`findCommand finds by alias`, () => {
    const cmd = findCommand(`h`)
    expect(cmd).toBeDefined()
    expect(cmd!.name).toBe(`help`)
  })

  it(`findCommand returns null for unknown command`, () => {
    const cmd = findCommand(`unknown`)
    expect(cmd).toBeNull()
  })

  it(`all commands have name, aliases, description, and handler`, () => {
    for (const cmd of commands) {
      expect(cmd.name).toBeTruthy()
      expect(Array.isArray(cmd.aliases)).toBe(true)
      expect(cmd.description).toBeTruthy()
      expect(typeof cmd.handler).toBe(`function`)
    }
  })
})
