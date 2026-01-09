import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { TeamRepos } from './TeamRepos'
import * as accessors from '@TAF/state/accessors'

// Mock the router
vi.mock('react-router', () => ({
  useParams: () => ({ teamId: 'team-def' }),
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
  useRepos: () => [{}, vi.fn()],
}))

// Mock the accessors
vi.mock('@TAF/state/accessors', () => ({
  setActiveTeamId: vi.fn(),
}))

describe('TeamRepos', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render the team repos page', async () => {
    render(<TeamRepos />)
    await waitFor(() => {
      expect(screen.getByText('Team Repositories')).toBeDefined()
    })
  })

  it('should display the team ID', async () => {
    render(<TeamRepos />)
    await waitFor(() => {
      expect(screen.getByText(/team-def/)).toBeDefined()
    })
  })

  it('should call setActiveTeamId with teamId', async () => {
    render(<TeamRepos />)
    await waitFor(() => {
      expect(accessors.setActiveTeamId).toHaveBeenCalledWith('team-def')
    })
  })

  it('should render the Create Repository button', async () => {
    render(<TeamRepos />)
    await waitFor(() => {
      expect(screen.getByText('Create Repository')).toBeDefined()
    })
  })

  it('should render empty state when no repositories', async () => {
    render(<TeamRepos />)
    await waitFor(() => {
      expect(screen.getByText(/No repositories yet/)).toBeDefined()
    })
  })

  it('should render the TODO message', async () => {
    render(<TeamRepos />)
    await waitFor(() => {
      expect(screen.getByText(/TODO: Implement team-specific repo filtering and management/)).toBeDefined()
    })
  })
})
