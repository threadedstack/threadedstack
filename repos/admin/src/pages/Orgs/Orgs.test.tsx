import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderWithTheme } from '../../../scripts/testUtils'
import { OrgsPage as Orgs } from './Orgs'
import * as orgsActions from '@TAF/actions/orgs'

// Mock the router
vi.mock('react-router', () => ({
  useNavigate: () => vi.fn(),
}))

// Mock the Page component to avoid split-pane-react dependency issues
vi.mock('@TAF/pages/Page/Page', () => ({
  Page: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}))

// Mock the state selectors
vi.mock('@TAF/state/selectors', () => ({
  useUser: () => [{ id: 'user-1', email: 'test@example.com' }, vi.fn()],
  useOrgs: () => [
    {
      '1': { id: '1', name: 'Org 1', description: 'First org' },
      '2': { id: '2', name: 'Org 2', description: 'Second org' },
    },
    vi.fn(),
  ],
  useActiveOrgId: () => ['1', vi.fn()],
  useThemeType: () => [undefined, vi.fn(), vi.fn()],
}))

// Mock permissions hook used by Orgs component
vi.mock('@TAF/hooks/permissions/useIsAdmin', () => ({
  useIsAdmin: () => true,
}))

// Mock the actions
vi.mock('@TAF/actions/orgs/fetchOrgs', () => ({
  fetchOrgs: vi.fn().mockResolvedValue({}),
}))
vi.mock('@TAF/actions/orgs/deleteOrg', () => ({
  deleteOrg: vi.fn().mockResolvedValue({}),
}))

describe('Orgs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render orgs list', async () => {
    renderWithTheme(<Orgs />)

    await waitFor(() => {
      expect(screen.getByText('Organizations')).toBeDefined()
      expect(screen.getByText('Org 1')).toBeDefined()
      expect(screen.getByText('Org 2')).toBeDefined()
    })
  })

  it('should call fetchOrgs on mount', async () => {
    renderWithTheme(<Orgs />)

    await waitFor(() => {
      expect(orgsActions.fetchOrgs).toHaveBeenCalled()
    })
  })

  it('should render create org button', async () => {
    renderWithTheme(<Orgs />)

    await waitFor(() => {
      expect(screen.getByText('Create')).toBeDefined()
    })
  })
})
