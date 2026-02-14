import { describe, it, expect, vi, beforeEach } from 'vitest'
import { parseArgs, main, printUsage, Version } from './cli'

vi.mock(`node:fs`, () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  unlinkSync: vi.fn(),
  mkdirSync: vi.fn(),
}))

const mockFetch = vi.fn()
vi.stubGlobal(`fetch`, mockFetch)

const mockReplStart = vi.fn().mockResolvedValue(undefined)
vi.mock(`@TRL/repl`, () => ({
  AgentRepl: vi.fn().mockImplementation(() => ({ start: mockReplStart })),
}))

vi.mock(`@TRL/executor`, () => ({
  LocalAgentExecutor: vi.fn().mockImplementation(() => ({ client: {} })),
}))

import { existsSync, readFileSync } from 'node:fs'

const makeCreds = (
  overrides?: Partial<{ apiKey: string; proxyUrl: string; insecure: boolean }>
) => ({
  apiKey: `tdsk_testkey1234567890`,
  proxyUrl: `https://proxy.test`,
  ...overrides,
})

const setLoggedIn = (creds = makeCreds()) => {
  vi.mocked(existsSync).mockReturnValue(true)
  vi.mocked(readFileSync).mockReturnValue(JSON.stringify(creds))
}

const setLoggedOut = () => {
  vi.mocked(existsSync).mockReturnValue(false)
}

describe(`parseArgs`, () => {
  it(`should parse command from argv[2]`, () => {
    const result = parseArgs([`node`, `script`, `help`])
    expect(result.command).toBe(`help`)
  })

  it(`should default command to empty string`, () => {
    const result = parseArgs([`node`, `script`])
    expect(result.command).toBe(``)
  })

  it(`should collect positional args after command`, () => {
    const result = parseArgs([`node`, `script`, `login`, `my-key`])
    expect(result.positional).toEqual([`my-key`])
  })

  it(`should parse boolean flags`, () => {
    const result = parseArgs([`node`, `script`, `login`, `--insecure`])
    expect(result.flags.insecure).toBe(true)
  })

  it(`should parse value flags`, () => {
    const result = parseArgs([`node`, `script`, `login`, `--url`, `https://proxy.test`])
    expect(result.flags.url).toBe(`https://proxy.test`)
  })

  it(`should parse mixed positional and flags`, () => {
    const result = parseArgs([`node`, `script`, `threads`, `agent-1`, `--org`, `org-1`])
    expect(result.command).toBe(`threads`)
    expect(result.positional).toEqual([`agent-1`])
    expect(result.flags.org).toBe(`org-1`)
  })

  it(`should handle empty argv`, () => {
    const result = parseArgs([])
    expect(result.command).toBe(``)
    expect(result.positional).toEqual([])
    expect(result.flags).toEqual({})
  })

  it(`should treat flag followed by another flag as boolean`, () => {
    const result = parseArgs([
      `node`,
      `script`,
      `login`,
      `key`,
      `--insecure`,
      `--url`,
      `https://x`,
    ])
    expect(result.flags.insecure).toBe(true)
    expect(result.flags.url).toBe(`https://x`)
  })
})

