import type { TUsePermissions } from '@tdsk/components'
import type { TPermission } from '@tdsk/domain'

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ERoleType } from '@tdsk/domain'

const mockNavigate = vi.fn()
let mockPermissions: TUsePermissions

vi.mock(`react-router`, () => ({
  Navigate: (props: { to: string; replace?: boolean }) => {
    mockNavigate(props)
    return <div data-testid='navigate'>Redirected to {props.to}</div>
  },
}))

vi.mock(`@TAF/hooks/permissions/usePermissions`, () => ({
  usePermissions: () => mockPermissions,
}))

vi.mock(`@tdsk/components`, async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tdsk/components')>()
  return {
    ...actual,
    Loading: ({ children }: any) => <div data-testid='loading'>{children}</div>,
  }
})

import { RequireRole } from './RequireRole'

const TestComponent = () => <div data-testid='protected-content'>Protected Content</div>

const makePermissions = (role: ERoleType | null): TUsePermissions => ({
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
})

describe(`RequireRole`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it(`redirects when role is member and minRole is admin`, () => {
    mockPermissions = makePermissions(ERoleType.member)
    render(
      <RequireRole
        minRole={ERoleType.admin}
        Component={TestComponent}
      />
    )

    expect(screen.getByTestId(`navigate`)).toBeTruthy()
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({ to: `/`, replace: true })
    )
    expect(screen.queryByTestId(`protected-content`)).toBeNull()
  })

  it(`renders the Component when role is admin and minRole is admin`, () => {
    mockPermissions = makePermissions(ERoleType.admin)
    render(
      <RequireRole
        minRole={ERoleType.admin}
        Component={TestComponent}
      />
    )

    expect(screen.getByTestId(`protected-content`)).toBeTruthy()
    expect(screen.queryByTestId(`navigate`)).toBeNull()
  })

  it(`shows loading when role is null (fail-closed)`, () => {
    mockPermissions = makePermissions(null)
    render(
      <RequireRole
        minRole={ERoleType.admin}
        Component={TestComponent}
      />
    )

    expect(screen.getByTestId(`loading`)).toBeTruthy()
    expect(screen.queryByTestId(`protected-content`)).toBeNull()
    expect(screen.queryByTestId(`navigate`)).toBeNull()
  })

  it(`renders the Component when role exceeds minRole (owner > admin)`, () => {
    mockPermissions = makePermissions(ERoleType.owner)
    render(
      <RequireRole
        minRole={ERoleType.admin}
        Component={TestComponent}
      />
    )

    expect(screen.getByTestId(`protected-content`)).toBeTruthy()
    expect(screen.queryByTestId(`navigate`)).toBeNull()
  })

  it(`renders the Component when role is super (super > any minRole)`, () => {
    mockPermissions = makePermissions(ERoleType.super)
    render(
      <RequireRole
        minRole={ERoleType.owner}
        Component={TestComponent}
      />
    )

    expect(screen.getByTestId(`protected-content`)).toBeTruthy()
    expect(screen.queryByTestId(`navigate`)).toBeNull()
  })

  it(`renders when role matches minRole exactly (owner = owner)`, () => {
    mockPermissions = makePermissions(ERoleType.owner)
    render(
      <RequireRole
        minRole={ERoleType.owner}
        Component={TestComponent}
      />
    )

    expect(screen.getByTestId(`protected-content`)).toBeTruthy()
    expect(screen.queryByTestId(`navigate`)).toBeNull()
  })

  it(`redirects to home path (/) with replace`, () => {
    mockPermissions = makePermissions(ERoleType.member)
    render(
      <RequireRole
        minRole={ERoleType.admin}
        Component={TestComponent}
      />
    )

    expect(mockNavigate).toHaveBeenCalledTimes(1)
    expect(mockNavigate).toHaveBeenCalledWith({ to: `/`, replace: true })
  })
})
