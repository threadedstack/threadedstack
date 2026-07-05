import { describe, it, expect } from 'vitest'
import { OpsAction } from './opsAction'
import { EOpsActionStatus } from '@TDM/types'
import { OpsActionIdPrefix } from '@TDM/constants/prefixes'
import { EPermResource, ERoleType } from '@TDM/types'
import { buildRolePermissions } from '@TDM/utils/permissions'

describe('OpsAction domain', () => {
  it('defaults to proposed status and dryRun true', () => {
    const a = new OpsAction({
      orgId: 'og_1',
      agentId: 'ag_1',
      action: 'podStatus',
    } as any)
    expect(a.status).toBe(EOpsActionStatus.proposed)
    expect(a.dryRun).toBe(true)
  })

  it('prefix is stable', () => {
    expect(OpsActionIdPrefix).toBe('op_')
  })

  it('nullable fields default to null', () => {
    const a = new OpsAction({
      orgId: 'og_1',
      agentId: 'ag_1',
      action: 'podStatus',
    } as any)
    expect(a.dryRunResult).toBeNull()
    expect(a.result).toBeNull()
    expect(a.scanResult).toBeNull()
    expect(a.reviewVerdict).toBeNull()
    expect(a.rollback).toBeNull()
    expect(a.reason).toBeNull()
    expect(a.meta).toBeNull()
  })

  it('assigns provided fields correctly', () => {
    const a = new OpsAction({
      orgId: 'og_2',
      agentId: 'ag_2',
      action: 'triggerRedeploy',
      params: { reason: 'test redeploy', forceAll: false },
      status: EOpsActionStatus.executed,
      dryRun: false,
      reason: 'scheduled maintenance',
    } as any)
    expect(a.action).toBe('triggerRedeploy')
    expect(a.status).toBe('executed')
    expect(a.dryRun).toBe(false)
    expect(a.reason).toBe('scheduled maintenance')
  })
})

describe('OpsAction permissions', () => {
  it('member gets opsAction:read', () => {
    const perms = buildRolePermissions(ERoleType.member)
    expect(perms).toContain('opsAction:read')
  })

  it('admin gets opsAction:update, opsAction:delete, opsAction:manage', () => {
    const perms = buildRolePermissions(ERoleType.admin)
    expect(perms).toContain('opsAction:update')
    expect(perms).toContain('opsAction:delete')
    expect(perms).toContain('opsAction:manage')
  })

  it('EPermResource.opsAction is defined', () => {
    expect(EPermResource.opsAction).toBe('opsAction')
  })
})