describe(`main`, () => {
  let output: string[]
  let exitCode: number | undefined

  beforeEach(() => {
    vi.clearAllMocks()
    output = []
    exitCode = undefined
    vi.spyOn(process.stdout, `write`).mockImplementation((chunk: any) => {
      output.push(String(chunk))
      return true
    })
    vi.spyOn(process, `exit`).mockImplementation((code?: number) => {
      exitCode = code ?? 0
      throw new Error(`__EXIT__`)
    })
  })

  const setArgv = (...args: string[]) => {
    process.argv = [`node`, `tdsk-agent`, ...args]
  }

  const runMain = async () => {
    try {
      await main()
    } catch (err: any) {
      if (err.message !== `__EXIT__`) throw err
    }
  }

  const joined = () => output.join(``)

  describe(`help command`, () => {
    it(`should print usage for 'help'`, async () => {
      setArgv(`help`)
      setLoggedOut()
      await runMain()
      expect(joined()).toContain(`Usage:`)
      expect(joined()).toContain(`tdsk-agent login`)
      expect(exitCode).toBeUndefined()
    })

    it(`should print usage for '--help'`, async () => {
      setArgv(`--help`)
      setLoggedOut()
      await runMain()
      expect(joined()).toContain(`Usage:`)
    })

    it(`should print usage for '-h'`, async () => {
      setArgv(`-h`)
      setLoggedOut()
      await runMain()
      expect(joined()).toContain(`Usage:`)
    })
  })

  describe(`version command`, () => {
    it(`should print version for '--version'`, async () => {
      setArgv(`--version`)
      setLoggedOut()
      await runMain()
      expect(joined()).toContain(`v${Version}`)
    })

    it(`should print version for '-v'`, async () => {
      setArgv(`-v`)
      setLoggedOut()
      await runMain()
      expect(joined()).toContain(`v${Version}`)
    })
  })

  describe(`login command`, () => {
    it(`should require api key argument`, async () => {
      setArgv(`login`)
      setLoggedOut()
      await runMain()
      expect(joined()).toContain(`Usage: tdsk-agent login`)
      expect(exitCode).toBe(1)
    })

    it(`should call auth.login and show success`, async () => {
      setArgv(`login`, `tdsk_newkey123`)
      setLoggedOut()
      mockFetch.mockResolvedValue({ ok: true })
      vi.mocked(existsSync).mockReturnValue(true)

      await runMain()

      expect(joined()).toContain(`Logged in successfully`)
      expect(exitCode).toBeUndefined()
    })

    it(`should pass --url and --insecure flags to login`, async () => {
      setArgv(`login`, `tdsk_newkey123`, `--url`, `https://custom.proxy`, `--insecure`)
      setLoggedOut()
      mockFetch.mockResolvedValue({ ok: true })
      vi.mocked(existsSync).mockReturnValue(true)

      await runMain()

      expect(mockFetch).toHaveBeenCalledWith(
        `https://custom.proxy/_/orgs`,
        expect.any(Object)
      )
    })

    it(`should show error on login failure`, async () => {
      setArgv(`login`, `tdsk_badkey`)
      setLoggedOut()
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => `Unauthorized`,
      })

      await runMain()

      expect(joined()).toContain(`Error:`)
      expect(joined()).toContain(`401`)
      expect(exitCode).toBe(1)
    })

    it(`should show error for invalid key format`, async () => {
      setArgv(`login`, `bad_key_no_prefix`)
      setLoggedOut()

      await runMain()

      expect(joined()).toContain(`Error:`)
      expect(joined()).toContain(`Invalid API key format`)
      expect(exitCode).toBe(1)
    })
  })

  describe(`logout command`, () => {
    it(`should logout and show success`, async () => {
      setArgv(`logout`)
      setLoggedIn()
      await runMain()
      expect(joined()).toContain(`Logged out`)
      expect(exitCode).toBeUndefined()
    })
  })

  describe(`status command`, () => {
    it(`should show logged in state with masked key`, async () => {
      setArgv(`status`)
      setLoggedIn()
      await runMain()
      expect(joined()).toContain(`logged in`)
      expect(joined()).toContain(`proxy.test`)
      expect(joined()).toContain(`tdsk_tes`)
      expect(joined()).toContain(`********`)
    })

    it(`should show not logged in state`, async () => {
      setArgv(`status`)
      setLoggedOut()
      await runMain()
      expect(joined()).toContain(`not logged in`)
    })
  })

  describe(`agents command`, () => {
    it(`should require auth`, async () => {
      setArgv(`agents`)
      setLoggedOut()
      await runMain()
      expect(joined()).toContain(`Not logged in`)
      expect(exitCode).toBe(1)
    })

    it(`should list agents with auto-selected single org`, async () => {
      setArgv(`agents`)
      setLoggedIn()
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: [{ id: `org1`, name: `TestOrg` }] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: [
              { id: `a1`, name: `Bot1`, model: `gpt-4` },
              { id: `a2`, name: `Bot2` },
            ],
          }),
        })

      await runMain()

      expect(joined()).toContain(`Agents:`)
      expect(joined()).toContain(`Bot1`)
      expect(joined()).toContain(`Bot2`)
      expect(joined()).toContain(`gpt-4`)
    })

    it(`should list orgs when multiple exist`, async () => {
      setArgv(`agents`)
      setLoggedIn()
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            { id: `org1`, name: `Org A` },
            { id: `org2`, name: `Org B` },
          ],
        }),
      })

      await runMain()

      expect(joined()).toContain(`Organizations:`)
      expect(joined()).toContain(`Org A`)
      expect(joined()).toContain(`Org B`)
      expect(joined()).toContain(`--org`)
    })

    it(`should show no agents found`, async () => {
      setArgv(`agents`)
      setLoggedIn()
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: [{ id: `org1`, name: `TestOrg` }] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: [] }),
        })

      await runMain()

      expect(joined()).toContain(`No agents found`)
    })

    it(`should use --org flag to skip org selection`, async () => {
      setArgv(`agents`, `--org`, `org1`)
      setLoggedIn()
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ id: `a1`, name: `Bot1` }],
        }),
      })

      await runMain()

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/orgs/org1/agents`),
        expect.any(Object)
      )
      expect(joined()).toContain(`Bot1`)
    })

    it(`should handle API error`, async () => {
      setArgv(`agents`)
      setLoggedIn()
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: `Internal Server Error`,
        text: async () => `Server error`,
      })

      await runMain()

      expect(joined()).toContain(`Error:`)
      expect(exitCode).toBe(1)
    })
  })

  describe(`threads command`, () => {
    it(`should require auth`, async () => {
      setArgv(`threads`, `agent-1`)
      setLoggedOut()
      await runMain()
      expect(joined()).toContain(`Not logged in`)
      expect(exitCode).toBe(1)
    })

    it(`should require agent-id argument`, async () => {
      setArgv(`threads`)
      setLoggedIn()
      await runMain()
      expect(joined()).toContain(`Usage: tdsk-agent threads`)
      expect(exitCode).toBe(1)
    })

    it(`should list threads with auto-selected single org`, async () => {
      setArgv(`threads`, `agent-1`)
      setLoggedIn()
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: [{ id: `org1` }] }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            data: [
              { id: `t1`, name: `Chat 1` },
              { id: `t2`, name: `Chat 2` },
            ],
          }),
        })

      await runMain()

      expect(joined()).toContain(`Threads:`)
      expect(joined()).toContain(`Chat 1`)
      expect(joined()).toContain(`Chat 2`)
    })

    it(`should use --org flag`, async () => {
      setArgv(`threads`, `agent-1`, `--org`, `org1`)
      setLoggedIn()
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ id: `t1`, name: `Thread` }],
        }),
      })

      await runMain()

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/orgs/org1/agents/agent-1/threads`),
        expect.any(Object)
      )
    })

    it(`should warn when multiple orgs and no --org flag`, async () => {
      setArgv(`threads`, `agent-1`)
      setLoggedIn()
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [{ id: `org1` }, { id: `org2` }],
        }),
      })

      await runMain()

      expect(joined()).toContain(`Multiple orgs found`)
      expect(exitCode).toBe(1)
    })

    it(`should show no threads found`, async () => {
      setArgv(`threads`, `agent-1`, `--org`, `org1`)
      setLoggedIn()
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      })

      await runMain()

      expect(joined()).toContain(`No threads found`)
    })
  })

  describe(`chat command`, () => {
    it(`should require auth`, async () => {
      setArgv(`chat`)
      setLoggedOut()
      await runMain()
      expect(joined()).toContain(`Not logged in`)
      expect(exitCode).toBe(1)
    })

    it(`should require auth for default (empty) command`, async () => {
      setArgv()
      setLoggedOut()
      await runMain()
      expect(joined()).toContain(`Not logged in`)
      expect(exitCode).toBe(1)
    })

    it(`should start repl with flags`, async () => {
      setArgv(`chat`, `--org`, `org1`, `--agent`, `a1`, `--thread`, `t1`)
      setLoggedIn()
      await runMain()

      expect(mockReplStart).toHaveBeenCalledWith({
        orgId: `org1`,
        agentId: `a1`,
        threadId: `t1`,
      })
    })

    it(`should start repl without flags`, async () => {
      setArgv(`chat`)
      setLoggedIn()
      await runMain()

      expect(mockReplStart).toHaveBeenCalledWith({
        orgId: undefined,
        agentId: undefined,
        threadId: undefined,
      })
    })
  })

  describe(`unknown command`, () => {
    it(`should show error and usage`, async () => {
      setArgv(`foobar`)
      setLoggedOut()
      await runMain()
      expect(joined()).toContain(`Unknown command:`)
      expect(joined()).toContain(`foobar`)
      expect(joined()).toContain(`Usage:`)
      expect(exitCode).toBe(1)
    })
  })
})

describe(`printUsage`, () => {
  it(`should output all command descriptions`, () => {
    const output: string[] = []
    vi.spyOn(process.stdout, `write`).mockImplementation((chunk: any) => {
      output.push(String(chunk))
      return true
    })

    printUsage()

    const text = output.join(``)
    expect(text).toContain(`login`)
    expect(text).toContain(`logout`)
    expect(text).toContain(`chat`)
    expect(text).toContain(`agents`)
    expect(text).toContain(`threads`)
    expect(text).toContain(`status`)
    expect(text).toContain(`help`)
  })
})
