import { Agent } from '@tdsk/domain'
import { describe, it, expect } from 'vitest'

import { resolveResidentAllowlist } from './residentAllowlist'

const db = {} as any

describe(`resolveResidentAllowlist`, () => {
  it(`returns the residentActions from the agent's environment`, async () => {
    const agent = new Agent({
      name: `res`,
      orgId: `og_org00001`,
      environment: { residentActions: [`sendAgentMessage`, `heartbeat`] },
    })

    const allowlist = await resolveResidentAllowlist(db, agent, `pj_proj0001`)
    expect(allowlist).toEqual([`sendAgentMessage`, `heartbeat`])
  })

  it(`returns an empty allowlist when the agent has no resident config`, async () => {
    const agent = new Agent({ name: `res`, orgId: `og_org00001` })

    expect(await resolveResidentAllowlist(db, agent, `pj_proj0001`)).toEqual([])
  })

  it(`honors a project-level environment override for the target project`, async () => {
    const agent = new Agent({
      name: `res`,
      orgId: `og_org00001`,
      environment: { residentActions: [`baseAction`] },
      projectConfigs: [
        {
          agentId: `ag_agent001`,
          projectId: `pj_proj0001`,
          environment: { residentActions: [`projectAction`] },
        } as any,
      ],
    })

    expect(await resolveResidentAllowlist(db, agent, `pj_proj0001`)).toEqual([
      `projectAction`,
    ])
    // A different project falls back to the agent-level environment
    expect(await resolveResidentAllowlist(db, agent, `pj_other001`)).toEqual([
      `baseAction`,
    ])
  })

  it(`falls back to the agent-level environment when no projectId is given`, async () => {
    const agent = new Agent({
      name: `res`,
      orgId: `og_org00001`,
      environment: { residentActions: [`baseAction`] },
    })

    expect(await resolveResidentAllowlist(db, agent)).toEqual([`baseAction`])
  })
})
