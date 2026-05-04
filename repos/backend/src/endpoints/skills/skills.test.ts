import type { Response } from 'express'
import type { TRequest } from '@TBE/types'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { EPMethod } from '@TBE/types'
import { listSkills } from './listSkills'
import { getSkill } from './getSkill'
import { createSkill } from './createSkill'
import { updateSkill } from './updateSkill'
import { deleteSkill } from './deleteSkill'
import { attachSkill } from './attachSkill'
import { detachSkill } from './detachSkill'

const mockCheckPermission = vi.hoisted(() => vi.fn())

vi.mock(`@TBE/utils/logger`, () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

vi.mock(`@TBE/utils/auth/checkPermission`, () => ({
  checkPermission: mockCheckPermission.mockResolvedValue(undefined),
}))

// ── HELPERS ──────────────────────────────────────────────────────────

const mockSkill = {
  id: `skill-1`,
  name: `Test Skill`,
  orgId: `org-1`,
  description: `A test skill`,
  instructions: `Do the thing`,
  tools: [],
  triggerKeywords: [],
  alwaysActive: false,
}

const mockAgent = {
  id: `agent-1`,
  name: `Test Agent`,
  orgId: `org-1`,
}

const buildMockReqRes = () => {
  const mockJson = vi.fn()
  const mockStatus = vi.fn().mockReturnThis()

  const skillService = {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    addAgent: vi.fn(),
    removeAgent: vi.fn(),
  }

  const agentService = {
    get: vi.fn(),
  }

  const mockRes = {
    status: mockStatus,
    json: mockJson,
  } as unknown as Response

  const mockReq = {
    app: {
      locals: {
        db: {
          services: {
            skill: skillService,
            agent: agentService,
          },
        },
      },
    } as any,
    user: { id: `user-1`, email: `test@example.com` } as any,
    params: { orgId: `org-1` },
    body: {},
  } as unknown as TRequest

  return { mockReq, mockRes, mockJson, mockStatus, skillService, agentService }
}

// ── ENDPOINT CONFIG ──────────────────────────────────────────────────

describe(`Skills endpoint configuration`, () => {
  it(`listSkills should have correct path and method`, () => {
    expect(listSkills.path).toBe(`/`)
    expect(listSkills.method).toBe(EPMethod.Get)
  })

  it(`getSkill should have correct path and method`, () => {
    expect(getSkill.path).toBe(`/:skillId`)
    expect(getSkill.method).toBe(EPMethod.Get)
  })

  it(`createSkill should have correct path and method`, () => {
    expect(createSkill.path).toBe(`/`)
    expect(createSkill.method).toBe(EPMethod.Post)
  })

  it(`updateSkill should have correct path and method`, () => {
    expect(updateSkill.path).toBe(`/:skillId`)
    expect(updateSkill.method).toBe(EPMethod.Put)
  })

  it(`deleteSkill should have correct path and method`, () => {
    expect(deleteSkill.path).toBe(`/:skillId`)
    expect(deleteSkill.method).toBe(EPMethod.Delete)
  })

  it(`attachSkill should have correct path and method`, () => {
    expect(attachSkill.path).toBe(`/:skillId/agents/:agentId`)
    expect(attachSkill.method).toBe(EPMethod.Post)
  })

  it(`detachSkill should have correct path and method`, () => {
    expect(detachSkill.path).toBe(`/:skillId/agents/:agentId`)
    expect(detachSkill.method).toBe(EPMethod.Delete)
  })
})

// ── LIST SKILLS ──────────────────────────────────────────────────────

describe(`GET / - listSkills`, () => {
  let mockReq: TRequest
  let mockRes: Response
  let mockJson: ReturnType<typeof vi.fn>
  let skillService: ReturnType<typeof buildMockReqRes>['skillService']

  beforeEach(() => {
    vi.clearAllMocks()
    const ctx = buildMockReqRes()
    mockReq = ctx.mockReq
    mockRes = ctx.mockRes
    mockJson = ctx.mockJson
    skillService = ctx.skillService
  })

  it(`should return skills for org`, async () => {
    skillService.list.mockResolvedValue({ data: [mockSkill] })

    await listSkills.action(mockReq, mockRes)

    expect(skillService.list).toHaveBeenCalledWith({ where: { orgId: `org-1` } })
    expect(mockJson).toHaveBeenCalledWith({ data: [mockSkill] })
  })

  it(`should return empty array when no skills exist`, async () => {
    skillService.list.mockResolvedValue({ data: null })

    await listSkills.action(mockReq, mockRes)

    expect(mockJson).toHaveBeenCalledWith({ data: [] })
  })

  it(`should throw 400 when orgId is missing`, async () => {
    mockReq.params = {} as any

    await expect(listSkills.action(mockReq, mockRes)).rejects.toThrow(`orgId is required`)
  })

  it(`should throw 500 when service returns error`, async () => {
    skillService.list.mockResolvedValue({ error: { message: `DB failure` } })

    await expect(listSkills.action(mockReq, mockRes)).rejects.toThrow(`DB failure`)
  })
})

// ── GET SKILL ────────────────────────────────────────────────────────

describe(`GET /:skillId - getSkill`, () => {
  let mockReq: TRequest
  let mockRes: Response
  let mockJson: ReturnType<typeof vi.fn>
  let skillService: ReturnType<typeof buildMockReqRes>['skillService']

  beforeEach(() => {
    vi.clearAllMocks()
    const ctx = buildMockReqRes()
    mockReq = ctx.mockReq
    mockRes = ctx.mockRes
    mockJson = ctx.mockJson
    skillService = ctx.skillService
    mockReq.params = { orgId: `org-1`, skillId: `skill-1` } as any
  })

  it(`should return skill by id`, async () => {
    skillService.get.mockResolvedValue({ data: mockSkill })

    await getSkill.action(mockReq, mockRes)

    expect(skillService.get).toHaveBeenCalledWith(`skill-1`)
    expect(mockJson).toHaveBeenCalledWith({ data: mockSkill })
  })

  it(`should throw 404 when skill not found`, async () => {
    skillService.get.mockResolvedValue({ data: null })

    await expect(getSkill.action(mockReq, mockRes)).rejects.toThrow(`Skill not found`)
  })

  it(`should throw 404 when service returns no data`, async () => {
    skillService.get.mockResolvedValue({})

    await expect(getSkill.action(mockReq, mockRes)).rejects.toThrow(`Skill not found`)
  })

  it(`should throw 500 when service returns error`, async () => {
    skillService.get.mockResolvedValue({ error: { message: `DB error` } })

    await expect(getSkill.action(mockReq, mockRes)).rejects.toThrow(`DB error`)
  })

  it(`should throw 404 when skill belongs to different org`, async () => {
    skillService.get.mockResolvedValue({ data: { ...mockSkill, orgId: `other-org` } })

    await expect(getSkill.action(mockReq, mockRes)).rejects.toThrow(`Skill not found`)
  })

  it(`should throw 400 when orgId is missing`, async () => {
    mockReq.params = { skillId: `skill-1` } as any

    await expect(getSkill.action(mockReq, mockRes)).rejects.toThrow(`orgId is required`)
  })

  it(`should throw 400 when skillId is missing`, async () => {
    mockReq.params = { orgId: `org-1` } as any

    await expect(getSkill.action(mockReq, mockRes)).rejects.toThrow(`skillId is required`)
  })
})

// ── CREATE SKILL ─────────────────────────────────────────────────────

describe(`POST / - createSkill`, () => {
  let mockReq: TRequest
  let mockRes: Response
  let mockJson: ReturnType<typeof vi.fn>
  let mockStatus: ReturnType<typeof vi.fn>
  let skillService: ReturnType<typeof buildMockReqRes>['skillService']

  beforeEach(() => {
    vi.clearAllMocks()
    const ctx = buildMockReqRes()
    mockReq = ctx.mockReq
    mockRes = ctx.mockRes
    mockJson = ctx.mockJson
    mockStatus = ctx.mockStatus
    skillService = ctx.skillService
  })

  it(`should create skill with valid data`, async () => {
    skillService.create.mockResolvedValue({ data: mockSkill })

    mockReq.body = {
      name: `Test Skill`,
      description: `A test skill`,
      instructions: `Do the thing`,
      triggerKeywords: [],
      tools: [],
      alwaysActive: false,
    }

    await createSkill.action(mockReq, mockRes)

    expect(skillService.create).toHaveBeenCalled()
    expect(mockStatus).toHaveBeenCalledWith(201)
    expect(mockJson).toHaveBeenCalledWith({ data: mockSkill })
  })

  it(`should throw 400 when name is missing`, async () => {
    mockReq.body = { instructions: `Do stuff` }

    await expect(createSkill.action(mockReq, mockRes)).rejects.toThrow(`name is required`)
  })

  it(`should throw 400 when instructions is missing`, async () => {
    mockReq.body = { name: `My Skill` }

    await expect(createSkill.action(mockReq, mockRes)).rejects.toThrow(
      `instructions is required`
    )
  })

  it(`should throw 400 when orgId is missing`, async () => {
    mockReq.params = {} as any
    mockReq.body = { name: `Skill`, instructions: `Do stuff` }

    await expect(createSkill.action(mockReq, mockRes)).rejects.toThrow(
      `orgId is required`
    )
  })

  it(`should default optional fields when not provided`, async () => {
    skillService.create.mockResolvedValue({ data: mockSkill })

    mockReq.body = { name: `Minimal`, instructions: `Do minimal things` }

    await createSkill.action(mockReq, mockRes)

    const createdSkill = skillService.create.mock.calls[0][0]
    expect(createdSkill.description).toBe(``)
    expect(createdSkill.triggerKeywords).toEqual([])
    expect(createdSkill.tools).toEqual([])
    expect(createdSkill.alwaysActive).toBe(false)
  })

  it(`should throw 500 when service returns error`, async () => {
    skillService.create.mockResolvedValue({ error: { message: `Create failed` } })

    mockReq.body = { name: `Skill`, instructions: `Do stuff` }

    await expect(createSkill.action(mockReq, mockRes)).rejects.toThrow(`Create failed`)
  })
})

// ── UPDATE SKILL ─────────────────────────────────────────────────────

describe(`PUT /:skillId - updateSkill`, () => {
  let mockReq: TRequest
  let mockRes: Response
  let mockJson: ReturnType<typeof vi.fn>
  let skillService: ReturnType<typeof buildMockReqRes>['skillService']

  beforeEach(() => {
    vi.clearAllMocks()
    const ctx = buildMockReqRes()
    mockReq = ctx.mockReq
    mockRes = ctx.mockRes
    mockJson = ctx.mockJson
    skillService = ctx.skillService
    mockReq.params = { orgId: `org-1`, skillId: `skill-1` } as any
  })

  it(`should update skill fields`, async () => {
    skillService.get.mockResolvedValue({ data: mockSkill })
    const updated = { ...mockSkill, name: `Updated Name` }
    skillService.update.mockResolvedValue({ data: updated })

    mockReq.body = { name: `Updated Name` }

    await updateSkill.action(mockReq, mockRes)

    expect(skillService.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: `skill-1`, name: `Updated Name` })
    )
    expect(mockJson).toHaveBeenCalledWith({ data: updated })
  })

  it(`should throw 404 when skill not found`, async () => {
    skillService.get.mockResolvedValue({ data: null })

    mockReq.body = { name: `New Name` }

    await expect(updateSkill.action(mockReq, mockRes)).rejects.toThrow(`Skill not found`)
  })

  it(`should throw 404 when skill belongs to different org`, async () => {
    skillService.get.mockResolvedValue({ data: { ...mockSkill, orgId: `other-org` } })

    mockReq.body = { name: `New Name` }

    await expect(updateSkill.action(mockReq, mockRes)).rejects.toThrow(`Skill not found`)
  })

  it(`should throw 400 when orgId is missing`, async () => {
    mockReq.params = { skillId: `skill-1` } as any

    await expect(updateSkill.action(mockReq, mockRes)).rejects.toThrow(
      `orgId is required`
    )
  })

  it(`should throw 400 when skillId is missing`, async () => {
    mockReq.params = { orgId: `org-1` } as any

    await expect(updateSkill.action(mockReq, mockRes)).rejects.toThrow(
      `skillId is required`
    )
  })

  it(`should only include provided fields in update`, async () => {
    skillService.get.mockResolvedValue({ data: mockSkill })
    skillService.update.mockResolvedValue({ data: mockSkill })

    mockReq.body = { description: `New description` }

    await updateSkill.action(mockReq, mockRes)

    const updateArg = skillService.update.mock.calls[0][0]
    expect(updateArg.id).toBe(`skill-1`)
    expect(updateArg.description).toBe(`New description`)
    expect(updateArg).not.toHaveProperty(`name`)
    expect(updateArg).not.toHaveProperty(`instructions`)
  })

  it(`should throw 500 when update service returns error`, async () => {
    skillService.get.mockResolvedValue({ data: mockSkill })
    skillService.update.mockResolvedValue({ error: { message: `Update failed` } })

    mockReq.body = { name: `Updated` }

    await expect(updateSkill.action(mockReq, mockRes)).rejects.toThrow(`Update failed`)
  })
})

