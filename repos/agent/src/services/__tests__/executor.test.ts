import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Executor } from '@TAG/services/executor'
import { spawnSync } from 'node:child_process'

vi.mock(`node:child_process`)

describe(`Executor`, () => {
  let executor: Executor

  beforeEach(() => {
    vi.clearAllMocks()
    executor = new Executor({ timeout: 5000 })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe(`Constructor`, () => {
    it(`should initialize with default timeout`, () => {
      const defaultExecutor = new Executor()
      expect(defaultExecutor).toBeDefined()
    })

    it(`should initialize with custom timeout`, () => {
      const customExecutor = new Executor({ timeout: 10000 })
      expect(customExecutor).toBeDefined()
    })

    it(`should accept custom allowed commands`, () => {
      const customCommands = new Set([`custom-cmd`])
      const customExecutor = new Executor({ allowedCommands: customCommands })
      expect(customExecutor).toBeDefined()
    })

    it(`should accept custom blocked patterns`, () => {
      const customPatterns = [/dangerous/]
      const customExecutor = new Executor({ blockedPatterns: customPatterns })
      expect(customExecutor).toBeDefined()
    })
  })

  describe(`exec() - Command Allowlist`, () => {
    it(`should execute allowed commands`, async () => {
      vi.mocked(spawnSync).mockReturnValue({
        stdout: `command output`,
        stderr: ``,
        error: undefined,
      } as any)

      executor.allowCommand(`ls`)
      const result = await executor.exec(`ls`, [`-la`], `/tmp/test`)

      expect(spawnSync).toHaveBeenCalledWith(`ls`, [`-la`], {
        cwd: `/tmp/test`,
        shell: false,
        encoding: `utf-8`,
        timeout: 5000,
        env: {
          PATH: process.env.PATH,
          HOME: `/data`,
        },
      })
      expect(result).toBe(`command output`)
    })

    it(`should reject commands not in allowlist`, async () => {
      // Use safe args to test command rejection (not arg rejection)
      await expect(executor.exec(`chown`, [`file.txt`], `/tmp`)).rejects.toThrow(
        `SECURITY: Command 'chown' denied. Not in allowlist.`
      )

      expect(spawnSync).not.toHaveBeenCalled()
    })
  })

  describe(`exec() - Argument Blocking`, () => {
    it(`should block arguments matching blocked patterns`, async () => {
      executor.allowCommand(`echo`)
      executor.addBlockedPattern(/rm\s+-rf/)

      await expect(executor.exec(`echo`, [`rm -rf /`], `/tmp`)).rejects.toThrow(
        `SECURITY: Arg 'rm -rf /' matches blocked pattern`
      )

      expect(spawnSync).not.toHaveBeenCalled()
    })

    it(`should allow safe arguments`, async () => {
      vi.mocked(spawnSync).mockReturnValue({
        stdout: `safe output`,
        stderr: ``,
        error: undefined,
      } as any)

      executor.allowCommand(`echo`)
      const result = await executor.exec(`echo`, [`hello world`], `/tmp`)

      expect(result).toBe(`safe output`)
    })

    it(`should check all arguments against all patterns`, async () => {
      executor.allowCommand(`test`)
      executor.addBlockedPattern(/\.\./g)
      executor.addBlockedPattern(/\/etc\/passwd/)

      await expect(
        executor.exec(`test`, [`normal`, `../dangerous`], `/tmp`)
      ).rejects.toThrow(`matches blocked pattern`)

      await expect(executor.exec(`test`, [`/etc/passwd`], `/tmp`)).rejects.toThrow(
        `matches blocked pattern`
      )
    })
  })

  describe(`exec() - Execution`, () => {
    it(`should return stdout when command succeeds`, async () => {
      vi.mocked(spawnSync).mockReturnValue({
        stdout: `success output`,
        stderr: ``,
        error: undefined,
      } as any)

      executor.allowCommand(`test-cmd`)
      const result = await executor.exec(`test-cmd`, [], `/tmp`)

      expect(result).toBe(`success output`)
    })

    it(`should return stderr when stdout is empty`, async () => {
      vi.mocked(spawnSync).mockReturnValue({
        stdout: ``,
        stderr: `error output`,
        error: undefined,
      } as any)

      executor.allowCommand(`test-cmd`)
      const result = await executor.exec(`test-cmd`, [], `/tmp`)

      expect(result).toBe(`error output`)
    })

    it(`should return default message when both stdout and stderr are empty`, async () => {
      vi.mocked(spawnSync).mockReturnValue({
        stdout: ``,
        stderr: ``,
        error: undefined,
      } as any)

      executor.allowCommand(`test-cmd`)
      const result = await executor.exec(`test-cmd`, [], `/tmp`)

      expect(result).toBe(`Command completed with no output`)
    })

    it(`should throw error when command execution fails`, async () => {
      vi.mocked(spawnSync).mockReturnValue({
        stdout: ``,
        stderr: ``,
        error: new Error(`Command not found`),
      } as any)

      executor.allowCommand(`bad-cmd`)
      await expect(executor.exec(`bad-cmd`, [], `/tmp`)).rejects.toThrow(
        `Execution Error: Command not found`
      )
    })

    it(`should execute in specified directory`, async () => {
      vi.mocked(spawnSync).mockReturnValue({
        stdout: `output`,
        stderr: ``,
        error: undefined,
      } as any)

      executor.allowCommand(`pwd`)
      await executor.exec(`pwd`, [], `/custom/dir`)

      expect(spawnSync).toHaveBeenCalledWith(
        `pwd`,
        [],
        expect.objectContaining({
          cwd: `/custom/dir`,
        })
      )
    })

    it(`should enforce timeout`, async () => {
      vi.mocked(spawnSync).mockReturnValue({
        stdout: `slept`,
        stderr: ``,
        error: undefined,
      } as any)

      executor.allowCommand(`sleep`)
      await executor.exec(`sleep`, [`1`], `/tmp`)

      expect(spawnSync).toHaveBeenCalledWith(
        `sleep`,
        [`1`],
        expect.objectContaining({
          timeout: 5000,
        })
      )
    })

    it(`should disable shell expansion`, async () => {
      vi.mocked(spawnSync).mockReturnValue({
        stdout: `test`,
        stderr: ``,
        error: undefined,
      } as any)

      executor.allowCommand(`echo`)
      await executor.exec(`echo`, [`test`], `/tmp`)

      expect(spawnSync).toHaveBeenCalledWith(
        `echo`,
        [`test`],
        expect.objectContaining({
          shell: false, // Critical for security
        })
      )
    })

    it(`should set minimal environment`, async () => {
      vi.mocked(spawnSync).mockReturnValue({
        stdout: `PATH=/usr/bin\nHOME=/data`,
        stderr: ``,
        error: undefined,
      } as any)

      executor.allowCommand(`env`)
      await executor.exec(`env`, [], `/tmp`)

      expect(spawnSync).toHaveBeenCalledWith(
        `env`,
        [],
        expect.objectContaining({
          env: {
            PATH: process.env.PATH,
            HOME: `/data`,
          },
        })
      )
    })
  })

  describe(`allowCommand()`, () => {
    it(`should add command to allowlist`, async () => {
      vi.mocked(spawnSync).mockReturnValue({
        stdout: `ok`,
        stderr: ``,
        error: undefined,
      } as any)

      executor.allowCommand(`custom-cmd`)
      const result = await executor.exec(`custom-cmd`, [], `/tmp`)

      expect(result).toBe(`ok`)
    })

    it(`should allow multiple custom commands`, async () => {
      executor.allowCommand(`cmd1`)
      executor.allowCommand(`cmd2`)
      executor.allowCommand(`cmd3`)

      vi.mocked(spawnSync).mockReturnValue({
        stdout: `ok`,
        stderr: ``,
        error: undefined,
      } as any)

      await executor.exec(`cmd1`, [], `/tmp`)
      await executor.exec(`cmd2`, [], `/tmp`)
      await executor.exec(`cmd3`, [], `/tmp`)

      expect(spawnSync).toHaveBeenCalledTimes(3)
    })
  })

  describe(`disallowCommand()`, () => {
    it(`should remove command from allowlist`, async () => {
      executor.allowCommand(`test-cmd`)
      executor.disallowCommand(`test-cmd`)

      await expect(executor.exec(`test-cmd`, [], `/tmp`)).rejects.toThrow(
        `denied. Not in allowlist`
      )
    })

    it(`should not affect other commands`, async () => {
      vi.mocked(spawnSync).mockReturnValue({
        stdout: `ok`,
        stderr: ``,
        error: undefined,
      } as any)

      executor.allowCommand(`cmd1`)
      executor.allowCommand(`cmd2`)
      executor.disallowCommand(`cmd1`)

      await expect(executor.exec(`cmd1`, [], `/tmp`)).rejects.toThrow()
      await executor.exec(`cmd2`, [], `/tmp`) // Should work
    })
  })

  describe(`addBlockedPattern()`, () => {
    it(`should add pattern to blocklist`, async () => {
      executor.allowCommand(`test`)
      executor.addBlockedPattern(/malicious/)

      await expect(executor.exec(`test`, [`malicious-arg`], `/tmp`)).rejects.toThrow(
        `matches blocked pattern`
      )
    })

    it(`should support multiple blocked patterns`, async () => {
      executor.allowCommand(`test`)
      executor.addBlockedPattern(/danger/)
      executor.addBlockedPattern(/evil/)
      executor.addBlockedPattern(/bad/)

      await expect(executor.exec(`test`, [`danger`], `/tmp`)).rejects.toThrow()
      await expect(executor.exec(`test`, [`evil`], `/tmp`)).rejects.toThrow()
      await expect(executor.exec(`test`, [`bad`], `/tmp`)).rejects.toThrow()
    })

    it(`should support complex regex patterns`, async () => {
      executor.allowCommand(`test`)
      executor.addBlockedPattern(/^\.\.[\/\\]/) // Path traversal

      await expect(
        executor.exec(`test`, [`../../../etc/passwd`], `/tmp`)
      ).rejects.toThrow()
    })
  })

  describe(`Security validation order`, () => {
    it(`should check command allowlist before argument patterns`, async () => {
      executor.addBlockedPattern(/anything/)

      // Command should be rejected before checking arguments
      await expect(executor.exec(`forbidden-cmd`, [`safe-arg`], `/tmp`)).rejects.toThrow(
        `denied. Not in allowlist`
      )
    })

    it(`should validate all security checks`, async () => {
      executor.allowCommand(`test`)

      // First rejection should be for command
      await expect(executor.exec(`bad`, [], `/tmp`)).rejects.toThrow(`allowlist`)

      // Second should be for arguments
      executor.addBlockedPattern(/bad/)
      await expect(executor.exec(`test`, [`bad`], `/tmp`)).rejects.toThrow(
        `blocked pattern`
      )
    })
  })
})
