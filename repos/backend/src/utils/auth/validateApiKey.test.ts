import { describe, it, expect } from 'vitest'
import { ERoleType } from '@tdsk/domain'
import { validateApiKeyRole, validateProjectKeyPermission } from './validateApiKey'

describe(`validateApiKeyRole`, () => {
  it(`should allow admin caller to create admin key`, () => {
    expect(validateApiKeyRole(`admin`, ERoleType.admin)).toEqual({ valid: true })
  })

  it(`should allow admin caller to create member key`, () => {
    expect(validateApiKeyRole(`member`, ERoleType.admin)).toEqual({ valid: true })
  })

  it(`should allow admin caller to create viewer key`, () => {
    expect(validateApiKeyRole(`viewer`, ERoleType.admin)).toEqual({ valid: true })
  })

  it(`should allow member caller to create member key`, () => {
    expect(validateApiKeyRole(`member`, ERoleType.member)).toEqual({ valid: true })
  })

  it(`should allow member caller to create viewer key`, () => {
    expect(validateApiKeyRole(`viewer`, ERoleType.member)).toEqual({ valid: true })
  })

  it(`should allow viewer caller to create viewer key`, () => {
    expect(validateApiKeyRole(`viewer`, ERoleType.viewer)).toEqual({ valid: true })
  })

  it(`should reject member caller creating admin key`, () => {
    const result = validateApiKeyRole(`admin`, ERoleType.member)
    expect(result.valid).toBe(false)
    expect(result.error).toContain(`member`)
  })

  it(`should reject viewer caller creating member key`, () => {
    const result = validateApiKeyRole(`viewer`, ERoleType.viewer)
    expect(result.valid).toBe(true)
  })

  it(`should reject viewer caller creating admin key`, () => {
    const result = validateApiKeyRole(`admin`, ERoleType.viewer)
    expect(result.valid).toBe(false)
  })

  it(`should allow owner caller to create owner key`, () => {
    expect(validateApiKeyRole(`owner`, ERoleType.owner)).toEqual({ valid: true })
  })

  it(`should allow owner caller to create admin key`, () => {
    expect(validateApiKeyRole(`admin`, ERoleType.owner)).toEqual({ valid: true })
  })

  it(`should allow super caller to create owner key (capped at owner)`, () => {
    expect(validateApiKeyRole(`owner`, ERoleType.super)).toEqual({ valid: true })
  })

  it(`should allow super caller to create admin key`, () => {
    expect(validateApiKeyRole(`admin`, ERoleType.super)).toEqual({ valid: true })
  })

  it(`should reject admin caller creating owner key`, () => {
    const result = validateApiKeyRole(`owner`, ERoleType.admin)
    expect(result.valid).toBe(false)
    expect(result.error).toContain(`admin`)
  })

  it(`should reject member caller creating owner key`, () => {
    const result = validateApiKeyRole(`owner`, ERoleType.member)
    expect(result.valid).toBe(false)
    expect(result.error).toContain(`member`)
  })

  it(`should reject viewer caller creating owner key`, () => {
    const result = validateApiKeyRole(`owner`, ERoleType.viewer)
    expect(result.valid).toBe(false)
    expect(result.error).toContain(`viewer`)
  })

  it(`should reject super as a requested role`, () => {
    const result = validateApiKeyRole(`super`, ERoleType.super)
    expect(result.valid).toBe(false)
    expect(result.error).toContain(`Invalid API key role`)
  })

  it(`should reject arbitrary string as role`, () => {
    const result = validateApiKeyRole(`superuser`, ERoleType.admin)
    expect(result.valid).toBe(false)
    expect(result.error).toContain(`Invalid API key role`)
  })

  it(`should reject null caller role`, () => {
    const result = validateApiKeyRole(`viewer`, null)
    expect(result.valid).toBe(false)
    expect(result.error).toContain(`Cannot determine caller role`)
  })
})

describe(`validateProjectKeyPermission`, () => {
  it(`should allow self-creation within role ceiling`, () => {
    const result = validateProjectKeyPermission({
      requesterRole: ERoleType.admin,
      requesterUserId: `user-1`,
      targetUserId: `user-1`,
      requestedRole: `admin`,
      isOrgAdmin: false,
    })
    expect(result.valid).toBe(true)
  })

  it(`should reject self-creation above role ceiling`, () => {
    const result = validateProjectKeyPermission({
      requesterRole: ERoleType.member,
      requesterUserId: `user-1`,
      targetUserId: `user-1`,
      requestedRole: `admin`,
      isOrgAdmin: false,
    })
    expect(result.valid).toBe(false)
  })

  it(`should allow org admin to create key for other user`, () => {
    const result = validateProjectKeyPermission({
      requesterRole: ERoleType.member,
      requesterUserId: `user-1`,
      targetUserId: `user-2`,
      requestedRole: `member`,
      isOrgAdmin: true,
    })
    expect(result.valid).toBe(true)
  })

  it(`should reject non-admin creating key for other user`, () => {
    const result = validateProjectKeyPermission({
      requesterRole: ERoleType.member,
      requesterUserId: `user-1`,
      targetUserId: `user-2`,
      requestedRole: `viewer`,
      isOrgAdmin: false,
    })
    expect(result.valid).toBe(false)
    expect(result.error).toContain(`Only project admins`)
  })

  it(`should allow project admin to create key for other user`, () => {
    const result = validateProjectKeyPermission({
      requesterRole: ERoleType.admin,
      requesterUserId: `user-1`,
      targetUserId: `user-2`,
      requestedRole: `viewer`,
      isOrgAdmin: false,
    })
    expect(result.valid).toBe(true)
  })

  it(`should still enforce role ceiling even for org admin`, () => {
    const result = validateProjectKeyPermission({
      requesterRole: ERoleType.member,
      requesterUserId: `user-1`,
      targetUserId: `user-2`,
      requestedRole: `admin`,
      isOrgAdmin: true,
    })
    expect(result.valid).toBe(false)
  })
})
