import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'

const mockUseActiveOrgId = vi.fn(() => [`org-1`])
const mockUseUser = vi.fn(() => [{ id: `auth-user-1`, role: `admin` }])
const mockUseActiveOrgRole = vi.fn(() => [`admin`])

vi.mock(`@TAF/state/selectors`, () => ({
  useActiveOrgId: () => mockUseActiveOrgId(),
  useUser: () => mockUseUser(),
  useActiveOrgRole: () => mockUseActiveOrgRole(),
}))

const mockLoadUsers = vi.fn()
const mockRemoveUser = vi.fn()
const mockSetError = vi.fn()
const mockUseOrgUsersList = vi.fn(() => ({
  users: [],
  error: undefined,
  loading: false,
  setError: mockSetError,
  loadUsers: mockLoadUsers,
  removeUser: mockRemoveUser,
}))

vi.mock(`@TAF/hooks/org/useOrgUsersList`, () => ({
  useOrgUsersList: () => mockUseOrgUsersList(),
}))

vi.mock(`@TAF/hooks/components/useLocalSearch`, () => ({
  useLocalSearch: ({ items }: { items: any[] }) => ({
    items,
    query: ``,
    onChange: vi.fn(),
    onSearch: vi.fn(),
  }),
}))

vi.mock(`@TAF/components/PageLayout/PageLayout`, () => ({
  PageLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock(`@TAF/components/Users/NoUsers`, () => ({
  NoUsers: ({ onInvite }: { onInvite: () => void }) => (
    <div data-testid='no-users'>
      <button onClick={onInvite}>Invite Users</button>
    </div>
  ),
}))

vi.mock(`@TAF/components/Users/InviteUserDrawer`, () => ({
  InviteUserDrawer: () => null,
}))

vi.mock(`@TAF/components/Users/EditUserDrawer`, () => ({
  EditUserDrawer: () => null,
}))

vi.mock(`@tdsk/components`, async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tdsk/components')>()
  return {
    ...actual,
    ConfirmDelete: () => null,
  }
})

import { Users } from './Users'

const mockUsers = [
  {
    id: `user-1`,
    displayName: `Alice Admin`,
    email: `alice@example.com`,
    role: `admin`,
    image: ``,
    first: `Alice`,
    last: `Admin`,
  },
  {
    id: `user-2`,
    displayName: `Bob Member`,
    email: `bob@example.com`,
    role: `member`,
    image: ``,
    first: `Bob`,
    last: `Member`,
  },
  {
    id: `user-3`,
    displayName: `Charlie Viewer`,
    email: `charlie@example.com`,
    role: `viewer`,
    image: ``,
    first: `Charlie`,
    last: `Viewer`,
  },
]

describe(`Users`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseActiveOrgId.mockReturnValue([`org-1`])
    mockUseUser.mockReturnValue([{ id: `auth-user-1`, role: `admin` }])
    mockUseOrgUsersList.mockReturnValue({
      users: mockUsers,
      error: undefined,
      loading: false,
      setError: mockSetError,
      loadUsers: mockLoadUsers,
      removeUser: mockRemoveUser,
    })
  })

  it(`renders DataTable with user names`, () => {
    render(<Users />)
    expect(screen.getByText(`Alice Admin`)).toBeTruthy()
    expect(screen.getByText(`Bob Member`)).toBeTruthy()
    expect(screen.getByText(`Charlie Viewer`)).toBeTruthy()
  })

  it(`displays email column`, () => {
    render(<Users />)
    expect(screen.getByText(`alice@example.com`)).toBeTruthy()
    expect(screen.getByText(`bob@example.com`)).toBeTruthy()
  })

  it(`displays role chips`, () => {
    render(<Users />)
    expect(screen.getByText(`ADMIN`)).toBeTruthy()
    expect(screen.getByText(`MEMBER`)).toBeTruthy()
    expect(screen.getByText(`VIEWER`)).toBeTruthy()
  })

  it(`shows table column headers`, () => {
    render(<Users />)
    expect(screen.getByText(`Name`)).toBeTruthy()
    expect(screen.getByText(`Email`)).toBeTruthy()
    expect(screen.getByText(`Role`)).toBeTruthy()
    expect(screen.getByText(`Actions`)).toBeTruthy()
  })

  it(`shows empty state when no users`, () => {
    mockUseOrgUsersList.mockReturnValue({
      users: [],
      error: undefined,
      loading: false,
      setError: mockSetError,
      loadUsers: mockLoadUsers,
      removeUser: mockRemoveUser,
    })
    render(<Users />)
    expect(screen.getByTestId(`no-users`)).toBeTruthy()
  })

  it(`does not render table when loading`, () => {
    mockUseOrgUsersList.mockReturnValue({
      users: mockUsers,
      error: undefined,
      loading: true,
      setError: mockSetError,
      loadUsers: mockLoadUsers,
      removeUser: mockRemoveUser,
    })
    render(<Users />)
    expect(screen.queryByText(`Alice Admin`)).toBeNull()
  })

  it(`renders user rows in a table`, () => {
    render(<Users />)
    const rows = screen.getAllByRole(`row`)
    // 1 header row + 3 data rows
    expect(rows.length).toBe(4)
  })

  it(`renders two action buttons per row (Edit and Remove)`, () => {
    render(<Users />)
    const row = screen.getByText(`Alice Admin`).closest(`tr`)!
    const buttons = within(row).getAllByRole(`button`)
    expect(buttons.length).toBe(2)
  })

  it(`disables remove button for super admin`, () => {
    mockUseOrgUsersList.mockReturnValue({
      users: [{ ...mockUsers[0], role: `super`, displayName: `Super User` }],
      error: undefined,
      loading: false,
      setError: mockSetError,
      loadUsers: mockLoadUsers,
      removeUser: mockRemoveUser,
    })
    render(<Users />)

    const row = screen.getByText(`Super User`).closest(`tr`)!
    const buttons = within(row).getAllByRole(`button`)
    // Last button in the row is the remove button
    const removeBtn = buttons[buttons.length - 1]
    expect(removeBtn).toBeDisabled()
  })

  it(`disables remove button for current user`, () => {
    mockUseUser.mockReturnValue([{ id: `user-1`, role: `admin` }])
    render(<Users />)

    const row = screen.getByText(`Alice Admin`).closest(`tr`)!
    const buttons = within(row).getAllByRole(`button`)
    const removeBtn = buttons[buttons.length - 1]
    expect(removeBtn).toBeDisabled()
  })
})
