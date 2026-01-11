import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { OrgProviders } from './OrgProviders'
import * as accessors from '@TAF/state/accessors'

// Mock the router
vi.mock('react-router', () => ({
  useParams: () => ({ orgId: 'org-789' }),
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
  ErrorAlert: () => <div>ErrorAlert</div>,
  CardGrid: () => <div>CardGrid</div>,
}))

// Mock accessors
vi.mock('@TAF/state/accessors', () => ({
  setActiveOrgId: vi.fn(),
}))

// Mock actions
vi.mock('@TAF/actions/providers', () => ({
  fetchProviders: vi.fn().mockResolvedValue({ providers: {} }),
}))

describe('OrgProviders', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render the org providers page', async () => {
    render(<OrgProviders />)
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Org Providers' })).toBeDefined()
    })
  })

  it('should call setActiveOrgId with orgId', async () => {
    render(<OrgProviders />)
    await waitFor(() => {
      expect(accessors.setActiveOrgId).toHaveBeenCalledWith('org-789')
    })
  })

  it('should render empty state when no providers', async () => {
    render(<OrgProviders />)
    await waitFor(() => {
      expect(
        screen.getByText('No providers yet. Create your first provider to get started.')
      ).toBeDefined()
    })
  })
})
