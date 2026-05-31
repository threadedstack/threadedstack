import type { TSyncSessionOpts } from '@tdsk/domain'

import { CliDriver } from '@TSA/services/sync/mutagenClient'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockExecFileAsync } = vi.hoisted(() => ({
  mockExecFileAsync: vi.fn(),
}))

vi.mock(`util`, () => ({
  promisify: () => mockExecFileAsync,
}))

vi.mock(`fs`, async () => {
  const actual = await vi.importActual<typeof import('fs')>(`fs`)
  return {
    ...actual,
    existsSync: vi.fn((p: string) => {
      if (p.endsWith(`/mutagen`)) return true
      return actual.existsSync(p)
    }),
    copyFileSync: vi.fn(),
    mkdirSync: vi.fn(),
  }
})

describe(`CliDriver`, () => {
  let driver: CliDriver

  beforeEach(() => {
    driver = new CliDriver()
    mockExecFileAsync.mockReset()
    mockExecFileAsync.mockResolvedValue({ stdout: ``, stderr: `` })
  })

  describe(`createSession`, () => {
    it(`builds correct mutagen args from session opts`, async () => {
      const opts: TSyncSessionOpts = {
        name: `app-source`,
        source: `/home/user/src`,
        target: `/workspace/src`,
        sandboxId: `sb_abc123`,
        mode: `two-way-resolved`,
        ignores: [`.git/`, `node_modules/`],
        labels: { sandboxId: `sb_abc123`, ruleName: `app-source`, orgId: `org_1` },
      }

      await driver.createSession(opts)

      expect(mockExecFileAsync).toHaveBeenCalledOnce()
      const [bin, args] = mockExecFileAsync.mock.calls[0]

      expect(bin).toContain(`mutagen`)
      expect(args[0]).toBe(`sync`)
      expect(args[1]).toBe(`create`)
      expect(args).toContain(`--name=app-source`)
      expect(args).toContain(`--mode=two-way-resolved`)
      expect(args).toContain(`--stage-mode-beta=neighboring`)
      expect(args).toContain(`--ignore=.git/`)
      expect(args).toContain(`--ignore=node_modules/`)
      expect(args).toContain(`--label=sandboxId=sb_abc123`)
      expect(args).toContain(`--label=ruleName=app-source`)
      expect(args).toContain(`/home/user/src`)
      expect(args).toContain(`sandbox@sb_abc123:/workspace/src`)
    })

    it(`uses custom stageMode when provided`, async () => {
      await driver.createSession({
        name: `test`,
        source: `/src`,
        target: `/dst`,
        sandboxId: `sb_1`,
        mode: `two-way-safe`,
        ignores: [],
        labels: { sandboxId: `sb_1`, ruleName: `test`, orgId: `org_1` },
        stageMode: `mutagen`,
      })

      const [, args] = mockExecFileAsync.mock.calls[0]
      expect(args).toContain(`--stage-mode-beta=mutagen`)
    })

    it(`calls mutagen binary directly (no npm wrapper)`, async () => {
      await driver.createSession({
        name: `test`,
        source: `/src`,
        target: `/dst`,
        sandboxId: `sb_1`,
        mode: `two-way-resolved`,
        ignores: [],
        labels: { sandboxId: `sb_1`, ruleName: `test`, orgId: `org_1` },
      })

      const [bin] = mockExecFileAsync.mock.calls[0]
      expect(bin).toContain(`mutagen`)
      // Should be a file path, not a module import
      expect(bin).toMatch(/\/mutagen$/)
    })
  })

  describe(`terminateSession`, () => {
    it(`calls mutagen sync terminate with session id`, async () => {
      await driver.terminateSession(`session-123`)
      const [, args] = mockExecFileAsync.mock.calls[0]
      expect(args).toEqual([`sync`, `terminate`, `session-123`])
    })
  })

  describe(`pauseSession`, () => {
    it(`calls mutagen sync pause with session id`, async () => {
      await driver.pauseSession(`session-123`)
      const [, args] = mockExecFileAsync.mock.calls[0]
      expect(args).toEqual([`sync`, `pause`, `session-123`])
    })
  })

  describe(`resumeSession`, () => {
    it(`calls mutagen sync resume with session id`, async () => {
      await driver.resumeSession(`session-123`)
      const [, args] = mockExecFileAsync.mock.calls[0]
      expect(args).toEqual([`sync`, `resume`, `session-123`])
    })
  })

  describe(`flushSession`, () => {
    it(`calls mutagen sync flush with session id`, async () => {
      await driver.flushSession(`session-123`)
      const [, args] = mockExecFileAsync.mock.calls[0]
      expect(args).toEqual([`sync`, `flush`, `session-123`])
    })
  })

  describe(`listSessions`, () => {
    it(`calls mutagen sync list without filter when no labels`, async () => {
      await driver.listSessions()
      const [, args] = mockExecFileAsync.mock.calls[0]
      expect(args).toEqual([`sync`, `list`])
    })

    it(`adds label-selector when labels provided`, async () => {
      await driver.listSessions({ sandboxId: `sb_abc123` })
      const [, args] = mockExecFileAsync.mock.calls[0]
      expect(args).toEqual([`sync`, `list`, `--label-selector=sandboxId=sb_abc123`])
    })
  })

  describe(`ensureDaemon`, () => {
    it(`calls mutagen daemon start`, async () => {
      await driver.ensureDaemon()
      expect(mockExecFileAsync).toHaveBeenCalledOnce()
      const [, args] = mockExecFileAsync.mock.calls[0]
      expect(args).toEqual([`daemon`, `start`])
    })
  })

  describe(`stopDaemon`, () => {
    it(`calls mutagen daemon stop`, async () => {
      await driver.stopDaemon()
      const [, args] = mockExecFileAsync.mock.calls[0]
      expect(args).toEqual([`daemon`, `stop`])
    })
  })

  describe(`listSessions parsing`, () => {
    it(`parses single session from mutagen list output`, async () => {
      mockExecFileAsync.mockResolvedValue({
        stdout: [
          `Name: app-source`,
          `Identifier: sync_abc123`,
          `Alpha: /home/user/src`,
          `Beta: sandbox@sb_abc123:/workspace/src`,
          `Mode: One Way Replica`,
          `Status: Watching for changes`,
          `Labels:`,
          `  sandboxId: sb_abc123`,
          `  ruleName: app-source`,
          `  orgId: org_1`,
        ].join(`\n`),
        stderr: ``,
      })

      const sessions = await driver.listSessions()
      expect(sessions).toHaveLength(1)
      expect(sessions[0].id).toBe(`sync_abc123`)
      expect(sessions[0].name).toBe(`app-source`)
      expect(sessions[0].status).toBe(`watching`)
      expect(sessions[0].source).toBe(`/home/user/src`)
      expect(sessions[0].target).toBe(`sandbox@sb_abc123:/workspace/src`)
      expect(sessions[0].mode).toBe(`two-way-resolved`)
      expect(sessions[0].labels).toEqual({
        sandboxId: `sb_abc123`,
        ruleName: `app-source`,
        orgId: `org_1`,
      })
    })

    it(`parses multiple sessions separated by dashes`, async () => {
      mockExecFileAsync.mockResolvedValue({
        stdout: [
          `Name: app-source`,
          `Identifier: sync_1`,
          `Status: Watching for changes`,
          ``,
          `--------------------`,
          ``,
          `Name: configs`,
          `Identifier: sync_2`,
          `Status: Paused`,
        ].join(`\n`),
        stderr: ``,
      })

      const sessions = await driver.listSessions()
      expect(sessions).toHaveLength(2)
      expect(sessions[0].name).toBe(`app-source`)
      expect(sessions[0].status).toBe(`watching`)
      expect(sessions[1].name).toBe(`configs`)
      expect(sessions[1].status).toBe(`paused`)
    })

    it(`maps various status strings correctly`, async () => {
      const statusTests = [
        { input: `Scanning files`, expected: `scanning` },
        { input: `Staging files on beta`, expected: `staging` },
        { input: `Transitioning`, expected: `syncing` },
        { input: `Saving archive`, expected: `syncing` },
        { input: `Halted on error`, expected: `errored` },
        { input: `Connecting to beta`, expected: `disconnected` },
      ]

      for (const { input, expected } of statusTests) {
        mockExecFileAsync.mockResolvedValue({
          stdout: `Name: test\nIdentifier: id_1\nStatus: ${input}\n`,
          stderr: ``,
        })
        const sessions = await driver.listSessions()
        expect(sessions[0].status).toBe(expected)
      }
    })

    it(`returns empty array for empty stdout`, async () => {
      mockExecFileAsync.mockResolvedValue({ stdout: ``, stderr: `` })
      const sessions = await driver.listSessions()
      expect(sessions).toEqual([])
    })

    it(`returns empty array for whitespace-only stdout`, async () => {
      mockExecFileAsync.mockResolvedValue({ stdout: `  \n  \n`, stderr: `` })
      const sessions = await driver.listSessions()
      expect(sessions).toEqual([])
    })

    it(`parses two-way-safe mode string`, async () => {
      mockExecFileAsync.mockResolvedValue({
        stdout: `Name: test\nIdentifier: id_1\nMode: Two Way Safe\nStatus: Watching for changes\n`,
        stderr: ``,
      })
      const sessions = await driver.listSessions()
      expect(sessions[0].mode).toBe(`two-way-safe`)
    })

    it(`falls back to undefined when no mode in output`, async () => {
      mockExecFileAsync.mockResolvedValue({
        stdout: `Name: test\nIdentifier: id_1\nStatus: Watching for changes\n`,
        stderr: ``,
      })
      const sessions = await driver.listSessions()
      expect(sessions[0].mode).toBeUndefined()
    })
  })

  describe(`error handling`, () => {
    it(`wraps execFile errors with exit code and stderr`, async () => {
      const execError = Object.assign(new Error(`Command failed`), {
        code: 1,
        stderr: `session not found`,
      })
      mockExecFileAsync.mockRejectedValue(execError)

      await expect(driver.terminateSession(`bad-id`)).rejects.toThrow(
        `mutagen sync failed: session not found`
      )
      await expect(driver.terminateSession(`bad-id`)).rejects.toMatchObject({
        exitCode: 1,
        stderr: `session not found`,
      })
    })

    it(`uses error message when stderr is empty`, async () => {
      const execError = new Error(`spawn ENOENT`)
      mockExecFileAsync.mockRejectedValue(execError)

      await expect(driver.terminateSession(`bad-id`)).rejects.toThrow(
        `mutagen sync failed: spawn ENOENT`
      )
    })
  })
})
