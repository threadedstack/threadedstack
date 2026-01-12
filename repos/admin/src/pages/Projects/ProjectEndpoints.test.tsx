import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { ProjectEndpoints } from './ProjectEndpoints'
import * as accessors from '@TAF/state/accessors'

// Mock the router
vi.mock('react-router', () => ({
  useParams: () => ({ orgId: 'org-123', projectId: 'project-456' }),
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
}))

// Mock accessors
vi.mock('@TAF/state/accessors', () => ({
  setActiveOrgId: vi.fn(),
  setActiveprojectId: vi.fn(),
}))

// Mock actions
vi.mock('@TAF/actions/endpoints', () => ({
  fetchEndpoints: vi.fn().mockResolvedValue({ endpoints: {} }),
  deleteEndpoint: vi.fn(),
}))

describe('ProjectEndpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render the project endpoints page', async () => {
    render(<ProjectEndpoints />)
    await waitFor(() => {
      // The PageHeader renders the title "Endpoints"
      expect(screen.getByRole('heading', { name: 'Endpoints' })).toBeDefined()
    })
  })

  it('should display the org and project IDs', async () => {
    // The component checks if empty and displays EmptyState
    render(<ProjectEndpoints />)
    await waitFor(() => {
      expect(screen.getByText('No endpoints found for this project.')).toBeDefined()
    })
  })

  it('should call setActiveOrgId with orgId', async () => {
    render(<ProjectEndpoints />)
    await waitFor(() => {
      expect(accessors.setActiveOrgId).toHaveBeenCalledWith('org-123')
    })
  })

  it('should call setActiveprojectId with projectId', async () => {
    render(<ProjectEndpoints />)
    await waitFor(() => {
      expect(accessors.setActiveprojectId).toHaveBeenCalledWith('project-456')
    })
  })
})
