import type { TTask } from '@TSA/types/tasks.types'
import type { TTsaConfig } from '@TSA/types/config.types'

import { describe, it, expect } from 'vitest'
import { addDefaults } from './addDefaults'

describe(`addDefaults`, () => {
  it(`injects the config value as default when the option already exists`, () => {
    const task = {
      name: `test`,
      options: { org: { type: `string`, description: `Org id` } },
    } as unknown as TTask
    const config = { org: `org-1` } as unknown as TTsaConfig

    const result = addDefaults(task, config)

    expect(result.org).toEqual({
      type: `string`,
      description: `Org id`,
      default: `org-1`,
    })
  })

  it(`leaves the option unmodified when the config value is undefined`, () => {
    const task = {
      name: `test`,
      options: { org: { type: `string` } },
    } as unknown as TTask
    const config = { org: undefined } as unknown as TTsaConfig

    const result = addDefaults(task, config)

    expect(result.org).toEqual({ type: `string` })
  })

  it(`ignores config keys not present in task.options`, () => {
    const task = {
      name: `test`,
      options: {},
    } as unknown as TTask
    const config = { org: `org-1` } as unknown as TTsaConfig

    const result = addDefaults(task, config)

    expect(result).toEqual({})
  })

  it(`returns a shallow copy of task.options unchanged when config is empty`, () => {
    const task = {
      name: `test`,
      options: { org: { type: `string` } },
    } as unknown as TTask

    const result = addDefaults(task, {} as TTsaConfig)

    expect(result).toEqual({ org: { type: `string` } })
    expect(result).not.toBe(task.options)
  })
})
