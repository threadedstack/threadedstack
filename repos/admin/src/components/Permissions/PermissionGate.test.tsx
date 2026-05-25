import type { TUsePermissions } from '@tdsk/components'
import type { TPermission } from '@tdsk/domain'

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ERoleType, EPermAction, EPermResource } from '@tdsk/domain'

let mockPermissions: TUsePermissions

vi.mock(`@TAF/hooks/permissions/usePermissions`, () => ({
  usePermissions: () => mockPermissions,
}))

import { PermissionGate } from './PermissionGate'

const makePermissions = (
  role: ERoleType | null,
  overrides: Partial<TUsePermissions> = {}
): TUsePermissions => ({
  role,
  permissions: new Set<TPermission>(),
  isSuper: false,
  isOwner: false,
  isAdmin: false,
  isMember: false,
  has: () => false,
  canDeleteOrg: false,
  canAccessSecretValues: false,
  canInviteUsers: false,
  canManageMembers: false,
  canManageApiKeys: false,
  canRead: () => false,
  canExec: () => false,
  canUpdate: () => false,
  canCreate: () => false,
  canDelete: () => false,
  canManage: () => false,
  canConnect: () => false,
  canAssignRole: () => false,
  ...overrides,
})

describe(`PermissionGate`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── permission prop ─────────────────────────────────────────────────

  it(`renders children when user has the specified permission`, () => {
    mockPermissions = makePermissions(ERoleType.admin, {
      has: (perm: TPermission) => perm === `sandbox:connect`,
    })

    render(
      <PermissionGate permission='sandbox:connect'>
        <div data-testid='allowed'>Allowed</div>
      </PermissionGate>
    )

    expect(screen.getByTestId(`allowed`)).toBeTruthy()
  })

  it(`renders fallback when user lacks the specified permission`, () => {
    mockPermissions = makePermissions(ERoleType.member, {
      has: () => false,
    })

    render(
      <PermissionGate
        permission='org:delete'
        fallback={<div data-testid='denied'>Denied</div>}
      >
        <div data-testid='allowed'>Allowed</div>
      </PermissionGate>
    )

    expect(screen.queryByTestId(`allowed`)).toBeNull()
    expect(screen.getByTestId(`denied`)).toBeTruthy()
  })

  // ── action + resource props ─────────────────────────────────────────

  it(`renders children when user has the action+resource permission`, () => {
    mockPermissions = makePermissions(ERoleType.admin, {
      has: (perm: TPermission) => perm === `secret:create`,
    })

    render(
      <PermissionGate
        action={EPermAction.create}
        resource={EPermResource.secret}
      >
        <div data-testid='allowed'>Allowed</div>
      </PermissionGate>
    )

    expect(screen.getByTestId(`allowed`)).toBeTruthy()
  })

  it(`renders fallback when user lacks the action+resource permission`, () => {
    mockPermissions = makePermissions(ERoleType.member, {
      has: () => false,
    })

    render(
      <PermissionGate
        action={EPermAction.delete}
        resource={EPermResource.org}
        fallback={<div data-testid='denied'>Denied</div>}
      >
        <div data-testid='allowed'>Allowed</div>
      </PermissionGate>
    )

    expect(screen.queryByTestId(`allowed`)).toBeNull()
    expect(screen.getByTestId(`denied`)).toBeTruthy()
  })

  // ── minRole prop ────────────────────────────────────────────────────

  it(`renders children when user role meets minRole`, () => {
    mockPermissions = makePermissions(ERoleType.admin)

    render(
      <PermissionGate minRole={ERoleType.admin}>
        <div data-testid='allowed'>Allowed</div>
      </PermissionGate>
    )

    expect(screen.getByTestId(`allowed`)).toBeTruthy()
  })

  it(`renders children when user role exceeds minRole`, () => {
    mockPermissions = makePermissions(ERoleType.owner)

    render(
      <PermissionGate minRole={ERoleType.admin}>
        <div data-testid='allowed'>Allowed</div>
      </PermissionGate>
    )

    expect(screen.getByTestId(`allowed`)).toBeTruthy()
  })

  it(`renders fallback when user role is below minRole`, () => {
    mockPermissions = makePermissions(ERoleType.member)

    render(
      <PermissionGate
        minRole={ERoleType.admin}
        fallback={<div data-testid='denied'>Denied</div>}
      >
        <div data-testid='allowed'>Allowed</div>
      </PermissionGate>
    )

    expect(screen.queryByTestId(`allowed`)).toBeNull()
    expect(screen.getByTestId(`denied`)).toBeTruthy()
  })

  // ── check prop (boolean key) ────────────────────────────────────────

  it(`renders children when check key is true`, () => {
    mockPermissions = makePermissions(ERoleType.admin, {
      canManageMembers: true,
    })

    render(
      <PermissionGate check='canManageMembers'>
        <div data-testid='allowed'>Allowed</div>
      </PermissionGate>
    )

    expect(screen.getByTestId(`allowed`)).toBeTruthy()
  })

  it(`renders fallback when check key is false`, () => {
    mockPermissions = makePermissions(ERoleType.member, {
      canManageMembers: false,
    })

    render(
      <PermissionGate
        check='canManageMembers'
        fallback={<div data-testid='denied'>Denied</div>}
      >
        <div data-testid='allowed'>Allowed</div>
      </PermissionGate>
    )

    expect(screen.queryByTestId(`allowed`)).toBeNull()
    expect(screen.getByTestId(`denied`)).toBeTruthy()
  })

  // ── default fallback (null) ─────────────────────────────────────────

  it(`renders null (nothing) when permission denied and no fallback provided`, () => {
    mockPermissions = makePermissions(ERoleType.member, {
      has: () => false,
    })

    const { container } = render(
      <PermissionGate permission='org:delete'>
        <div data-testid='allowed'>Allowed</div>
      </PermissionGate>
    )

    expect(screen.queryByTestId(`allowed`)).toBeNull()
    expect(container.innerHTML).toBe(``)
  })

  // ── custom fallback component ───────────────────────────────────────

  it(`renders custom fallback component when permission denied`, () => {
    mockPermissions = makePermissions(ERoleType.member, {
      has: () => false,
    })

    const CustomFallback = () => <div data-testid='custom-fallback'>No access</div>

    render(
      <PermissionGate
        permission='org:delete'
        fallback={<CustomFallback />}
      >
        <div data-testid='allowed'>Allowed</div>
      </PermissionGate>
    )

    expect(screen.queryByTestId(`allowed`)).toBeNull()
    expect(screen.getByTestId(`custom-fallback`)).toBeTruthy()
    expect(screen.getByTestId(`custom-fallback`).textContent).toBe(`No access`)
  })
})
