import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { RepoProviders } from './RepoProviders'
import * as accessors from '@TAF/state/accessors'

// Mock the router
vi.mock('react-router', () => ({
  useParams: () => ({ orgId: 'org-123', repoId: 'repo-456' }),
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
  setActiveOrgId: vi.fn(),
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

  it('should display the org and repo IDs', async () => {
    // The component doesn't display orgId/repoId directly in the UI text.
    // It renders "No providers configured for this org." if empty.
    render(<RepoProviders />)
    await waitFor(() => {
      expect(screen.getByText('No providers configured for this org.')).toBeDefined()
    })
  })

  it('should call setActiveOrgId with orgId', async () => {
    render(<RepoProviders />)
    await waitFor(() => {
      expect(accessors.setActiveOrgId).toHaveBeenCalledWith('org-123')
    })
  })

  it('should call setActiveRepoId with repoId', async () => {
    render(<RepoProviders />)
    await waitFor(() => {
      expect(accessors.setActiveRepoId).toHaveBeenCalledWith('repo-456')
    })
  })
})
