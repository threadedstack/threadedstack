import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { RepoSettings } from './RepoSettings'
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
vi.mock('@TAF/actions/repos', () => ({
  fetchRepo: vi.fn().mockResolvedValue({
    repo: {
      id: 'repo-456',
      teamId: 'team-123',
      name: 'Test Repo',
      gitUrl: 'https://github.com/test/repo.git',
      branch: 'main',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  }),
  updateRepo: vi.fn(),
  deleteRepo: vi.fn(),
}))

vi.mock('@TAF/actions/configs', () => ({
  fetchConfigs: vi.fn().mockResolvedValue({ configs: {} }),
}))

// Mock state selectors
vi.mock('@TAF/state/selectors', () => ({
  useRepos: () => [
    {
      'repo-456': {
        id: 'repo-456',
        teamId: 'team-123',
        name: 'Test Repo',
        gitUrl: 'https://github.com/test/repo.git',
        branch: 'main',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    },
  ],
  useConfigs: () => [{}],
}))

describe('RepoSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render the repo settings page', async () => {
    render(<RepoSettings />)
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Repository Settings' })).toBeDefined()
    })
  })

  it('should display the team and repo IDs', async () => {
    render(<RepoSettings />)
    await waitFor(() => {
      expect(screen.getByText('repo-456')).toBeDefined()
      expect(screen.getByText('team-123')).toBeDefined()
    })
  })

  it('should call setActiveTeamId with teamId', async () => {
    render(<RepoSettings />)
    await waitFor(() => {
      expect(accessors.setActiveTeamId).toHaveBeenCalledWith('team-123')
    })
  })

  it('should call setActiveRepoId with repoId', async () => {
    render(<RepoSettings />)
    await waitFor(() => {
      expect(accessors.setActiveRepoId).toHaveBeenCalledWith('repo-456')
    })
  })
})
