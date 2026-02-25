import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { User, ApiKey } from '@tdsk/domain'

const mockList = vi.fn()
const mockRevoke = vi.fn()

vi.mock(`@TAF/services`, () => ({
  apiKeysApi: {
    list: (...args: any[]) => mockList(...args),
    revoke: (...args: any[]) => mockRevoke(...args),
  },
}))

vi.mock(`@TAF/components/Orgs/CreateApiKeyDrawer`, () => ({
  CreateApiKeyDrawer: ({ open }: { open: boolean }) =>
    open ? <div data-testid='create-drawer'>Create Drawer</div> : null,
}))

vi.mock(`@TAF/state/selectors`, () => ({
  useUser: () => [{ id: `auth-user`, role: `admin` }],
  useActiveOrgId: () => [`org-1`],
}))

vi.mock(`@tdsk/components`, () => ({
  Drawer: ({ open, title, children, actions }: any) =>
    open ? (
      <div data-testid='drawer'>
        <div data-testid='drawer-title'>{title}</div>
        <div>{children}</div>
        <div>{actions}</div>
      </div>
    ) : null,
  Button: ({ children, startIcon, ...rest }: any) => <button>{children}</button>,
  ConfirmDelete: () => null,
  Loading: ({ children }: any) => <div data-testid='loading'>{children}</div>,
}))

import { UserApiKeysDrawer } from './UserApiKeysDrawer'

const testUser = new User({
  id: `user-1`,
  name: `Test User`,
  email: `test@example.com`,
})

const testKeys = [
  new ApiKey({
    id: `key-1`,
    name: `Test Key`,
    keyPrefix: `tdsk_abc`,
    keyHash: `hash1`,
    scopes: `read,write`,
    active: true,
    orgId: `org-1`,
    userId: `user-1`,
  }),
]

const defaultProps = {
  user: testUser,
  orgId: `org-1`,
  open: true,
  onClose: vi.fn(),
}

describe(`UserApiKeysDrawer`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockList.mockResolvedValue({ data: [], error: null })
  })

  it(`fetches keys for user on open`, async () => {
    mockList.mockResolvedValue({ data: testKeys, error: null })
    render(<UserApiKeysDrawer {...defaultProps} />)

    await waitFor(() => {
      expect(mockList).toHaveBeenCalledWith(`org-1`, { userId: `user-1` })
    })
  })

  it(`shows user name in drawer title`, async () => {
    render(<UserApiKeysDrawer {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText(/API Keys/)).toBeTruthy()
      expect(screen.getByText(/Test User/)).toBeTruthy()
    })
  })

  it(`shows empty state when no keys`, async () => {
    mockList.mockResolvedValue({ data: [], error: null })
    render(<UserApiKeysDrawer {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText(`This user has no API keys yet.`)).toBeTruthy()
    })
  })

  it(`shows error when fetch fails`, async () => {
    mockList.mockResolvedValue({
      data: null,
      error: { message: `Failed to load keys` },
    })
    render(<UserApiKeysDrawer {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText(`Failed to load keys`)).toBeTruthy()
    })
  })

  it(`refetches keys when user prop changes`, async () => {
    const userA = new User({ id: `user-a`, name: `User A`, email: `a@example.com` })
    const userB = new User({ id: `user-b`, name: `User B`, email: `b@example.com` })

    const keysA = [
      new ApiKey({
        id: `key-a`,
        name: `Key A`,
        keyPrefix: `tdsk_aaa`,
        keyHash: `hash-a`,
        scopes: `read`,
        active: true,
        orgId: `org-1`,
        userId: `user-a`,
      }),
    ]

    mockList.mockResolvedValue({ data: keysA, error: null })

    const { rerender } = render(
      <UserApiKeysDrawer
        user={userA}
        orgId='org-1'
        open={true}
        onClose={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(mockList).toHaveBeenCalledWith(`org-1`, { userId: `user-a` })
    })

    mockList.mockClear()
    mockList.mockResolvedValue({ data: [], error: null })

    rerender(
      <UserApiKeysDrawer
        user={userB}
        orgId='org-1'
        open={true}
        onClose={vi.fn()}
      />
    )

    await waitFor(() => {
      expect(mockList).toHaveBeenCalledWith(`org-1`, { userId: `user-b` })
    })
  })
})
