import { describe, it, expect } from 'vitest'
import { Escalation } from './escalation'
import { EEscalationStatus, EEscalationTarget } from '@TDM/types'
import { EscalationIdPrefix } from '@TDM/constants/prefixes'
import {
  EscalationsBlockFence,
  EscalationResolutionsBlockFence,
} from '@TDM/constants/escalation'

describe('Escalation domain', () => {
  it('defaults to open with empty evidence and no patch', () => {
    const e = new Escalation({
      orgId: 'og_1',
      agentId: 'ag_1',
      title: 'x',
      problem: 'y',
      target: EEscalationTarget.app,
    } as any)
    expect(e.status).toBe(EEscalationStatus.open)
    expect(e.evidence).toEqual([])
    expect(e.proposedPatch).toBeNull()
  })

  it('prefix and fences are stable', () => {
    expect(EscalationIdPrefix).toBe('es_')
    expect(EscalationsBlockFence).toBe('tdsk-escalations')
    expect(EscalationResolutionsBlockFence).toBe('tdsk-escalation-resolutions')
  })

  it('EEscalationStatus mirrors the escalation lifecycle', () => {
    expect(Object.values(EEscalationStatus)).toEqual([
      'open',
      'routed',
      'resolved',
      'rejected',
    ])
  })

  it('EEscalationTarget covers the four targets (secrets is the hard line)', () => {
    expect(Object.values(EEscalationTarget)).toEqual(['app', 'ops', 'infra', 'secrets'])
  })
})
