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
vi.mock('@TAF/actions/functions', () => ({
  fetchFunctions: vi.fn().mockResolvedValue({ functions: {} }),
  deleteFunction: vi.fn(),
}))

describe('RepoFunctions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render the repo functions page', async () => {
    render(<RepoFunctions />)
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Repo Functions' })).toBeDefined()
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
