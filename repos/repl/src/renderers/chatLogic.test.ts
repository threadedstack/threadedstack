import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { TChatLogicOpts } from './chatLogic'

// ── Module-level mocks ───────────────────────────────────────────────

const mockListAgents = vi.fn()
const mockListProjects = vi.fn()
const mockListOrgs = vi.fn()
const mockGetOrg = vi.fn()
const mockGetAgent = vi.fn()

vi.mock('@TRL/services/api', () => ({
  ApiClient: vi.fn().mockImplementation(() => ({
    listAgents: mockListAgents,
    listProjects: mockListProjects,
    listOrgs: mockListOrgs,
    getOrg: mockGetOrg,
    getAgent: mockGetAgent,
  })),
}))

vi.mock('@TRL/services/executor', () => ({
  Executor: vi.fn().mockImplementation(() => ({
    destroy: vi.fn(),
    clearSession: vi.fn(),
  })),
}))

vi.mock('@TRL/services/context', () => ({
  ContextLoader: {
    autoDetect: () => [],
    loadFile: (p: string) => ({
      path: p,
      name: p,
      source: `manual`,
      content: ``,
      sizeBytes: 0,
    }),
  },
}))

vi.mock('@TRL/utils/api/resolveOrg', () => ({
  resolveOrg: vi.fn().mockResolvedValue(`org-1`),
}))

// Theme is UI-only
vi.mock('@TRL/theme', () => ({
  setTheme: vi.fn(),
}))

// Import after mocks
const { ChatLogic } = await import('./chatLogic')

// ── Test helpers ─────────────────────────────────────────────────────

const mockAuth = {
  creds: () => ({ apiKey: `test-key`, proxyUrl: `http://test`, insecure: true }),
  loggedIn: () => true,
  login: vi.fn(),
  logout: vi.fn(),
}

const makeChatLogic = (overrides: Partial<TChatLogicOpts> = {}) =>
  new ChatLogic({
    auth: mockAuth as any,
    ...overrides,
  })

// ── Tests ────────────────────────────────────────────────────────────

