import { describe, it, expect } from 'vitest'
import {
  ETaskProposalStatus,
  ETaskPriority,
  ETaskSourceSignal,
} from './taskProposal.types'

describe('taskProposal types', () => {
  it('status mirrors the proposal lifecycle', () => {
    expect(Object.values(ETaskProposalStatus)).toEqual([
      'pending',
      'scanned',
      'rejected',
      'promoted',
    ])
  })
  it('priority is P0..P4', () => {
    expect(Object.values(ETaskPriority)).toEqual(['P0', 'P1', 'P2', 'P3', 'P4'])
  })
  it('source signals cover the six sensors', () => {
    expect(Object.values(ETaskSourceSignal)).toEqual([
      'ci',
      'deploy-marker',
      'health',
      'schedule-run',
      'log',
      'other',
    ])
  })
})
