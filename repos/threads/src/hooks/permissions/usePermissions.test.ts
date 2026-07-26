import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { ERoleType } from '@tdsk/domain'

const mockUseUser = vi.fn()
const mockUseActiveOrgRole = vi.fn()
const mockUsePermissionOverrides = vi.fn()
const mockUseActiveOrgResolvedPerms = vi.fn()
const mockUsePermissionsBase = vi.fn()

vi.mock('@TTH/state/selectors', () => ({
  useUser: (...args: any[]) => mockUseUser(...args),
  useActiveOrgRole: (...args: any[]) => mockUseActiveOrgRole(...args),
  usePermissionOverrides: (...args: any[]) => mockUsePermissionOverrides(...args),
  useActiveOrgResolvedPerms: (...args: any[]) => mockUseActiveOrgResolvedPerms(...args),
}))

vi.mock('@tdsk/components', () => ({
  usePermissions: (...args: any[]) => mockUsePermissionsBase(...args),
}))

import { usePermissions } from './usePermissions'

describe(`usePermissions`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it(`resolves role to super when user.role is super, even if activeOrgRole is also a valid non-super role`, () => {
    mockUseUser.mockReturnValue([{ role: ERoleType.super }])
    mockUseActiveOrgRole.mockReturnValue([ERoleType.admin])
    mockUsePermissionOverrides.mockReturnValue([[{ id: `ov_1` }]])
    mockUseActiveOrgResolvedPerms.mockReturnValue([[`org:read`]])
    const sentinel = { sentinel: true }
    mockUsePermissionsBase.mockReturnValue(sentinel)

    const { result } = renderHook(() => usePermissions())

    expect(mockUsePermissionsBase).toHaveBeenCalledWith(
      ERoleType.super,
      [{ id: `ov_1` }],
      [`org:read`]
    )
    expect(result.current).toBe(sentinel)
  })

  it(`uses activeOrgRole as-is when it is a valid non-super role and user is not super`, () => {
    mockUseUser.mockReturnValue([{ role: ERoleType.member }])
    mockUseActiveOrgRole.mockReturnValue([ERoleType.admin])
    mockUsePermissionOverrides.mockReturnValue([undefined])
    mockUseActiveOrgResolvedPerms.mockReturnValue([undefined])
    const sentinel = { sentinel: true }
    mockUsePermissionsBase.mockReturnValue(sentinel)

    const { result } = renderHook(() => usePermissions())

    expect(mockUsePermissionsBase).toHaveBeenCalledWith(
      ERoleType.admin,
      undefined,
      undefined
    )
    expect(result.current).toBe(sentinel)
  })

  it(`resolves role to null when activeOrgRole is falsy and user is not super`, () => {
    mockUseUser.mockReturnValue([{ role: ERoleType.member }])
    mockUseActiveOrgRole.mockReturnValue([null])
    mockUsePermissionOverrides.mockReturnValue([undefined])
    mockUseActiveOrgResolvedPerms.mockReturnValue([undefined])
    const sentinel = { sentinel: true }
    mockUsePermissionsBase.mockReturnValue(sentinel)

    const { result } = renderHook(() => usePermissions())

    expect(mockUsePermissionsBase).toHaveBeenCalledWith(null, undefined, undefined)
    expect(result.current).toBe(sentinel)
  })

  it(`resolves role to null when activeOrgRole fails isValidRoleType`, () => {
    mockUseUser.mockReturnValue([{ role: ERoleType.member }])
    mockUseActiveOrgRole.mockReturnValue([`not-a-role`])
    mockUsePermissionOverrides.mockReturnValue([undefined])
    mockUseActiveOrgResolvedPerms.mockReturnValue([undefined])
    mockUsePermissionsBase.mockReturnValue({})

    renderHook(() => usePermissions())

    expect(mockUsePermissionsBase).toHaveBeenCalledWith(null, undefined, undefined)
  })

  it(`resolves role to null when user is undefined and activeOrgRole is unset`, () => {
    mockUseUser.mockReturnValue([undefined])
    mockUseActiveOrgRole.mockReturnValue([null])
    mockUsePermissionOverrides.mockReturnValue([undefined])
    mockUseActiveOrgResolvedPerms.mockReturnValue([undefined])
    mockUsePermissionsBase.mockReturnValue({})

    renderHook(() => usePermissions())

    expect(mockUsePermissionsBase).toHaveBeenCalledWith(null, undefined, undefined)
  })
})
