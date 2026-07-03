import { describe, it, expect } from 'vitest'
import { Schedule } from './schedule'

describe(`Schedule model`, () => {
  it(`carries agentId and threadId through the constructor`, () => {
    const s = new Schedule({
      orgId: `org-1`,
      projectId: `pr-1`,
      sandboxId: `sb-1`,
      cronExpression: `0 * * * *`,
      agentId: `ag_123`,
      threadId: `th_123`,
    })
    expect(s.agentId).toBe(`ag_123`)
    expect(s.threadId).toBe(`th_123`)
  })

  it(`leaves agentId and threadId undefined by default`, () => {
    const s = new Schedule({
      orgId: `org-1`,
      projectId: `pr-1`,
      sandboxId: `sb-1`,
      cronExpression: `0 * * * *`,
    })
    expect(s.agentId).toBeUndefined()
    expect(s.threadId).toBeUndefined()
  })

  it(`carries timeoutMs through the constructor`, () => {
    const s = new Schedule({
      orgId: `org-1`,
      projectId: `pr-1`,
      sandboxId: `sb-1`,
      cronExpression: `0 * * * *`,
      timeoutMs: 3_600_000,
    })
    expect(s.timeoutMs).toBe(3_600_000)
  })

  it(`leaves timeoutMs undefined by default and accepts an explicit null`, () => {
    const unset = new Schedule({
      orgId: `org-1`,
      projectId: `pr-1`,
      sandboxId: `sb-1`,
      cronExpression: `0 * * * *`,
    })
    expect(unset.timeoutMs).toBeUndefined()

    const cleared = new Schedule({
      orgId: `org-1`,
      projectId: `pr-1`,
      sandboxId: `sb-1`,
      cronExpression: `0 * * * *`,
      timeoutMs: null,
    })
    expect(cleared.timeoutMs).toBeNull()
  })
})
