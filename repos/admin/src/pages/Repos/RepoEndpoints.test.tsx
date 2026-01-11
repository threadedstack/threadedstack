import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { RepoEndpoints } from './RepoEndpoints'
import * as accessors from '@TAF/state/accessors'

// Mock the router
vi.mock('react-router', () => ({
  useParams: () => ({ teamId: 'team-123', repoId: 'repo-456' }),
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
  setActiveTeamId: vi.fn(),
  setActiveRepoId: vi.fn(),
}))

// Mock actions
vi.mock('@TAF/actions/endpoints', () => ({
  fetchEndpoints: vi.fn().mockResolvedValue({ endpoints: {} }),
  deleteEndpoint: vi.fn(),
}))

describe('RepoEndpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render the repo endpoints page', async () => {
    render(<RepoEndpoints />)
    await waitFor(() => {
      // The PageHeader renders the title "Endpoints"
      expect(screen.getByRole('heading', { name: 'Endpoints' })).toBeDefined()
    })
  })

  it('should display the team and repo IDs', async () => {
    // The component checks if empty and displays EmptyState
    render(<RepoEndpoints />)
    await waitFor(() => {
      expect(screen.getByText('No endpoints found for this repository.')).toBeDefined()
    })
  })

  it('should call setActiveTeamId with teamId', async () => {
    render(<RepoEndpoints />)
    await waitFor(() => {
      expect(accessors.setActiveTeamId).toHaveBeenCalledWith('team-123')
    })
  })

  it('should call setActiveRepoId with repoId', async () => {
    render(<RepoEndpoints />)
    await waitFor(() => {
      expect(accessors.setActiveRepoId).toHaveBeenCalledWith('repo-456')
    })
  })
})
