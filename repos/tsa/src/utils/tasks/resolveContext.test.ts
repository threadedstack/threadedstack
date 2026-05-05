import type { ApiClient } from '@TSA/services/api'
import type { TTsaConfig } from '@TSA/types'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockResolveOrgId = vi.fn()
const mockResolveProjectId = vi.fn()
const mockResolveSandboxId = vi.fn()
const mockSaveContext = vi.fn()

vi.mock(`@TSA/utils/tasks/resolveOrgId`, () => ({
  resolveOrgId: (...args: any[]) => mockResolveOrgId(...args),
}))
vi.mock(`@TSA/utils/tasks/resolveProjectId`, () => ({
  resolveProjectId: (...args: any[]) => mockResolveProjectId(...args),
}))
vi.mock(`@TSA/utils/tasks/resolveSandboxId`, () => ({
  resolveSandboxId: (...args: any[]) => mockResolveSandboxId(...args),
}))
vi.mock(`@TSA/utils/tasks/saveContext`, () => ({
  saveContext: (...args: any[]) => mockSaveContext(...args),
}))

import { resolveContext } from './resolveContext'

const makeClient = () => ({ proxyUrl: `https://proxy.test` }) as unknown as ApiClient

const makeConfig = (overrides?: Partial<TTsaConfig>) =>
  ({
    org: `org-saved`,
    project: `proj-saved`,
    sandbox: `sb-saved`,
    ...overrides,
  }) as TTsaConfig

describe(`resolveContext`, () => {
  let exitCode: number | undefined

  beforeEach(() => {
    vi.clearAllMocks()
    exitCode = undefined

    mockResolveOrgId.mockResolvedValue(`org-1`)
    mockResolveProjectId.mockResolvedValue(`proj-1`)
    mockResolveSandboxId.mockResolvedValue(`sb-1`)

    vi.spyOn(process, `exit`).mockImplementation((code?: any) => {
      exitCode = code ?? 0
      throw new Error(`__EXIT__`)
    })
    vi.spyOn(process.stderr, `write`).mockImplementation(() => true)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  const run = async (args: {
    client: ApiClient
    config?: TTsaConfig
    explicitOrg?: string
    explicitProject?: string
    explicitSandbox?: string
    skipSandbox?: boolean
  }) => {
    try {
      return await resolveContext(args as any)
    } catch (err: any) {
      if (err.message !== `__EXIT__`) throw err
      return undefined
    }
  }

  describe(`full resolution (skipSandbox not set)`, () => {
    it(`resolves org, project, and sandbox, then saves context`, async () => {
      mockResolveOrgId.mockResolvedValue(`org-saved`)
      const client = makeClient()
      const config = makeConfig()
      const result = await run({
        client,
        config,
        explicitOrg: `org-saved`,
        explicitProject: `explicit-proj`,
        explicitSandbox: `explicit-sb`,
      })

      expect(mockResolveOrgId).toHaveBeenCalledWith(client, `org-saved`, `org-saved`)
      expect(mockResolveProjectId).toHaveBeenCalledWith(
        client,
        `org-saved`,
        `explicit-proj`
      )
      expect(mockResolveSandboxId).toHaveBeenCalledWith(
        client,
        `org-saved`,
        `proj-1`,
        `explicit-sb`,
        `sb-saved`
      )
      expect(mockSaveContext).toHaveBeenCalledWith(config, `org-saved`, `proj-1`, `sb-1`)
      expect(result).toEqual({
        client,
        orgId: `org-saved`,
        projectId: `proj-1`,
        sandboxId: `sb-1`,
      })
      expect(exitCode).toBeUndefined()
    })

    it(`skips saveContext when config is undefined`, async () => {
      const client = makeClient()
      const result = await run({ client })

      expect(mockSaveContext).not.toHaveBeenCalled()
      expect(result).toEqual({
        client,
        orgId: `org-1`,
        projectId: `proj-1`,
        sandboxId: `sb-1`,
      })
    })
  })

  describe(`skipSandbox mode`, () => {
    it(`resolves only org and project, skips sandbox`, async () => {
      const client = makeClient()
      const config = makeConfig()
      const result = await run({ client, config, skipSandbox: true })

      expect(mockResolveOrgId).toHaveBeenCalled()
      expect(mockResolveProjectId).toHaveBeenCalled()
      expect(mockResolveSandboxId).not.toHaveBeenCalled()
      expect(mockSaveContext).toHaveBeenCalledWith(config, `org-1`, `proj-1`)
      expect(result).toEqual({ client, orgId: `org-1`, projectId: `proj-1` })
      expect(result).not.toHaveProperty(`sandboxId`)
    })

    it(`skips saveContext when config is undefined in skipSandbox mode`, async () => {
      const client = makeClient()
      await run({ client, skipSandbox: true })
      expect(mockSaveContext).not.toHaveBeenCalled()
    })
  })

  describe(`org-changed project clearing`, () => {
    it(`passes explicitProject when orgId matches config.org`, async () => {
      mockResolveOrgId.mockResolvedValue(`org-saved`)
      const client = makeClient()
      await run({
        client,
        config: makeConfig({ org: `org-saved` }),
        explicitProject: `my-proj`,
      })

      expect(mockResolveProjectId).toHaveBeenCalledWith(client, `org-saved`, `my-proj`)
    })

    it(`passes undefined for explicitProject when orgId differs from config.org`, async () => {
      mockResolveOrgId.mockResolvedValue(`org-different`)
      const client = makeClient()
      await run({
        client,
        config: makeConfig({ org: `org-saved` }),
        explicitProject: `my-proj`,
      })

      expect(mockResolveProjectId).toHaveBeenCalledWith(
        client,
        `org-different`,
        undefined
      )
    })

    it(`clears explicitProject when config exists but config.org is undefined`, async () => {
      const client = makeClient()
      await run({
        client,
        config: makeConfig({ org: undefined }),
        explicitProject: `my-proj`,
      })

      expect(mockResolveProjectId).toHaveBeenCalledWith(client, `org-1`, undefined)
    })
  })

  describe(`error handling`, () => {
    it(`exits on org resolution failure`, async () => {
      mockResolveOrgId.mockRejectedValue(new Error(`No organizations found`))
      await run({ client: makeClient() })

      expect(exitCode).toBe(1)
      expect(mockResolveProjectId).not.toHaveBeenCalled()
      expect(mockResolveSandboxId).not.toHaveBeenCalled()
    })

    it(`exits on project resolution failure`, async () => {
      mockResolveProjectId.mockRejectedValue(new Error(`No projects found`))
      await run({ client: makeClient() })

      expect(exitCode).toBe(1)
      expect(mockResolveSandboxId).not.toHaveBeenCalled()
    })

    it(`exits on sandbox resolution failure`, async () => {
      mockResolveSandboxId.mockRejectedValue(new Error(`No sandboxes found`))
      await run({ client: makeClient() })

      expect(exitCode).toBe(1)
      expect(mockSaveContext).not.toHaveBeenCalled()
    })

    it(`writes error message to stderr on failure`, async () => {
      const stderrSpy = vi.spyOn(process.stderr, `write`).mockImplementation(() => true)
      mockResolveOrgId.mockRejectedValue(new Error(`API down`))
      await run({ client: makeClient() })

      const output = stderrSpy.mock.calls.flat().join(``)
      expect(output).toContain(`Error:`)
      expect(output).toContain(`API down`)
    })
  })
})
