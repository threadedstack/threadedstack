import type { ISandbox, ISandboxProvider, TSandboxConfig } from '@tdsk/domain'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock(`e2b`, () => ({ Sandbox: { create: vi.fn() } }))

import { TSAgent } from '@TAG/tsagent'

describe(`TSAgent`, () => {
  let mockSandbox: ISandbox
  let mockProvider: ISandboxProvider
  let agent: TSAgent

  beforeEach(() => {
    mockSandbox = {
      exec: vi.fn(),
      readFile: vi.fn(),
      writeFile: vi.fn(),
      listDir: vi.fn(),
      deleteFile: vi.fn(),
      mkdir: vi.fn(),
      fileExists: vi.fn(),
      close: vi.fn().mockResolvedValue(undefined),
    }

    mockProvider = {
      type: `e2b`,
      create: vi.fn().mockResolvedValue(mockSandbox),
    }

    agent = new TSAgent({ sandboxProvider: mockProvider })
  })

  describe(`constructor`, () => {
    it(`should create a Mutex instance`, () => {
      expect(agent).toBeDefined()
      expect(agent.mutex).toBeDefined()
    })

    it(`should accept custom mutex options`, () => {
      const customAgent = new TSAgent({
        sandboxProvider: mockProvider,
        mutex: { maxLocks: 50, timeout: 10000 },
      })
      expect(customAgent.mutex).toBeDefined()
    })

    it(`should start with zero active sandboxes and locks`, () => {
      const stats = agent.getStats()
      expect(stats.activeSandboxes).toBe(0)
      expect(stats.activeLocks).toBe(0)
    })
  })

  describe(`createSandbox`, () => {
    const config: TSandboxConfig = { provider: `e2b`, template: `base` }

    it(`should call provider.create and store the sandbox`, async () => {
      const sandbox = await agent.createSandbox(`session-1`, config)
      expect(mockProvider.create).toHaveBeenCalledWith(config)
      expect(sandbox).toBe(mockSandbox)
      expect(agent.getStats().activeSandboxes).toBe(1)
    })

    it(`should return existing sandbox for same sessionId without calling provider.create again`, async () => {
      const sb1 = await agent.createSandbox(`session-1`, config)
      const sb2 = await agent.createSandbox(`session-1`, config)
      expect(sb1).toBe(sb2)
      expect(mockProvider.create).toHaveBeenCalledTimes(1)
    })

    it(`should create separate sandboxes for different sessionIds`, async () => {
      const secondSandbox: ISandbox = {
        exec: vi.fn(),
        readFile: vi.fn(),
        writeFile: vi.fn(),
        listDir: vi.fn(),
        deleteFile: vi.fn(),
        mkdir: vi.fn(),
        fileExists: vi.fn(),
        close: vi.fn().mockResolvedValue(undefined),
      }
      ;(mockProvider.create as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(mockSandbox)
        .mockResolvedValueOnce(secondSandbox)

      const sb1 = await agent.createSandbox(`session-1`, config)
      const sb2 = await agent.createSandbox(`session-2`, config)
      expect(sb1).not.toBe(sb2)
      expect(mockProvider.create).toHaveBeenCalledTimes(2)
      expect(agent.getStats().activeSandboxes).toBe(2)
    })
  })

  describe(`getSandbox`, () => {
    it(`should return undefined for unknown sessionId`, async () => {
      const sandbox = await agent.getSandbox(`unknown`)
      expect(sandbox).toBeUndefined()
    })

    it(`should return the sandbox for a known sessionId`, async () => {
      await agent.createSandbox(`session-1`, { provider: `e2b`, template: `base` })
      const sandbox = await agent.getSandbox(`session-1`)
      expect(sandbox).toBe(mockSandbox)
    })
  })

  describe(`destroySandbox`, () => {
    it(`should call close and remove the sandbox from the map`, async () => {
      await agent.createSandbox(`session-1`, { provider: `e2b`, template: `base` })
      expect(agent.getStats().activeSandboxes).toBe(1)

      await agent.destroySandbox(`session-1`)
      expect(mockSandbox.close).toHaveBeenCalled()
      expect(agent.getStats().activeSandboxes).toBe(0)
      expect(await agent.getSandbox(`session-1`)).toBeUndefined()
    })

    it(`should handle close() throwing an error gracefully`, async () => {
      ;(mockSandbox.close as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error(`already destroyed`)
      )
      await agent.createSandbox(`session-1`, { provider: `e2b`, template: `base` })

      await agent.destroySandbox(`session-1`)
      expect(agent.getStats().activeSandboxes).toBe(0)
    })

    it(`should be a no-op for a non-existent sessionId`, async () => {
      await agent.destroySandbox(`non-existent`)
      expect(mockSandbox.close).not.toHaveBeenCalled()
      expect(agent.getStats().activeSandboxes).toBe(0)
    })
  })

  describe(`cleanup`, () => {
    it(`should close all sandboxes and clear the mutex`, async () => {
      await agent.createSandbox(`s1`, { provider: `e2b`, template: `base` })

      const sb2Close = vi.fn().mockResolvedValue(undefined)
      const sb2: ISandbox = {
        exec: vi.fn(),
        readFile: vi.fn(),
        writeFile: vi.fn(),
        listDir: vi.fn(),
        deleteFile: vi.fn(),
        mkdir: vi.fn(),
        fileExists: vi.fn(),
        close: sb2Close,
      }
      ;(mockProvider.create as ReturnType<typeof vi.fn>).mockResolvedValueOnce(sb2)
      await agent.createSandbox(`s2`, { provider: `e2b`, template: `base` })

      expect(agent.getStats().activeSandboxes).toBe(2)

      await agent.cleanup()
      expect(mockSandbox.close).toHaveBeenCalled()
      expect(sb2Close).toHaveBeenCalled()
      expect(agent.getStats().activeSandboxes).toBe(0)
      expect(agent.getStats().activeLocks).toBe(0)
    })

    it(`should handle individual sandbox close errors during cleanup`, async () => {
      ;(mockSandbox.close as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error(`fail`)
      )
      await agent.createSandbox(`s1`, { provider: `e2b`, template: `base` })

      await agent.cleanup()
      expect(agent.getStats().activeSandboxes).toBe(0)
    })
  })

  describe(`getStats`, () => {
    it(`should return correct counts for sandboxes and locks`, async () => {
      expect(agent.getStats()).toEqual({ activeLocks: 0, activeSandboxes: 0 })

      await agent.createSandbox(`s1`, { provider: `e2b`, template: `base` })
      expect(agent.getStats()).toEqual({ activeLocks: 0, activeSandboxes: 1 })

      await agent.createSandbox(`s2`, { provider: `e2b`, template: `base` })
      expect(agent.getStats().activeSandboxes).toBe(2)
    })
  })
})
