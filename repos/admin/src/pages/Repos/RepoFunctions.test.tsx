import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { RepoFunctions } from './RepoFunctions'
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

describe('RepoFunctions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render the repo functions page', async () => {
    render(<RepoFunctions />)
    await waitFor(() => {
      expect(screen.getByText('Repo Functions')).toBeDefined()
    })
  })

  it('should display the team and repo IDs', async () => {
    render(<RepoFunctions />)
    await waitFor(() => {
      expect(screen.getByText(/team-123/)).toBeDefined()
      expect(screen.getByText(/repo-456/)).toBeDefined()
    })
  })

  it('should call setActiveTeamId with teamId', async () => {
    render(<RepoFunctions />)
    await waitFor(() => {
      expect(accessors.setActiveTeamId).toHaveBeenCalledWith('team-123')
    })
  })

  it('should call setActiveRepoId with repoId', async () => {
    render(<RepoFunctions />)
    await waitFor(() => {
      expect(accessors.setActiveRepoId).toHaveBeenCalledWith('repo-456')
    })
  })
})
