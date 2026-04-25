import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { User, ApiKey } from '@tdsk/domain'

const mockFetchApiKeys = vi.fn()
const mockRevokeApiKey = vi.fn()

vi.mock(`@TAF/actions/apiKeys`, () => ({
  fetchApiKeys: (...args: any[]) => mockFetchApiKeys(...args),
  revokeApiKey: (...args: any[]) => mockRevokeApiKey(...args),
}))

const mockUpdateOrgRole = vi.fn()
vi.mock(`@TAF/actions/users/api/updateOrgRole`, () => ({
  updateOrgRole: (...args: any[]) => mockUpdateOrgRole(...args),
}))

vi.mock(`@TAF/components/Orgs/CreateApiKeyDrawer`, () => ({
  CreateApiKeyDrawer: ({ open }: { open: boolean }) =>
    open ? <div data-testid='create-drawer'>Create Drawer</div> : null,
}))

const mockApiKeysMap: Record<string, any> = {}

vi.mock(`@TAF/state/selectors`, () => ({
  useUser: () => [{ id: `auth-user`, role: `admin` }],
  useActiveOrgId: () => [`org-1`],
  useActiveOrgRole: () => [`admin`],
  useApiKeys: () => [mockApiKeysMap],
}))

vi.mock(`@tdsk/components`, async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tdsk/components')>()
  return {
    ...actual,
    Drawer: ({ open, title, children, actions }: any) =>
      open ? (
        <div data-testid='drawer'>
          <div data-testid='drawer-title'>{title}</div>
          <div data-testid='drawer-content'>{children}</div>
          <div data-testid='drawer-actions'>{actions}</div>
        </div>
      ) : null,
    DrawerActions: ({ form }: any) => (
      <div data-testid='drawer-actions-component'>
        <button type='submit'>Save</button>
      </div>
    ),
    Button: ({ children, startIcon, ...rest }: any) => (
      <button {...rest}>{children}</button>
    ),
    ConfirmDelete: () => null,
    Loading: ({ children }: any) => <div data-testid='loading'>{children}</div>,
  }
})

vi.mock(`@TAF/components/Roles/RoleSelect`, () => ({
  RoleSelect: ({ roleType, onChange }: any) => (
    <div data-testid='role-select'>
      <select
        value={roleType}
        onChange={onChange}
      >
        <option value='admin'>Admin</option>
        <option value='viewer'>Viewer</option>
      </select>
    </div>
  ),
}))

import { EditUserDrawer } from './EditUserDrawer'

const testUser = new User({
  id: `user-1`,
  name: `Test User`,
  email: `test@example.com`,
  role: `admin`,
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
  onSuccess: vi.fn(),
  onRemove: vi.fn(),
}

describe(`EditUserDrawer`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
    Object.keys(mockApiKeysMap).forEach((k) => delete mockApiKeysMap[k])
    mockFetchApiKeys.mockResolvedValue({ data: {}, error: undefined })
    mockRevokeApiKey.mockResolvedValue({ success: true, error: undefined })
    mockUpdateOrgRole.mockResolvedValue({ error: null })
  })

  it(`renders drawer with user info header`, () => {
    render(<EditUserDrawer {...defaultProps} />)

    expect(screen.getByTestId(`drawer`)).toBeTruthy()
    expect(screen.getByText(`Edit User`)).toBeTruthy()
    expect(screen.getByText(`Test User`)).toBeTruthy()
    expect(screen.getByText(`test@example.com`)).toBeTruthy()
  })

  it(`shows Role tab by default`, () => {
    render(<EditUserDrawer {...defaultProps} />)

    expect(screen.getByTestId(`role-select`)).toBeTruthy()
  })

  it(`shows both Role and API Keys tabs`, () => {
    render(<EditUserDrawer {...defaultProps} />)

    expect(screen.getByText(`Role`)).toBeTruthy()
    expect(screen.getByText(`API Keys`)).toBeTruthy()
  })

  it(`switches to API Keys tab on click`, async () => {
    render(<EditUserDrawer {...defaultProps} />)

    fireEvent.click(screen.getByText(`API Keys`))

    await waitFor(() => {
      expect(screen.queryByTestId(`role-select`)).toBeNull()
      expect(screen.getByText(`This user has no API keys yet.`)).toBeTruthy()
    })
  })

  it(`shows API keys table when keys exist`, async () => {
    mockApiKeysMap['key-1'] = testKeys[0]
    render(<EditUserDrawer {...defaultProps} />)

    fireEvent.click(screen.getByText(`API Keys`))

    await waitFor(() => {
      expect(screen.getByText(`Test Key`)).toBeTruthy()
    })
  })

  it(`fetches keys on open`, async () => {
    render(<EditUserDrawer {...defaultProps} />)

    await waitFor(() => {
      expect(mockFetchApiKeys).toHaveBeenCalledWith({
        orgId: `org-1`,
        userId: `user-1`,
      })
    })
  })

  it(`shows Create Key button in API Keys tab`, () => {
    render(<EditUserDrawer {...defaultProps} />)

    fireEvent.click(screen.getByText(`API Keys`))

    expect(screen.getByText(`Create Key`)).toBeTruthy()
  })

  it(`shows DrawerActions in Role tab`, () => {
    render(<EditUserDrawer {...defaultProps} />)

    expect(screen.getByTestId(`drawer-actions-component`)).toBeTruthy()
  })

  it(`does not render when closed`, () => {
    render(
      <EditUserDrawer
        {...defaultProps}
        open={false}
      />
    )

    expect(screen.queryByTestId(`drawer`)).toBeNull()
  })

  it(`opens with initialTab when specified`, () => {
    render(
      <EditUserDrawer
        {...defaultProps}
        initialTab='apiKeys'
      />
    )

    expect(screen.queryByTestId(`role-select`)).toBeNull()
  })

  it(`shows error when API keys fetch fails`, async () => {
    mockFetchApiKeys.mockResolvedValue({
      apiKeys: undefined,
      error: { message: `Failed to load keys` },
    })
    render(<EditUserDrawer {...defaultProps} />)

    fireEvent.click(screen.getByText(`API Keys`))

    await waitFor(() => {
      expect(screen.getByText(`Failed to load keys`)).toBeTruthy()
    })
  })
})
