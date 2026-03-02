import { main } from './cli'
import { Version } from '@TRL/constants/version'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockLoadGlobal = vi.fn()
const mockSaveGlobal = vi.fn()
const mockLoadProject = vi.fn().mockReturnValue({})
const mockMerge = vi.fn((global: any, project: any) => ({ ...global, ...project }))
vi.mock(`@TRL/services/config`, () => ({
  ConfigService: {
    loadGlobal: (...args: any[]) => mockLoadGlobal(...args),
    saveGlobal: (...args: any[]) => mockSaveGlobal(...args),
    loadProject: (...args: any[]) => mockLoadProject(...args),
    merge: (global: any, project: any) => mockMerge(global, project),
  },
}))

const mockFetch = vi.fn()
vi.stubGlobal(`fetch`, mockFetch)

const mockPiTuiStart = vi.fn()
const mockPiTuiStop = vi.fn()
const mockChatLogicInit = vi.fn()

vi.mock(`@TRL/renderers/PiTuiApp`, () => ({
  PiTuiApp: vi.fn().mockImplementation(() => ({
    start: mockPiTuiStart,
    stop: mockPiTuiStop,
  })),
}))

vi.mock(`@TRL/renderers/chatLogic`, () => ({
  ChatLogic: vi.fn().mockImplementation(() => {
    const instance: any = {
      init: () => {
        mockChatLogicInit()
        // Trigger onExit immediately so the chat action resolves
        setTimeout(() => instance.onExit?.(), 0)
        return Promise.resolve()
      },
      onExit: null,
    }
    return instance
  }),
}))

vi.mock(`@TRL/executor`, () => ({
  LocalAgentExecutor: vi.fn().mockImplementation(() => ({ client: {} })),
}))

const makeCreds = (
  overrides?: Partial<{ apiKey: string; proxyUrl: string; insecure: boolean }>
) => ({
  apiKey: `tdsk_testkey1234567890`,
  proxyUrl: `https://proxy.test`,
  ...overrides,
})

const setLoggedIn = (creds = makeCreds()) => {
  mockLoadGlobal.mockReturnValue({ auth: creds })
}

