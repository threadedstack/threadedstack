import type { TTasks } from '@TRL/types'

import { find } from './find'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockTasks: TTasks = {
  login: {
    name: `login`,
    alias: [`li`],
    action: vi.fn(),
    options: {},
  },
  help: {
    name: `help`,
    alias: [`--help`, `-h`],
    action: vi.fn(),
    options: {},
  },
  chat: {
    name: `chat`,
    alias: [`ch`],
    action: vi.fn(),
    options: {},
  },
}

describe(`find`, () => {
  beforeEach(() => {
    vi.spyOn(process, `exit`).mockImplementation((code?: any) => {
      throw new Error(`__EXIT__`)
    })
    vi.spyOn(process.stdout, `write`).mockImplementation(() => true)
  })

  it(`should find task by name`, () => {
    const result = find(mockTasks, [`login`])
    expect(result.task.name).toBe(`login`)
  })

  it(`should find task by alias`, () => {
    const result = find(mockTasks, [`li`])
    expect(result.task.name).toBe(`login`)
  })

  it(`should find help task by --help alias`, () => {
    const result = find(mockTasks, [`--help`])
    expect(result.task.name).toBe(`help`)
  })

  it(`should find help task by -h alias`, () => {
    const result = find(mockTasks, [`-h`])
    expect(result.task.name).toBe(`help`)
  })

  it(`should return remaining options after task name`, () => {
    const result = find(mockTasks, [`login`, `tdsk_key123`, `--insecure`])
    expect(result.task.name).toBe(`login`)
    expect(result.options).toEqual([`tdsk_key123`, `--insecure`])
  })

  it(`should include tasks in result`, () => {
    const result = find(mockTasks, [`chat`])
    expect(result.tasks).toBe(mockTasks)
  })

  it(`should exit on unknown task`, () => {
    expect(() => find(mockTasks, [`unknown`])).toThrow(`__EXIT__`)
  })

  it(`should exit on empty args`, () => {
    expect(() => find(mockTasks, [])).toThrow(`__EXIT__`)
  })
})
