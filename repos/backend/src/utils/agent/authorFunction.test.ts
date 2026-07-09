import { describe, it, expect, vi } from 'vitest'
import { Agent, EFunLanguage } from '@tdsk/domain'

import {
  parseAuthorFunctionBlock,
  authorAgentFunctionCore,
  AuthorFunctionFence,
} from './authorFunction'

const OrgId = `og_org00001`
const AgentId = `ag_agent001`
const ProjectId = `pj_proj0001`

const fence = (json: string) => `\`\`\`${AuthorFunctionFence}\n${json}\n\`\`\``

const buildDb = ({ existing = [] as any[] } = {}) =>
  ({
    services: {
      agent: {
        get: vi.fn().mockResolvedValue({
          data: new Agent({
            id: AgentId,
            name: `builder`,
            orgId: OrgId,
            projects: [{ id: ProjectId }] as any,
          }),
        }),
      },
      function: {
        list: vi.fn().mockResolvedValue({ data: existing }),
        create: vi
          .fn()
          .mockImplementation(async (item: any) => ({ data: { ...item, id: `fn_new0001` } })),
        update: vi.fn().mockImplementation(async (item: any) => ({ data: { ...item } })),
      },
    },
  }) as any

describe(`parseAuthorFunctionBlock`, () => {
  it(`parses a single object submission`, () => {
    const out = parseAuthorFunctionBlock(
      fence(`{ "name": "scrapePage", "content": "export default async () => ({})", "language": "javascript", "description": "d" }`)
    )
    expect(out).toEqual([
      {
        name: `scrapePage`,
        content: `export default async () => ({})`,
        language: `javascript`,
        description: `d`,
      },
    ])
  })

  it(`parses an array and drops entries missing a name or content`, () => {
    const out = parseAuthorFunctionBlock(
      fence(
        `[{ "name": "a", "content": "x" }, { "name": "", "content": "y" }, { "content": "z" }, { "name": "b" }]`
      )
    )
    expect(out).toEqual([{ name: `a`, content: `x`, language: undefined, description: undefined }])
  })

  it(`returns [] for a missing or malformed block`, () => {
    expect(parseAuthorFunctionBlock(`no fence here`)).toEqual([])
    expect(parseAuthorFunctionBlock(fence(`{ not json`))).toEqual([])
  })
})

describe(`authorAgentFunctionCore`, () => {
  it(`creates a Function, stamps meta.authoredBy, and DEFAULTS an omitted language to javascript`, async () => {
    const db = buildDb()
    const result = await authorAgentFunctionCore(db, {
      orgId: OrgId,
      projectId: ProjectId,
      agentId: AgentId,
      name: `scrapePage`,
      content: `export default async (request, context) => ({ ok: true })`,
      description: `fetch + extract`,
      // language intentionally omitted
    })

    expect(result.ok).toBe(true)
    expect(result.status).toBe(201)
    const created = db.services.function.create.mock.calls[0][0]
    expect(created.language).toBe(EFunLanguage.javascript)
    expect(created.meta).toEqual({ authoredBy: AgentId, version: 1 })
    expect(created.projectId).toBe(ProjectId)
  })

  it(`rejects an invalid language (400) without creating`, async () => {
    const db = buildDb()
    const result = await authorAgentFunctionCore(db, {
      orgId: OrgId,
      projectId: ProjectId,
      agentId: AgentId,
      name: `x`,
      content: `export default async () => ({})`,
      language: `brainfuck`,
    })
    expect(result).toMatchObject({ ok: false, status: 400 })
    expect(db.services.function.create).not.toHaveBeenCalled()
  })

  it(`409s a name collision authored by a DIFFERENT agent (never overwrites another's tool)`, async () => {
    const db = buildDb({
      existing: [{ id: `fn_x`, name: `scrapePage`, meta: { authoredBy: `ag_other`, version: 1 } }],
    })
    const result = await authorAgentFunctionCore(db, {
      orgId: OrgId,
      projectId: ProjectId,
      agentId: AgentId,
      name: `scrapePage`,
      content: `export default async () => ({})`,
      language: `javascript`,
    })
    expect(result).toMatchObject({ ok: false, status: 409 })
    expect(db.services.function.update).not.toHaveBeenCalled()
    expect(db.services.function.create).not.toHaveBeenCalled()
  })

  it(`version-updates the SAME agent's existing Function (bumps meta.version)`, async () => {
    const db = buildDb({
      existing: [{ id: `fn_x`, name: `scrapePage`, meta: { authoredBy: AgentId, version: 2 } }],
    })
    const result = await authorAgentFunctionCore(db, {
      orgId: OrgId,
      projectId: ProjectId,
      agentId: AgentId,
      name: `scrapePage`,
      content: `export default async () => ({ v: 3 })`,
      language: `javascript`,
    })
    expect(result.ok).toBe(true)
    expect(result.status).toBe(200)
    const updated = db.services.function.update.mock.calls[0][0]
    expect(updated.meta).toEqual({ authoredBy: AgentId, version: 3 })
  })

  it(`403s when the agent is not bound to the project`, async () => {
    const db = buildDb()
    const result = await authorAgentFunctionCore(db, {
      orgId: OrgId,
      projectId: `pj_other`,
      agentId: AgentId,
      name: `x`,
      content: `export default async () => ({})`,
      language: `javascript`,
    })
    expect(result).toMatchObject({ ok: false, status: 403 })
  })
})