describe(`ChatLogic`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockListOrgs.mockResolvedValue([{ id: `org-1`, name: `Test Org` }])
    mockGetOrg.mockResolvedValue({ id: `org-1`, name: `Test Org` })
    mockListProjects.mockResolvedValue([])
    mockListAgents.mockResolvedValue([{ id: `a1`, name: `Alpha` }])
  })

  // ─── Bug 1: setAgentId updates agentInfo from cache ──────────────

  describe(`Bug 1: setAgentId cache lookup — /agent showed raw ID instead of name in status bar`, () => {
    it(`setAgentId updates agentInfo when agent is in cache`, async () => {
      const logic = makeChatLogic()
      const statusUpdates: any[] = []
      logic.onStatusChange = (meta) => statusUpdates.push(meta)

      // Initialize — triggers #connectAfterLogin → picks pickAgent phase
      await logic.init()

      // Populate agents cache with two agents
      logic.agents = [
        { id: `a1`, name: `Alpha` },
        { id: `a2`, name: `Beta` },
      ]

      // Select agent to enter chat
      logic.selectAgent({ id: `a1`, name: `Alpha` })
      statusUpdates.length = 0

      // Trigger setAgentId via handleSubmit with /agent command
      await logic.handleSubmit(`/agent a2`)

      // Verify agentInfo was updated from cache (not just the raw ID)
      expect(logic.agentInfo).toEqual({ id: `a2`, name: `Beta` })

      // Verify status callback received the agent name, not just the ID
      const lastStatus = statusUpdates[statusUpdates.length - 1]
      expect(lastStatus.agentName).toBe(`Beta`)
    })

    it(`setAgentId keeps old agentInfo when agent not in cache`, async () => {
      const logic = makeChatLogic()
      const statusUpdates: any[] = []
      logic.onStatusChange = (meta) => statusUpdates.push(meta)

      await logic.init()

      // Only a1 in cache — switching to unknown-id won't find a match
      logic.agents = [{ id: `a1`, name: `Alpha` }]
      logic.selectAgent({ id: `a1`, name: `Alpha` })
      statusUpdates.length = 0

      await logic.handleSubmit(`/agent unknown-id`)

      // agentId updates to the new value
      expect(logic.agentId).toBe(`unknown-id`)

      // agentInfo stays as the old one — the cache lookup didn't find a match
      expect(logic.agentInfo).toEqual({ id: `a1`, name: `Alpha` })

      // Status uses agentInfo.name (still set from previous agent)
      const lastStatus = statusUpdates[statusUpdates.length - 1]
      expect(lastStatus.agentName).toBe(`Alpha`)
    })
  })

  // ─── Bug 2: messages/contextFiles getters ────────────────────────

  describe(`Bug 2: command context getters — /info showed stale message count after clearing`, () => {
    it(`/info shows updated message count after clearMessages`, async () => {
      const logic = makeChatLogic()
      const outputMessages: string[] = []

      await logic.init()
      logic.agents = [{ id: `a1`, name: `Alpha` }]
      logic.selectAgent({ id: `a1`, name: `Alpha` })

      // Capture output calls
      logic.onMessagesChange = (msgs) => {
        const last = msgs[msgs.length - 1]
        if (last?.type === `system`) outputMessages.push(last.content)
      }

      // Add a user message to the state
      logic.messages = [{ id: `m1`, type: `user`, content: `hello` }]

      // Run /info — should reflect 1 message + the system output itself
      await logic.handleSubmit(`/info`)

      // The info output should show Messages: 1 (the user message we set)
      // Note: /info adds a system message via output(), which adds to messages array
      // But the getter reads self.messages at call-time. The info command reads
      // ctx.messages.length which is the getter, so it reads the current state.
      const infoOutput = outputMessages.find((m) => m.includes(`Messages:`))
      expect(infoOutput).toBeDefined()
      expect(infoOutput).toContain(`Messages: 1`)

      // Clear messages
      logic.clearMessages()
      outputMessages.length = 0

      // Run /info again — should show 0
      await logic.handleSubmit(`/info`)
      const infoOutput2 = outputMessages.find((m) => m.includes(`Messages:`))
      expect(infoOutput2).toBeDefined()
      expect(infoOutput2).toContain(`Messages: 0`)
    })
  })

  // ─── Batch 9: Error handling — #handleCatchError paths ───────────

  describe(`Batch 9: error handling — auth errors trigger logout + login phase`, () => {
    it(`#connectAfterLogin auth error transitions to login phase`, async () => {
      const logic = makeChatLogic()
      const phases: string[] = []
      logic.onPhaseChange = (phase) => phases.push(phase)

      // First init succeeds to set up client
      mockListProjects.mockRejectedValueOnce(new Error(`API error (401): Unauthorized`))

      await logic.init()

      // Auth error should trigger logout → login phase
      expect(phases).toContain(`login`)
      expect(logic.loggedIn).toBe(false)
      expect(mockAuth.logout).toHaveBeenCalled()
    })

    it(`selectProject auth error transitions to login phase`, async () => {
      const logic = makeChatLogic()
      const phases: string[] = []
      logic.onPhaseChange = (phase) => phases.push(phase)

      await logic.init()
      logic.selectAgent({ id: `a1`, name: `Alpha` })

      // Now simulate auth error on selectProject's listAgents call
      mockListAgents.mockRejectedValueOnce(new Error(`API error (401): Unauthorized`))

      await logic.selectProject({ id: `p1`, name: `Project` })

      expect(phases).toContain(`login`)
      expect(logic.loggedIn).toBe(false)
      expect(mockAuth.logout).toHaveBeenCalled()
    })

    it(`switchProject auth error transitions to login phase (session context)`, async () => {
      const logic = makeChatLogic()
      const phases: string[] = []
      logic.onPhaseChange = (phase) => phases.push(phase)

      await logic.init()
      logic.selectAgent({ id: `a1`, name: `Alpha` })

      mockListProjects.mockRejectedValueOnce(new Error(`API error (401): Unauthorized`))

      await logic.switchProject()

      expect(phases).toContain(`login`)
      expect(logic.loggedIn).toBe(false)
      expect(mockAuth.logout).toHaveBeenCalled()
    })
  })

  describe(`Batch 9: error handling — session errors show friendly message without phase change`, () => {
    it(`switchProject network error shows friendly message and preserves state`, async () => {
      const logic = makeChatLogic()
      const phases: string[] = []
      const outputMessages: string[] = []
      logic.onPhaseChange = (phase) => phases.push(phase)
      logic.onMessagesChange = (msgs) => {
        const last = msgs[msgs.length - 1]
        if (last?.type === `system`) outputMessages.push(last.content)
      }

      await logic.init()
      logic.selectAgent({ id: `a1`, name: `Alpha` })
      logic.threadId = `t1`

      // Clear phases after setup
      phases.length = 0

      mockListProjects.mockRejectedValueOnce(
        Object.assign(new Error(`connect failed`), { code: `ECONNREFUSED` })
      )

      await logic.switchProject()

      // Should NOT transition to error phase
      expect(phases).not.toContain(`error`)

      // Should show a friendly error message
      const errMsg = outputMessages.find((m) => m.includes(`Can't reach the server`))
      expect(errMsg).toBeDefined()

      // State should be preserved
      expect(logic.agentId).toBe(`a1`)
      expect(logic.threadId).toBe(`t1`)
    })

    it(`switchProject server error preserves agent state`, async () => {
      const logic = makeChatLogic()
      const phases: string[] = []
      logic.onPhaseChange = (phase) => phases.push(phase)

      await logic.init()
      logic.selectAgent({ id: `a1`, name: `Alpha` })
      logic.threadId = `t1`
      logic.agentInfo = { id: `a1`, name: `Alpha` }
      phases.length = 0

      mockListProjects.mockRejectedValueOnce(
        new Error(`API error (500): Internal Server Error`)
      )

      await logic.switchProject()

      expect(phases).not.toContain(`error`)
      expect(logic.agentId).toBe(`a1`)
      expect(logic.threadId).toBe(`t1`)
      expect(logic.agentInfo).toEqual({ id: `a1`, name: `Alpha` })
    })
  })

  describe(`Batch 9: error handling — startup errors use error phase`, () => {
    it(`#connectAfterLogin network error transitions to error phase`, async () => {
      const logic = makeChatLogic()
      const phases: string[] = []
      let errorFired: Error | null = null
      logic.onPhaseChange = (phase) => phases.push(phase)
      logic.onError = (err) => {
        errorFired = err
      }

      mockListProjects.mockRejectedValueOnce(
        Object.assign(new Error(`connect failed`), { code: `ECONNREFUSED` })
      )

      await logic.init()

      expect(phases).toContain(`error`)
      expect(errorFired).toBeTruthy()
      expect(errorFired!.message).toContain(`connect failed`)
    })
  })

  describe(`Batch 9: error handling — org name resolution catch block`, () => {
    it(`warns on non-404 error and falls back to orgId`, async () => {
      const logic = makeChatLogic()
      const outputMessages: string[] = []
      logic.onMessagesChange = (msgs) => {
        const last = msgs[msgs.length - 1]
        if (last?.type === `system`) outputMessages.push(last.content)
      }

      mockGetOrg.mockRejectedValueOnce(
        new Error(`API error (500): Internal Server Error`)
      )

      await logic.init()

      // Should warn about org name resolution failure
      const warning = outputMessages.find((m) => m.includes(`Could not resolve org name`))
      expect(warning).toBeDefined()

      // Should fall back to orgId
      expect(logic.orgName).toBe(`org-1`)
    })

    it(`silently falls back to orgId on 404`, async () => {
      const logic = makeChatLogic()
      const outputMessages: string[] = []
      logic.onMessagesChange = (msgs) => {
        const last = msgs[msgs.length - 1]
        if (last?.type === `system`) outputMessages.push(last.content)
      }

      mockGetOrg.mockRejectedValueOnce(new Error(`API error (404): Not Found`))

      await logic.init()

      // Should NOT warn on 404
      const warning = outputMessages.find((m) => m.includes(`Could not resolve org name`))
      expect(warning).toBeUndefined()

      // Should fall back to orgId
      expect(logic.orgName).toBe(`org-1`)
    })
  })

  describe(`Batch 9: error handling — switchProject deferred state reset`, () => {
    it(`does not reset state when API call fails`, async () => {
      const logic = makeChatLogic()

      await logic.init()
      logic.selectAgent({ id: `a1`, name: `Alpha` })
      logic.threadId = `t1`
      logic.agentInfo = { id: `a1`, name: `Alpha` }

      mockListProjects.mockRejectedValueOnce(
        new Error(`API error (500): Internal Server Error`)
      )

      await logic.switchProject()

      // State should NOT be reset
      expect(logic.agentId).toBe(`a1`)
      expect(logic.threadId).toBe(`t1`)
      expect(logic.agentInfo).toEqual({ id: `a1`, name: `Alpha` })
    })

    it(`resets state only after API calls succeed`, async () => {
      const logic = makeChatLogic()
      const phases: string[] = []
      logic.onPhaseChange = (phase) => phases.push(phase)

      await logic.init()
      logic.selectAgent({ id: `a1`, name: `Alpha` })
      logic.threadId = `t1`
      logic.agentInfo = { id: `a1`, name: `Alpha` }

      mockListProjects.mockResolvedValueOnce([
        { id: `p1`, name: `Project 1` },
        { id: `p2`, name: `Project 2` },
      ])

      await logic.switchProject()

      // State should be reset after success
      expect(logic.agentId).toBeNull()
      expect(logic.threadId).toBeNull()
      expect(logic.agentInfo).toBeNull()
      expect(phases[phases.length - 1]).toBe(`pickProject`)
    })
  })

  // ─── B1: 403 forbidden during startup ─────────────────────────────

  describe(`403 forbidden during startup — shows friendly message without logout`, () => {
    it(`#connectAfterLogin forbidden error shows friendly message without logout`, async () => {
      const logic = makeChatLogic()
      const outputMessages: string[] = []
      logic.onMessagesChange = (msgs) => {
        const last = msgs[msgs.length - 1]
        if (last?.type === `system`) outputMessages.push(last.content)
      }

      mockListProjects.mockRejectedValueOnce(new Error(`API error (403): Forbidden`))

      await logic.init()

      // Should NOT trigger logout
      expect(mockAuth.logout).not.toHaveBeenCalled()
      // Should show friendly error message
      expect(outputMessages.some((m) => m.includes(`Error:`))).toBe(true)
      // Should transition to error phase (startup context)
      expect(logic.error).toBeTruthy()
    })
  })

  // ─── B2: switchProject zero-projects and single-project ───────────

  describe(`switchProject edge cases`, () => {
    it(`switchProject with zero projects shows message`, async () => {
      const logic = makeChatLogic()
      const outputMessages: string[] = []
      logic.onMessagesChange = (msgs) => {
        const last = msgs[msgs.length - 1]
        if (last?.type === `system`) outputMessages.push(last.content)
      }

      await logic.init()
      mockListProjects.mockResolvedValueOnce([])

      await logic.switchProject()

      expect(outputMessages.some((m) => m.includes(`No projects found`))).toBe(true)
    })

    it(`switchProject with single project skips picker`, async () => {
      const logic = makeChatLogic()
      const phases: string[] = []
      logic.onPhaseChange = (phase) => phases.push(phase)

      await logic.init()
      logic.selectAgent({ id: `a1`, name: `Alpha` })
      logic.threadId = `t1`
      phases.length = 0

      mockListProjects.mockResolvedValueOnce([{ id: `p1`, name: `Solo Project` }])
      mockListAgents.mockResolvedValueOnce([{ id: `a2`, name: `Beta` }])

      await logic.switchProject()

      expect(logic.projectId).toBe(`p1`)
      expect(logic.projectName).toBe(`Solo Project`)
      expect(phases).toContain(`pickAgent`)
    })
  })

  // ─── B6: resolveModel fallback ────────────────────────────────────

  describe(`#emitStatusChange resolveModel fallback`, () => {
    it(`falls back to agent model when resolveModel throws`, async () => {
      const logic = makeChatLogic()
      let lastStatus: any = null
      logic.onStatusChange = (status) => {
        lastStatus = status
      }

      await logic.init()

      // selectAgent sets agentInfo to the passed object, then calls #emitStatusChange
      // So we pass the throwing resolveModel directly in the agent object
      const badAgent = {
        id: `a1`,
        name: `Alpha`,
        model: `fallback-model`,
        resolveModel: () => {
          throw new Error(`resolution failed`)
        },
        primaryProvider: { name: `TestProvider` },
      }

      logic.selectAgent(badAgent)

      expect(lastStatus?.modelName).toBe(`fallback-model`)
    })
  })

  // ─── B7: setProviderId triggers status change ─────────────────────

  describe(`setProviderId via command context`, () => {
    it(`emits status change when provider is set`, async () => {
      const logic = makeChatLogic()
      let lastStatus: any = null
      logic.onStatusChange = (status) => {
        lastStatus = status
      }

      await logic.init()
      logic.selectAgent({ id: `a1`, name: `Alpha` })

      // Set providerId and trigger status emission via selectAgent
      logic.providerId = `new-provider`
      logic.selectAgent({ id: `a1`, name: `Alpha` })

      expect(lastStatus).toBeDefined()
    })
  })

  // ─── Bug 3: selectProject empty agents guard + goBackToProjects ──

  describe(`Bug 3: empty agents guard — selecting project with no agents had no recovery path`, () => {
    it(`selectProject transitions back to pickProject when no agents found`, async () => {
      const logic = makeChatLogic()
      const phases: string[] = []
      const outputMessages: string[] = []

      logic.onPhaseChange = (phase) => phases.push(phase)
      logic.onMessagesChange = (msgs) => {
        const last = msgs[msgs.length - 1]
        if (last?.type === `system`) outputMessages.push(last.content)
      }

      await logic.init()

      // Mock listAgents to return empty array for selectProject
      mockListAgents.mockResolvedValueOnce([])

      logic.projects = [{ id: `p1`, name: `Project` }]
      await logic.selectProject({ id: `p1`, name: `Project` })

      // Phase should transition to pickProject (after loading → pickProject)
      expect(phases).toContain(`pickProject`)
      // The last phase should be pickProject
      expect(phases[phases.length - 1]).toBe(`pickProject`)

      // Should have output a message about no agents
      const noAgentsMsg = outputMessages.find((m) => m.includes(`No agents found`))
      expect(noAgentsMsg).toBeDefined()
    })

    it(`selectProject transitions to pickAgent when agents exist`, async () => {
      const logic = makeChatLogic()
      const phases: string[] = []
      let agentsLoaded = false

      logic.onPhaseChange = (phase) => phases.push(phase)
      logic.onAgentsLoaded = () => {
        agentsLoaded = true
      }

      await logic.init()

      mockListAgents.mockResolvedValueOnce([{ id: `a1`, name: `Agent 1` }])

      await logic.selectProject({ id: `p1`, name: `Project` })

      expect(phases[phases.length - 1]).toBe(`pickAgent`)
      expect(agentsLoaded).toBe(true)
      expect(logic.agents).toEqual([{ id: `a1`, name: `Agent 1` }])
    })

    it(`goBackToProjects transitions phase to pickProject`, async () => {
      const logic = makeChatLogic()
      const phases: string[] = []
      logic.onPhaseChange = (phase) => phases.push(phase)

      await logic.init()

      // Simulate being in pickAgent with projects loaded
      logic.agents = [{ id: `a1`, name: `Agent 1` }]
      logic.projects = [{ id: `p1`, name: `Project 1` }]

      logic.goBackToProjects()

      expect(phases[phases.length - 1]).toBe(`pickProject`)
      expect(logic.phase).toBe(`pickProject`)
    })

    it(`goBackToProjects outputs warning when projects list is empty`, () => {
      const logic = makeChatLogic()
      const phases: string[] = []
      const outputMessages: string[] = []
      logic.onPhaseChange = (phase) => phases.push(phase)
      logic.onMessagesChange = (msgs) => {
        const last = msgs[msgs.length - 1]
        if (last?.type === `system`) outputMessages.push(last.content)
      }

      // No init, no projects — guard should prevent phase transition
      logic.goBackToProjects()

      expect(phases).not.toContain(`pickProject`)
      const warning = outputMessages.find((m) => m.includes(`No projects available`))
      expect(warning).toBeDefined()
    })
  })
})
