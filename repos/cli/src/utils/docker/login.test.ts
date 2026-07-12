import type { TTaskActionArgs } from '@TSCL/types'

import { describe, it, expect, vi } from 'vitest'

vi.mock(`@tdsk/logger`, () => ({
  Logger: { header: vi.fn(), error: vi.fn(), empty: vi.fn() },
}))

vi.mock(`@TSCL/utils/tasks/error`, () => ({ taskError: vi.fn() }))

import { login } from './login'

const props = (overrides: Record<string, any> = {}) =>
  ({
    params: {
      registry: `registry.example.com`,
      user: `alice`,
      token: `s3cr3t-token`,
      ...overrides,
    },
    config: { envs: {} },
  }) as unknown as TTaskActionArgs

describe(`docker login args`, () => {
  it(`never places the password/token as a CLI arg — uses --password-stdin instead`, () => {
    const args = login(props())
    expect(args).toEqual([
      `login`,
      `registry.example.com`,
      `-u`,
      `alice`,
      `--password-stdin`,
    ])
    // Never a `-p <password>` positional, and the raw secret never appears
    // anywhere in the built args array.
    expect(args).not.toContain(`-p`)
    expect(args).not.toContain(`s3cr3t-token`)
    expect(args.join(` `)).not.toContain(`s3cr3t-token`)
  })

  it(`resolves the registry from DOCKER_REGISTRY when no explicit registry param is given`, () => {
    const args = login({
      params: { user: `bob`, token: `tok` },
      config: { envs: { DOCKER_REGISTRY: `docker.example.com` } },
    } as unknown as TTaskActionArgs)
    expect(args).toEqual([`login`, `docker.example.com`, `-u`, `bob`, `--password-stdin`])
  })
})
