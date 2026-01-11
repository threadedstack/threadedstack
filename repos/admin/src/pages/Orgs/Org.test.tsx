import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { Org } from './Org'
import * as orgsActions from '@TAF/actions/orgs'

// Mock the router
vi.mock('react-router', () => ({
  useParams: () => ({ orgId: '1' }),
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
  useOrgs: () => [
    {
      '1': {
        id: '1',
        name: 'Test Org',
        description: 'A test org',
        createdAt: '2024-01-01T00:00:00Z',
      },
    },
    vi.fn(),
  ],
}))

// Mock the actions
vi.mock('@TAF/actions/orgs', () => ({
  fetchOrg: vi.fn().mockResolvedValue({}),
  deleteOrg: vi.fn().mockResolvedValue({}),
}))

describe('Org', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render org detail', async () => {
    render(<Org />)

    await waitFor(() => {
      // Org name may appear in multiple places (header and info section)
      const orgNames = screen.getAllByText('Test Org')
      expect(orgNames.length).toBeGreaterThan(0)
      expect(screen.getByText('A test org')).toBeDefined()
    })
  })

  it('should call fetchOrg on mount', async () => {
    render(<Org />)

    await waitFor(() => {
      expect(orgsActions.fetchOrg).toHaveBeenCalledWith('1')
    })
  })

  it('should render org information section', async () => {
    render(<Org />)

    await waitFor(() => {
      expect(screen.getByText('Org Information')).toBeDefined()
    })
  })

  it('should render org members section', async () => {
    render(<Org />)

    await waitFor(() => {
      expect(screen.getByText('Org Members')).toBeDefined()
    })
  })
})
