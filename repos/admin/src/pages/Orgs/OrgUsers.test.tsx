import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { OrgUsers } from './OrgUsers'
import * as accessors from '@TAF/state/accessors'

// Mock the router
vi.mock('react-router', () => ({
  useParams: () => ({ orgId: 'org-123' }),
  useNavigate: () => vi.fn(),
}))

// Mock the Page component
vi.mock('@TAF/pages/Page/Page', () => ({
  Page: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}))

// Mock components
vi.mock('@TAF/components', () => ({
  PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
  EmptyState: ({ message }: { message: string }) => <div>{message}</div>,
  LoadingSpinner: () => <div>Loading...</div>,
  SearchBar: () => <div>SearchBar</div>,
  FilterSelect: () => <div>FilterSelect</div>,
  ErrorAlert: () => <div>ErrorAlert</div>,
}))

// Mock accessors
vi.mock('@TAF/state/accessors', () => ({
  setActiveOrgId: vi.fn(),
}))

// Mock services
vi.mock('@TAF/services', () => ({
  usersApi: {
    listByOrg: vi.fn().mockResolvedValue({ data: [] }),
    removeFromOrg: vi.fn(),
  },
}))

describe('OrgUsers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render the org users page', async () => {
    render(<OrgUsers />)
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Org Users' })).toBeDefined()
    })
  })

  it('should call setActiveOrgId with orgId', async () => {
    render(<OrgUsers />)
    await waitFor(() => {
      expect(accessors.setActiveOrgId).toHaveBeenCalledWith('org-123')
    })
  })

  it('should render empty state when no users', async () => {
    render(<OrgUsers />)
    await waitFor(() => {
      expect(
        screen.getByText('No org members yet. Invite users to this org to get started.')
      ).toBeDefined()
    })
  })
})
