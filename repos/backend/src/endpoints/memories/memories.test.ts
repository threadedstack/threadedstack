import type { Response } from 'express'
import type { TRequest } from '@TBE/types'
import { describe, it, expect, vi, beforeEach } from 'vitest'

import { EPMethod } from '@TBE/types'
import { listMemories } from './listMemories'
import { createMemory } from './createMemory'
import { updateMemory } from './updateMemory'
import { deleteMemory } from './deleteMemory'
import { searchMemories } from './searchMemories'
import { MemoryMaxTextChars, MemoryMaxImportance } from '@tdsk/domain'

const mockCheckPermission = vi.hoisted(() => vi.fn())

vi.mock(`@TBE/utils/logger`, () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

vi.mock(`@TBE/utils/auth/checkPermission`, () => ({
  checkPermission: mockCheckPermission.mockResolvedValue(undefined),
}))

// ── HELPERS ──────────────────────────────────────────────────────────

const mockMemory = {
  id: `mm_1`,
  orgId: `org-1`,
  agentId: `agent-1`,
  kind: `fact`,
  text: `The observer runs hourly`,
  importance: 7,
  embedding: null,
  meta: null,
}

const mockAgent = { id: `agent-1`, name: `Steward`, orgId: `org-1` }

const buildMockReqRes = () => {
  const mockJson = vi.fn()
  const mockStatus = vi.fn().mockReturnThis()

  const memoryService = {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    searchScored: vi.fn(),
  }
  const agentService = { get: vi.fn().mockResolvedValue({ data: mockAgent }) }
  const embeddings = { embedOne: vi.fn().mockResolvedValue(null) }

  const mockRes = { status: mockStatus, json: mockJson } as unknown as Response

  const mockReq = {
    app: {
      locals: {
        embeddings,
        db: { services: { memory: memoryService, agent: agentService } },
      },
    } as any,
    user: { id: `user-1`, email: `test@example.com` } as any,
    params: { orgId: `org-1`, agentId: `agent-1` },
    query: {},
    body: {},
  } as unknown as TRequest

  return {
    mockReq,
    mockRes,
    mockJson,
    mockStatus,
    memoryService,
    agentService,
    embeddings,
  }
}

// ── ENDPOINT CONFIG ──────────────────────────────────────────────────

describe(`Memories endpoint configuration`, () => {
  it(`listMemories path/method`, () => {
    expect(listMemories.path).toBe(`/`)
    expect(listMemories.method).toBe(EPMethod.Get)
  })
  it(`createMemory path/method`, () => {
    expect(createMemory.path).toBe(`/`)
    expect(createMemory.method).toBe(EPMethod.Post)
  })
  it(`updateMemory path/method`, () => {
    expect(updateMemory.path).toBe(`/:memoryId`)
    expect(updateMemory.method).toBe(EPMethod.Put)
  })
  it(`deleteMemory path/method`, () => {
    expect(deleteMemory.path).toBe(`/:memoryId`)
    expect(deleteMemory.method).toBe(EPMethod.Delete)
  })
  it(`searchMemories path/method`, () => {
    expect(searchMemories.path).toBe(`/search`)
    expect(searchMemories.method).toBe(EPMethod.Post)
  })
})

// ── LIST ─────────────────────────────────────────────────────────────

describe(`GET / - listMemories`, () => {
  let ctx: ReturnType<typeof buildMockReqRes>
  beforeEach(() => {
    vi.clearAllMocks()
    ctx = buildMockReqRes()
  })

  it(`lists memories scoped to org + agent`, async () => {
    ctx.memoryService.list.mockResolvedValue({ data: [mockMemory] })
    await listMemories.action(ctx.mockReq, ctx.mockRes)
    expect(ctx.memoryService.list).toHaveBeenCalledWith(
      expect.objectContaining({ where: { orgId: `org-1`, agentId: `agent-1` } })
    )
    expect(ctx.mockJson).toHaveBeenCalledWith(
      expect.objectContaining({ data: [mockMemory] })
    )
  })

  it(`returns [] when none exist`, async () => {
    ctx.memoryService.list.mockResolvedValue({ data: null })
    await listMemories.action(ctx.mockReq, ctx.mockRes)
    expect(ctx.mockJson).toHaveBeenCalledWith(expect.objectContaining({ data: [] }))
  })

  it(`throws 404 when agent belongs to another org`, async () => {
    ctx.agentService.get.mockResolvedValue({ data: { ...mockAgent, orgId: `other` } })
    await expect(listMemories.action(ctx.mockReq, ctx.mockRes)).rejects.toThrow(
      `Agent not found`
    )
  })

  it(`throws 400 when orgId missing`, async () => {
    ctx.mockReq.params = { agentId: `agent-1` } as any
    await expect(listMemories.action(ctx.mockReq, ctx.mockRes)).rejects.toThrow(
      `orgId is required`
    )
  })
})

// ── CREATE ───────────────────────────────────────────────────────────

describe(`POST / - createMemory`, () => {
  let ctx: ReturnType<typeof buildMockReqRes>
  beforeEach(() => {
    vi.clearAllMocks()
    ctx = buildMockReqRes()
  })

  it(`creates a memory, clamping importance and backfilling embedding`, async () => {
    ctx.embeddings.embedOne.mockResolvedValue([0.1, 0.2])
    ctx.memoryService.create.mockResolvedValue({ data: mockMemory })
    ctx.mockReq.body = { text: `hello`, importance: 999, kind: `insight` }

    await createMemory.action(ctx.mockReq, ctx.mockRes)

    const created = ctx.memoryService.create.mock.calls[0][0]
    expect(created.importance).toBe(MemoryMaxImportance)
    expect(created.kind).toBe(`insight`)
    expect(created.embedding).toEqual([0.1, 0.2])
    expect(created.orgId).toBe(`org-1`)
    expect(created.agentId).toBe(`agent-1`)
    expect(ctx.mockStatus).toHaveBeenCalledWith(201)
  })

  it(`truncates over-long text`, async () => {
    ctx.memoryService.create.mockResolvedValue({ data: mockMemory })
    ctx.mockReq.body = { text: `z`.repeat(MemoryMaxTextChars + 50) }
    await createMemory.action(ctx.mockReq, ctx.mockRes)
    const created = ctx.memoryService.create.mock.calls[0][0]
    expect(created.text).toHaveLength(MemoryMaxTextChars)
  })

  it(`is null-safe when no embedding provider is configured`, async () => {
    ctx.embeddings.embedOne.mockResolvedValue(null)
    ctx.memoryService.create.mockResolvedValue({ data: mockMemory })
    ctx.mockReq.body = { text: `hello` }
    await createMemory.action(ctx.mockReq, ctx.mockRes)
    expect(ctx.memoryService.create.mock.calls[0][0].embedding).toBeNull()
  })

  it(`throws 400 when text missing`, async () => {
    ctx.mockReq.body = {}
    await expect(createMemory.action(ctx.mockReq, ctx.mockRes)).rejects.toThrow(
      `text is required`
    )
  })

  it(`throws 400 for an invalid kind`, async () => {
    ctx.mockReq.body = { text: `hi`, kind: `bogus` }
    await expect(createMemory.action(ctx.mockReq, ctx.mockRes)).rejects.toThrow(
      `Invalid memory kind`
    )
  })

  it(`throws 500 when the service errors`, async () => {
    ctx.memoryService.create.mockResolvedValue({ error: { message: `boom` } })
    ctx.mockReq.body = { text: `hi` }
    await expect(createMemory.action(ctx.mockReq, ctx.mockRes)).rejects.toThrow(`boom`)
  })
})

// ── UPDATE ───────────────────────────────────────────────────────────

describe(`PUT /:memoryId - updateMemory`, () => {
  let ctx: ReturnType<typeof buildMockReqRes>
  beforeEach(() => {
    vi.clearAllMocks()
    ctx = buildMockReqRes()
    ctx.mockReq.params = { orgId: `org-1`, agentId: `agent-1`, memoryId: `mm_1` } as any
  })

  it(`updates provided fields and re-embeds on text change`, async () => {
    ctx.memoryService.get.mockResolvedValue({ data: mockMemory })
    ctx.embeddings.embedOne.mockResolvedValue([0.9])
    ctx.memoryService.update.mockResolvedValue({ data: mockMemory })
    ctx.mockReq.body = { text: `new text`, importance: -3 }

    await updateMemory.action(ctx.mockReq, ctx.mockRes)

    const update = ctx.memoryService.update.mock.calls[0][0]
    expect(update.id).toBe(`mm_1`)
    expect(update.text).toBe(`new text`)
    expect(update.embedding).toEqual([0.9])
    expect(update.importance).toBe(1)
  })

  it(`does not re-embed when text is unchanged`, async () => {
    ctx.memoryService.get.mockResolvedValue({ data: mockMemory })
    ctx.memoryService.update.mockResolvedValue({ data: mockMemory })
    ctx.mockReq.body = { importance: 4 }

    await updateMemory.action(ctx.mockReq, ctx.mockRes)

    expect(ctx.embeddings.embedOne).not.toHaveBeenCalled()
    expect(ctx.memoryService.update.mock.calls[0][0]).not.toHaveProperty(`embedding`)
  })

  it(`throws 404 when memory belongs to another agent`, async () => {
    ctx.memoryService.get.mockResolvedValue({
      data: { ...mockMemory, agentId: `other` },
    })
    ctx.mockReq.body = { text: `x` }
    await expect(updateMemory.action(ctx.mockReq, ctx.mockRes)).rejects.toThrow(
      `Memory not found`
    )
  })

  it(`throws 400 for an invalid kind`, async () => {
    ctx.memoryService.get.mockResolvedValue({ data: mockMemory })
    ctx.mockReq.body = { kind: `nope` }
    await expect(updateMemory.action(ctx.mockReq, ctx.mockRes)).rejects.toThrow(
      `Invalid memory kind`
    )
  })
})

// ── DELETE ───────────────────────────────────────────────────────────

describe(`DELETE /:memoryId - deleteMemory`, () => {
  let ctx: ReturnType<typeof buildMockReqRes>
  beforeEach(() => {
    vi.clearAllMocks()
    ctx = buildMockReqRes()
    ctx.mockReq.params = { orgId: `org-1`, agentId: `agent-1`, memoryId: `mm_1` } as any
  })

  it(`deletes and returns the id`, async () => {
    ctx.memoryService.get.mockResolvedValue({ data: mockMemory })
    ctx.memoryService.delete.mockResolvedValue({})
    await deleteMemory.action(ctx.mockReq, ctx.mockRes)
    expect(ctx.memoryService.delete).toHaveBeenCalledWith(`mm_1`)
    expect(ctx.mockJson).toHaveBeenCalledWith({ data: { id: `mm_1` } })
  })

  it(`throws 404 when memory belongs to another org`, async () => {
    ctx.memoryService.get.mockResolvedValue({ data: { ...mockMemory, orgId: `other` } })
    await expect(deleteMemory.action(ctx.mockReq, ctx.mockRes)).rejects.toThrow(
      `Memory not found`
    )
  })
})

// ── SEARCH ───────────────────────────────────────────────────────────

describe(`POST /search - searchMemories`, () => {
  let ctx: ReturnType<typeof buildMockReqRes>
  beforeEach(() => {
    vi.clearAllMocks()
    ctx = buildMockReqRes()
  })

  it(`embeds the query and runs scored search`, async () => {
    ctx.embeddings.embedOne.mockResolvedValue([0.5])
    ctx.memoryService.searchScored.mockResolvedValue({ data: [mockMemory] })
    ctx.mockReq.body = { query: `observer`, limit: 3, kinds: [`fact`] }

    await searchMemories.action(ctx.mockReq, ctx.mockRes)

    expect(ctx.embeddings.embedOne).toHaveBeenCalledWith(`observer`, { orgId: `org-1` })
    expect(ctx.memoryService.searchScored).toHaveBeenCalledWith({
      orgId: `org-1`,
      agentId: `agent-1`,
      query: `observer`,
      queryEmbedding: [0.5],
      limit: 3,
      kinds: [`fact`],
    })
    expect(ctx.mockJson).toHaveBeenCalledWith({ data: [mockMemory] })
  })

  it(`runs recency-only search when no query is given`, async () => {
    ctx.memoryService.searchScored.mockResolvedValue({ data: [] })
    ctx.mockReq.body = {}

    await searchMemories.action(ctx.mockReq, ctx.mockRes)

    expect(ctx.embeddings.embedOne).not.toHaveBeenCalled()
    const args = ctx.memoryService.searchScored.mock.calls[0][0]
    expect(args.query).toBeUndefined()
    expect(args.queryEmbedding).toBeUndefined()
  })

  it(`falls back to lexical when embedding is null`, async () => {
    ctx.embeddings.embedOne.mockResolvedValue(null)
    ctx.memoryService.searchScored.mockResolvedValue({ data: [] })
    ctx.mockReq.body = { query: `observer` }

    await searchMemories.action(ctx.mockReq, ctx.mockRes)

    const args = ctx.memoryService.searchScored.mock.calls[0][0]
    expect(args.query).toBe(`observer`)
    expect(args.queryEmbedding).toBeUndefined()
  })

  it(`throws 404 when agent belongs to another org`, async () => {
    ctx.agentService.get.mockResolvedValue({ data: { ...mockAgent, orgId: `other` } })
    await expect(searchMemories.action(ctx.mockReq, ctx.mockRes)).rejects.toThrow(
      `Agent not found`
    )
  })
})