// ── DELETE SKILL ─────────────────────────────────────────────────────

describe(`DELETE /:skillId - deleteSkill`, () => {
  let mockReq: TRequest
  let mockRes: Response
  let mockJson: ReturnType<typeof vi.fn>
  let skillService: ReturnType<typeof buildMockReqRes>['skillService']

  beforeEach(() => {
    vi.clearAllMocks()
    const ctx = buildMockReqRes()
    mockReq = ctx.mockReq
    mockRes = ctx.mockRes
    mockJson = ctx.mockJson
    skillService = ctx.skillService
    mockReq.params = { orgId: `org-1`, skillId: `skill-1` } as any
  })

  it(`should delete skill and return id`, async () => {
    skillService.get.mockResolvedValue({ data: mockSkill })
    skillService.delete.mockResolvedValue({})

    await deleteSkill.action(mockReq, mockRes)

    expect(skillService.delete).toHaveBeenCalledWith(`skill-1`)
    expect(mockJson).toHaveBeenCalledWith({ data: { id: `skill-1` } })
  })

  it(`should throw 404 when skill not found`, async () => {
    skillService.get.mockResolvedValue({ data: null })

    await expect(deleteSkill.action(mockReq, mockRes)).rejects.toThrow(`Skill not found`)
  })

  it(`should throw 404 when skill belongs to different org`, async () => {
    skillService.get.mockResolvedValue({ data: { ...mockSkill, orgId: `other-org` } })

    await expect(deleteSkill.action(mockReq, mockRes)).rejects.toThrow(`Skill not found`)
  })

  it(`should throw 400 when orgId is missing`, async () => {
    mockReq.params = { skillId: `skill-1` } as any

    await expect(deleteSkill.action(mockReq, mockRes)).rejects.toThrow(
      `orgId is required`
    )
  })

  it(`should throw 400 when skillId is missing`, async () => {
    mockReq.params = { orgId: `org-1` } as any

    await expect(deleteSkill.action(mockReq, mockRes)).rejects.toThrow(
      `skillId is required`
    )
  })

  it(`should throw 500 when delete service returns error`, async () => {
    skillService.get.mockResolvedValue({ data: mockSkill })
    skillService.delete.mockResolvedValue({ error: { message: `Delete failed` } })

    await expect(deleteSkill.action(mockReq, mockRes)).rejects.toThrow(`Delete failed`)
  })
})

