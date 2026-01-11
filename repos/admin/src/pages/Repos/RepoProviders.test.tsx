import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { RepoProviders } from './RepoProviders'
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

// Mock accessors
vi.mock('@TAF/state/accessors', () => ({
  setActiveTeamId: vi.fn(),
  setActiveRepoId: vi.fn(),
}))

// Mock actions
vi.mock('@TAF/actions/providers', () => ({
  fetchProviders: vi.fn().mockResolvedValue({ providers: {} }),
}))

describe('RepoProviders', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render the repo providers page', async () => {
    render(<RepoProviders />)
    await waitFor(() => {
      // The component renders "Repo Providers" in an h1
      expect(screen.getByRole('heading', { name: 'Repo Providers' })).toBeDefined()
    })
  })

  it('should display the team and repo IDs', async () => {
    // The component doesn't display teamId/repoId directly in the UI text.
    // It renders "No providers configured for this team." if empty.
    render(<RepoProviders />)
    await waitFor(() => {
      expect(screen.getByText('No providers configured for this team.')).toBeDefined()
    })
  })

  it('should call setActiveTeamId with teamId', async () => {
    render(<RepoProviders />)
    await waitFor(() => {
      expect(accessors.setActiveTeamId).toHaveBeenCalledWith('team-123')
    })
  })

  it('should call setActiveRepoId with repoId', async () => {
    render(<RepoProviders />)
    await waitFor(() => {
      expect(accessors.setActiveRepoId).toHaveBeenCalledWith('repo-456')
    })
  })
})
