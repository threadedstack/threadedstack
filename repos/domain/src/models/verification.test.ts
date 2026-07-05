import { describe, it, expect } from 'vitest'
import { Verification } from './verification'
import { EVerifyProbeKind, EVerificationStatus } from '@TDM/types'
import { VerificationIdPrefix } from '@TDM/constants/prefixes'
import {
  VerifyDeclareBlockFence,
  VerifyResultsBlockFence,
} from '@TDM/constants/verification'
import { EPermResource, ERoleType } from '@TDM/types'
import { buildRolePermissions } from '@TDM/utils/permissions'

describe('Verification domain', () => {
  it('defaults to pending with the ci-green probe and no revertPrUrl', () => {
    const v = new Verification({ orgId: 'og_1', agentId: 'ag_1', prNumber: 42 } as any)
    expect(v.status).toBe(EVerificationStatus.pending)
    expect(v.probe).toEqual({ kind: 'ci-green' })
    expect(v.revertPrUrl).toBeNull()
  })

  it('prefix and fences are stable', () => {
    expect(VerificationIdPrefix).toBe('vf_')
    expect(VerifyDeclareBlockFence).toBe('tdsk-verify')
    expect(VerifyResultsBlockFence).toBe('tdsk-verify-results')
  })

  it('EVerifyProbeKind covers the four kinds', () => {
    expect(Object.values(EVerifyProbeKind)).toEqual([
      'health',
      'ci-green',
      'marker-advanced',
      'assertion',
    ])
  })

  it('EVerificationStatus mirrors the lifecycle', () => {
    expect(Object.values(EVerificationStatus)).toEqual([
      'pending',
      'verifying',
      'verified',
      'regressed',
    ])
  })

  it('assigns provided fields correctly', () => {
    const v = new Verification({
      orgId: 'og_2',
      agentId: 'ag_2',
      prNumber: 99,
      prUrl: 'https://github.com/foo/bar/pull/99',
      mergeSha: 'abc123',
      probe: { kind: EVerifyProbeKind.health, params: { url: '/_/health' } },
      status: EVerificationStatus.verified,
      detail: 'probe passed',
      revertPrUrl: null,
      escalationId: null,
      meta: null,
    } as any)
    expect(v.prNumber).toBe(99)
    expect(v.probe.kind).toBe('health')
    expect(v.probe.params).toEqual({ url: '/_/health' })
    expect(v.status).toBe('verified')
    expect(v.detail).toBe('probe passed')
  })

  it('nullable fields default to null', () => {
    const v = new Verification({ orgId: 'og_1', agentId: 'ag_1', prNumber: 1 } as any)
    expect(v.prUrl).toBeNull()
    expect(v.mergeSha).toBeNull()
    expect(v.detail).toBeNull()
    expect(v.revertPrUrl).toBeNull()
    expect(v.escalationId).toBeNull()
    expect(v.meta).toBeNull()
  })
})

describe('Verification permissions', () => {
  it('member gets verification:read', () => {
    const perms = buildRolePermissions(ERoleType.member)
    expect(perms).toContain('verification:read')
  })

  it('admin gets verification:update, verification:delete, verification:manage', () => {
    const perms = buildRolePermissions(ERoleType.admin)
    expect(perms).toContain('verification:update')
    expect(perms).toContain('verification:delete')
    expect(perms).toContain('verification:manage')
  })

  it('EPermResource.verification is defined', () => {
    expect(EPermResource.verification).toBe('verification')
  })
})