// ── ATTACH SKILL ─────────────────────────────────────────────────────

describe(`POST /:skillId/agents/:agentId - attachSkill`, () => {
  let mockReq: TRequest
  let mockRes: Response
  let mockJson: ReturnType<typeof vi.fn>
  let mockStatus: ReturnType<typeof vi.fn>
  let skillService: ReturnType<typeof buildMockReqRes>['skillService']
  let agentService: ReturnType<typeof buildMockReqRes>['agentService']

  beforeEach(() => {
    vi.clearAllMocks()
    const ctx = buildMockReqRes()
    mockReq = ctx.mockReq
    mockRes = ctx.mockRes
    mockJson = ctx.mockJson
    mockStatus = ctx.mockStatus
    skillService = ctx.skillService
    agentService = ctx.agentService
    mockReq.params = { orgId: `org-1`, skillId: `skill-1`, agentId: `agent-1` } as any
  })

  it(`should attach skill to agent`, async () => {
    skillService.get.mockResolvedValue({ data: mockSkill })
    agentService.get.mockResolvedValue({ data: mockAgent })
    skillService.addAgent.mockResolvedValue({})

    await attachSkill.action(mockReq, mockRes)

    expect(skillService.addAgent).toHaveBeenCalledWith(`skill-1`, `agent-1`)
    expect(mockStatus).toHaveBeenCalledWith(201)
    expect(mockJson).toHaveBeenCalledWith({
      data: { agentId: `agent-1`, skillId: `skill-1` },
    })
  })

  it(`should throw 404 when skill not found`, async () => {
    skillService.get.mockResolvedValue({ data: null })

    await expect(attachSkill.action(mockReq, mockRes)).rejects.toThrow(`Skill not found`)
  })

  it(`should throw 404 when skill belongs to different org`, async () => {
    skillService.get.mockResolvedValue({ data: { ...mockSkill, orgId: `other-org` } })

    await expect(attachSkill.action(mockReq, mockRes)).rejects.toThrow(`Skill not found`)
  })

  it(`should throw 404 when agent not found`, async () => {
    skillService.get.mockResolvedValue({ data: mockSkill })
    agentService.get.mockResolvedValue({ data: null })

    await expect(attachSkill.action(mockReq, mockRes)).rejects.toThrow(`Agent not found`)
  })

  it(`should throw 404 when agent belongs to different org`, async () => {
    skillService.get.mockResolvedValue({ data: mockSkill })
    agentService.get.mockResolvedValue({ data: { ...mockAgent, orgId: `other-org` } })

    await expect(attachSkill.action(mockReq, mockRes)).rejects.toThrow(`Agent not found`)
  })

  it(`should throw 400 when orgId is missing`, async () => {
    mockReq.params = { skillId: `skill-1`, agentId: `agent-1` } as any

    await expect(attachSkill.action(mockReq, mockRes)).rejects.toThrow(
      `orgId is required`
    )
  })

  it(`should throw 400 when skillId is missing`, async () => {
    mockReq.params = { orgId: `org-1`, agentId: `agent-1` } as any

    await expect(attachSkill.action(mockReq, mockRes)).rejects.toThrow(
      `skillId is required`
    )
  })

  it(`should throw 400 when agentId is missing`, async () => {
    mockReq.params = { orgId: `org-1`, skillId: `skill-1` } as any

    await expect(attachSkill.action(mockReq, mockRes)).rejects.toThrow(
      `agentId is required`
    )
  })
})