const setLoggedOut = () => {
  mockLoadGlobal.mockReturnValue({})
}

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
    vi.spyOn(process, `exit`).mockImplementation((code?: any) => {
      exitCode = code ?? 0
      throw new Error(`__EXIT__`)
    })
    vi.spyOn(process.stderr, `write`).mockImplementation(() => true)
    // Default: loadProject returns empty, merge returns global config
    mockLoadProject.mockReturnValue({})
    mockMerge.mockImplementation((global: any, _project: any) => global)
  })

  const setArgv = (...args: string[]) => {
    process.argv = [`node`, `tsa`, ...args]
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
    it(`should print commands for 'help'`, async () => {
      setArgv(`help`)
      setLoggedOut()
      await runMain()
      expect(joined()).toContain(`Commands:`)
      expect(joined()).toContain(`tsa login`)
      expect(exitCode).toBeUndefined()
    })

    it(`should print commands for '--help'`, async () => {
      setArgv(`--help`)
      setLoggedOut()
      await runMain()
      expect(joined()).toContain(`Commands:`)
    })

    it(`should print commands for '-h'`, async () => {
      setArgv(`-h`)
      setLoggedOut()
      await runMain()
      expect(joined()).toContain(`Commands:`)
    })

    it(`should list all available commands`, async () => {
      setArgv(`help`)
      setLoggedOut()
      await runMain()
      const text = joined()
      expect(text).toContain(`login`)
      expect(text).toContain(`logout`)
      expect(text).toContain(`chat`)
      expect(text).toContain(`agents`)
      expect(text).toContain(`threads`)
      expect(text).toContain(`status`)
      expect(text).toContain(`help`)
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
      expect(joined()).toContain(`Usage: tsa login`)
      expect(exitCode).toBe(1)
    })

    it(`should call auth.login and show success`, async () => {
      setArgv(`login`, `tdsk_newkey123`)
      setLoggedOut()
      mockFetch.mockResolvedValue({ ok: true })
      mockLoadGlobal.mockReturnValue({})

      await runMain()

      expect(joined()).toContain(`Logged in successfully`)
      expect(exitCode).toBeUndefined()
    })

    it(`should pass --url and --insecure flags to login`, async () => {
      setArgv(`login`, `tdsk_newkey123`, `--url`, `https://custom.proxy`, `--insecure`)
      setLoggedOut()
      mockFetch.mockResolvedValue({ ok: true })
      mockLoadGlobal.mockReturnValue({})

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
      expect(joined()).toContain(`Usage: tsa threads`)
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
    it(`should start pi-tui chat when not logged in (REPL handles auth)`, async () => {
      setArgv(`chat`)
      setLoggedOut()
      await runMain()

      expect(mockPiTuiStart).toHaveBeenCalledTimes(1)
      expect(mockChatLogicInit).toHaveBeenCalledTimes(1)
    })

    it(`should start pi-tui chat for default (empty) command when not logged in`, async () => {
      setArgv()
      setLoggedOut()
      await runMain()

      expect(mockPiTuiStart).toHaveBeenCalledTimes(1)
      expect(mockChatLogicInit).toHaveBeenCalledTimes(1)
    })

    it(`should start pi-tui chat with flags`, async () => {
      setArgv(`chat`, `--org`, `org1`, `--agent`, `a1`, `--thread`, `t1`)
      setLoggedIn()
      await runMain()

      expect(mockPiTuiStart).toHaveBeenCalledTimes(1)
      expect(mockChatLogicInit).toHaveBeenCalledTimes(1)
    })

    it(`should start pi-tui chat without flags`, async () => {
      setArgv(`chat`)
      setLoggedIn()
      await runMain()

      expect(mockPiTuiStart).toHaveBeenCalledTimes(1)
      expect(mockChatLogicInit).toHaveBeenCalledTimes(1)
    })
  })

  describe(`alias resolution`, () => {
    it(`should resolve 'li' to login`, async () => {
      setArgv(`li`, `tdsk_newkey123`)
      setLoggedOut()
      mockFetch.mockResolvedValue({ ok: true })
      mockLoadGlobal.mockReturnValue({})

      await runMain()

      expect(joined()).toContain(`Logged in successfully`)
    })

    it(`should resolve 'st' to status`, async () => {
      setArgv(`st`)
      setLoggedOut()
      await runMain()
      expect(joined()).toContain(`not logged in`)
    })

    it(`should resolve 'lo' to logout`, async () => {
      setArgv(`lo`)
      setLoggedIn()
      await runMain()
      expect(joined()).toContain(`Logged out`)
    })
  })

  describe(`default command`, () => {
    it(`should default to chat when first arg is a value flag`, async () => {
      setArgv(`--org`, `org1`)
      setLoggedIn()
      await runMain()

      expect(mockPiTuiStart).toHaveBeenCalledTimes(1)
      expect(mockChatLogicInit).toHaveBeenCalledTimes(1)
    })
  })

  describe(`config defaults`, () => {
    it(`should use config org as default when no --org flag`, async () => {
      setArgv(`chat`)
      mockLoadGlobal.mockReturnValue({ auth: makeCreds() })
      mockMerge.mockReturnValue({ org: `cfg-org`, auth: makeCreds() })
      await runMain()

      expect(mockPiTuiStart).toHaveBeenCalledTimes(1)
      expect(mockChatLogicInit).toHaveBeenCalledTimes(1)
    })

    it(`should use config agent as default when no --agent flag`, async () => {
      setArgv(`chat`)
      mockLoadGlobal.mockReturnValue({ auth: makeCreds() })
      mockMerge.mockReturnValue({ org: `cfg-org`, agent: `cfg-agent`, auth: makeCreds() })
      await runMain()

      expect(mockPiTuiStart).toHaveBeenCalledTimes(1)
      expect(mockChatLogicInit).toHaveBeenCalledTimes(1)
    })

    it(`should override config defaults with explicit flags`, async () => {
      setArgv(`chat`, `--org`, `explicit-org`)
      mockLoadGlobal.mockReturnValue({ auth: makeCreds() })
      mockMerge.mockReturnValue({ org: `cfg-org`, agent: `cfg-agent`, auth: makeCreds() })
      await runMain()

      expect(mockPiTuiStart).toHaveBeenCalledTimes(1)
      expect(mockChatLogicInit).toHaveBeenCalledTimes(1)
    })
  })

  describe(`unknown command`, () => {
    it(`should show error for unknown command`, async () => {
      setArgv(`foobar`)
      setLoggedOut()
      await runMain()
      expect(joined()).toContain(`Task Error:`)
      expect(joined()).toContain(`foobar`)
      expect(exitCode).toBe(1)
    })
  })
})
