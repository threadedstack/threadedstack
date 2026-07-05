import { describe, it, expect } from 'vitest'
import {
  EOpsAction,
  OpsReadActions,
  OpsWriteActions,
  isOpsWriteAction,
  OpsAllowedDeployments,
  OpsAllowedSandboxFields,
  OpsPodLogsMaxTail,
  OpsReviewsBlockFence,
  OpsReviewInjectMax,
  OpsReviewInjectMaxChars,
} from '@TDM/constants/ops'

describe('ops allowlist', () => {
  it('partitions read vs write correctly', () => {
    expect([...OpsReadActions, ...OpsWriteActions].sort()).toEqual(
      Object.values(EOpsAction).sort()
    )
    for (const a of OpsReadActions) expect(isOpsWriteAction(a)).toBe(false)
    for (const a of OpsWriteActions) expect(isOpsWriteAction(a)).toBe(true)
  })
  it('OpsAllowedDeployments matches prod deployment names (no rogue additions)', () => {
    expect(OpsAllowedDeployments).toEqual([
      'tdsk-backend',
      'tdsk-proxy',
      'tdsk-caddy',
      'tdsk-sandbox',
      'tdsk-embeddings',
    ])
  })
  it('OpsAllowedSandboxFields excludes secretIds and image', () => {
    expect(OpsAllowedSandboxFields).not.toContain('secretIds')
    expect(OpsAllowedSandboxFields).not.toContain('image')
  })
  it('OpsPodLogsMaxTail is bounded', () => {
    expect(OpsPodLogsMaxTail).toBe(500)
  })
  it('OpsReviewsBlockFence is stable', () => {
    expect(OpsReviewsBlockFence).toBe('tdsk-ops-reviews')
  })
  it('OpsReviewInjectMax matches escalation convention (15)', () => {
    expect(OpsReviewInjectMax).toBe(15)
  })
  it('OpsReviewInjectMaxChars matches escalation convention (8000)', () => {
    expect(OpsReviewInjectMaxChars).toBe(8000)
  })
})
