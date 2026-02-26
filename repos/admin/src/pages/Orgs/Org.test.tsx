import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const mockNavigate = vi.fn()
vi.mock(`react-router`, () => ({
  useNavigate: () => mockNavigate,
}))

const mockUseActiveOrg = vi.fn(() => [
  {
    id: `org-1`,
    name: `Test Org`,
    description: `A test organization`,
    createdAt: `2026-01-01`,
    updatedAt: `2026-01-02`,
  },
])

vi.mock(`@TAF/state/selectors`, () => ({
  useActiveOrg: () => mockUseActiveOrg(),
  useActiveOrgId: () => [`org-1`],
  useUser: () => [{ id: `auth-user-1`, role: `admin` }],
  useOrgUsers: () => [{}],
}))

const mockLoadUsers = vi.fn()
const mockRemoveUser = vi.fn()
const mockUseOrgUsersList = vi.fn(() => ({
  users: [],
  error: undefined,
  loading: false,
  setError: vi.fn(),
  loadUsers: mockLoadUsers,
  removeUser: mockRemoveUser,
}))

vi.mock(`@TAF/hooks/org/useOrgUsersList`, () => ({
  useOrgUsersList: () => mockUseOrgUsersList(),
}))

vi.mock(`@TAF/pages/Page/Page`, () => ({
  Page: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock(`@TAF/components/Orgs/OrgIcon`, () => ({
  OrgIcon: () => <span data-testid='org-icon' />,
}))

vi.mock(`@TAF/components/Orgs/EditOrgDrawer`, () => ({
  EditOrgDrawer: () => null,
}))

vi.mock(`@TAF/actions/orgs/api/deleteOrg`, () => ({
  deleteOrg: vi.fn(),
}))

vi.mock(`@TAF/components/Quickstart/Quickstart`, () => ({
  Quickstart: () => null,
}))

vi.mock(`@tdsk/components`, async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    ConfirmDelete: () => null,
  }
})

import { Org } from './Org'

const mockUsers = [
  {
    id: `user-1`,
    displayName: `Alice`,
    email: `alice@example.com`,
    role: `admin`,
    first: `Alice`,
    last: `Admin`,
    image: ``,
  },
  {
    id: `user-2`,
    displayName: `Bob`,
    email: `bob@example.com`,
    role: `member`,
    first: `Bob`,
    last: `Member`,
    image: ``,
  },
  {
    id: `user-3`,
    displayName: `Charlie`,
    email: `charlie@example.com`,
    role: `viewer`,
    first: `Charlie`,
    last: `Viewer`,
    image: ``,
  },
]

describe(`Org - Members Section`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseActiveOrg.mockReturnValue([
      {
        id: `org-1`,
        name: `Test Org`,
        description: `A test organization`,
        createdAt: `2026-01-01`,
        updatedAt: `2026-01-02`,
      },
    ])
    mockUseOrgUsersList.mockReturnValue({
      users: mockUsers,
      error: undefined,
      loading: false,
      setError: vi.fn(),
      loadUsers: mockLoadUsers,
      removeUser: mockRemoveUser,
    })
  })

  it(`renders member names in the list`, () => {
    render(<Org />)
    expect(screen.getByText(`Alice`)).toBeTruthy()
    expect(screen.getByText(`Bob`)).toBeTruthy()
    expect(screen.getByText(`Charlie`)).toBeTruthy()
  })

  it(`shows member count in header`, () => {
    render(<Org />)
    expect(screen.getByText(/Org Members.*\(3\)/)).toBeTruthy()
  })

  it(`shows loading spinner when members are loading`, () => {
    mockUseOrgUsersList.mockReturnValue({
      users: [],
      error: undefined,
      loading: true,
      setError: vi.fn(),
      loadUsers: mockLoadUsers,
      removeUser: mockRemoveUser,
    })
    render(<Org />)
    expect(screen.getByRole(`progressbar`)).toBeTruthy()
  })

  it(`shows empty message when no members`, () => {
    mockUseOrgUsersList.mockReturnValue({
      users: [],
      error: undefined,
      loading: false,
      setError: vi.fn(),
      loadUsers: mockLoadUsers,
      removeUser: mockRemoveUser,
    })
    render(<Org />)
    expect(
      screen.getByText(`No members yet. Invite users from the Members page.`)
    ).toBeTruthy()
  })

  it(`shows role chips for members`, () => {
    render(<Org />)
    expect(screen.getByText(`ADMIN`)).toBeTruthy()
    expect(screen.getByText(`MEMBER`)).toBeTruthy()
    expect(screen.getByText(`VIEWER`)).toBeTruthy()
  })

  it(`shows member emails`, () => {
    render(<Org />)
    expect(screen.getByText(`alice@example.com`)).toBeTruthy()
    expect(screen.getByText(`bob@example.com`)).toBeTruthy()
  })

  it(`shows "View all" link when more than 5 members`, () => {
    const manyUsers = Array.from({ length: 7 }, (_, i) => ({
      id: `user-${i}`,
      displayName: `User ${i}`,
      email: `user${i}@example.com`,
      role: `member`,
      first: `User`,
      last: `${i}`,
      image: ``,
    }))
    mockUseOrgUsersList.mockReturnValue({
      users: manyUsers,
      error: undefined,
      loading: false,
      setError: vi.fn(),
      loadUsers: mockLoadUsers,
      removeUser: mockRemoveUser,
    })
    render(<Org />)
    expect(screen.getByText(`View all 7 members`)).toBeTruthy()
    expect(screen.getByText(`User 0`)).toBeTruthy()
    expect(screen.getByText(`User 4`)).toBeTruthy()
    expect(screen.queryByText(`User 5`)).toBeNull()
  })

  it(`does not show "View all" link with 5 or fewer members`, () => {
    render(<Org />)
    expect(screen.queryByText(/View all/)).toBeNull()
  })

  it(`renders Manage Members button`, () => {
    render(<Org />)
    expect(screen.getByText(`Manage Members`)).toBeTruthy()
  })

  it(`navigates to /members when Manage Members is clicked`, () => {
    render(<Org />)
    fireEvent.click(screen.getByText(`Manage Members`))
    expect(mockNavigate).toHaveBeenCalledWith(`/orgs/org-1/members`)
  })

  it(`navigates to /members when Invite Users card is clicked`, () => {
    render(<Org />)
    const card = screen.getByText(`Invite Users`).closest(`[class*="MuiCard"]`)
    fireEvent.click(card!)
    expect(mockNavigate).toHaveBeenCalledWith(`/orgs/org-1/members`)
  })

  it(`navigates to /members when View all link is clicked`, () => {
    const manyUsers = Array.from({ length: 7 }, (_, i) => ({
      id: `user-${i}`,
      displayName: `User ${i}`,
      email: `user${i}@example.com`,
      role: `member`,
      first: `User`,
      last: `${i}`,
      image: ``,
    }))
    mockUseOrgUsersList.mockReturnValue({
      users: manyUsers,
      error: undefined,
      loading: false,
      setError: vi.fn(),
      loadUsers: mockLoadUsers,
      removeUser: mockRemoveUser,
    })
    render(<Org />)
    fireEvent.click(screen.getByText(`View all 7 members`))
    expect(mockNavigate).toHaveBeenCalledWith(`/orgs/org-1/members`)
  })
})