// ── DETACH SKILL ─────────────────────────────────────────────────────

describe(`DELETE /:skillId/agents/:agentId - detachSkill`, () => {
  let mockReq: TRequest
  let mockRes: Response
  let mockJson: ReturnType<typeof vi.fn>
  let skillService: ReturnType<typeof buildMockReqRes>['skillService']
  let agentService: ReturnType<typeof buildMockReqRes>['agentService']

  beforeEach(() => {
    vi.clearAllMocks()
    const ctx = buildMockReqRes()
    mockReq = ctx.mockReq
    mockRes = ctx.mockRes
    mockJson = ctx.mockJson
    skillService = ctx.skillService
    agentService = ctx.agentService
    mockReq.params = { orgId: `org-1`, skillId: `skill-1`, agentId: `agent-1` } as any
  })

  it(`should detach skill from agent`, async () => {
    skillService.get.mockResolvedValue({ data: mockSkill })
    agentService.get.mockResolvedValue({ data: mockAgent })
    skillService.removeAgent.mockResolvedValue({})

    await detachSkill.action(mockReq, mockRes)

    expect(skillService.removeAgent).toHaveBeenCalledWith(`skill-1`, `agent-1`)
    expect(mockJson).toHaveBeenCalledWith({
      data: { agentId: `agent-1`, skillId: `skill-1` },
    })
  })

  it(`should throw 404 when skill not found`, async () => {
    skillService.get.mockResolvedValue({ data: null })

    await expect(detachSkill.action(mockReq, mockRes)).rejects.toThrow(`Skill not found`)
  })

  it(`should throw 404 when skill belongs to different org`, async () => {
    skillService.get.mockResolvedValue({ data: { ...mockSkill, orgId: `other-org` } })

    await expect(detachSkill.action(mockReq, mockRes)).rejects.toThrow(`Skill not found`)
  })

  it(`should throw 404 when agent not found`, async () => {
    skillService.get.mockResolvedValue({ data: mockSkill })
    agentService.get.mockResolvedValue({ data: null })

    await expect(detachSkill.action(mockReq, mockRes)).rejects.toThrow(`Agent not found`)
  })

  it(`should throw 404 when agent belongs to different org`, async () => {
    skillService.get.mockResolvedValue({ data: mockSkill })
    agentService.get.mockResolvedValue({ data: { ...mockAgent, orgId: `other-org` } })

    await expect(detachSkill.action(mockReq, mockRes)).rejects.toThrow(`Agent not found`)
  })

  it(`should throw 400 when orgId is missing`, async () => {
    mockReq.params = { skillId: `skill-1`, agentId: `agent-1` } as any

    await expect(detachSkill.action(mockReq, mockRes)).rejects.toThrow(
      `orgId is required`
    )
  })

  it(`should throw 400 when skillId is missing`, async () => {
    mockReq.params = { orgId: `org-1`, agentId: `agent-1` } as any

    await expect(detachSkill.action(mockReq, mockRes)).rejects.toThrow(
      `skillId is required`
    )
  })

  it(`should throw 400 when agentId is missing`, async () => {
    mockReq.params = { orgId: `org-1`, skillId: `skill-1` } as any

    await expect(detachSkill.action(mockReq, mockRes)).rejects.toThrow(
      `agentId is required`
    )
  })
})
