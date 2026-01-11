import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { Orgs } from './Orgs'
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
  useOrgs: () => [
    {
      '1': { id: '1', name: 'Org 1', description: 'First org' },
      '2': { id: '2', name: 'Org 2', description: 'Second org' },
    },
    vi.fn(),
  ],
}))

// Mock the actions
vi.mock('@TAF/actions/orgs', () => ({
  fetchOrgs: vi.fn().mockResolvedValue({}),
  deleteOrg: vi.fn().mockResolvedValue({}),
}))

describe('Orgs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render orgs list', async () => {
    render(<Orgs />)

    await waitFor(() => {
      expect(screen.getByText('Orgs')).toBeDefined()
      expect(screen.getByText('Org 1')).toBeDefined()
      expect(screen.getByText('Org 2')).toBeDefined()
    })
  })

  it('should call fetchOrgs on mount', async () => {
    render(<Orgs />)

    await waitFor(() => {
      expect(orgsActions.fetchOrgs).toHaveBeenCalled()
    })
  })

  it('should render create org button', async () => {
    render(<Orgs />)

    await waitFor(() => {
      expect(screen.getByText('Create Org')).toBeDefined()
    })
  })
})
