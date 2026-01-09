import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { TeamProviders } from './TeamProviders'
import * as accessors from '@TAF/state/accessors'

// Mock the router
vi.mock('react-router', () => ({
  useParams: () => ({ teamId: 'team-789' }),
  useNavigate: () => vi.fn(),
}))

// Mock the Page component to avoid split-pane-react dependency issues
vi.mock('@TAF/pages/Page/Page', () => ({
  Page: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}))

// Mock the accessors
vi.mock('@TAF/state/accessors', () => ({
  setActiveTeamId: vi.fn(),
}))

describe('TeamProviders', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render the team providers page', async () => {
    render(<TeamProviders />)
    await waitFor(() => {
      expect(screen.getByText('Team Providers')).toBeDefined()
    })
  })

  it('should display the team ID', async () => {
    render(<TeamProviders />)
    await waitFor(() => {
      expect(screen.getByText(/team-789/)).toBeDefined()
    })
  })

  it('should call setActiveTeamId with teamId', async () => {
    render(<TeamProviders />)
    await waitFor(() => {
      expect(accessors.setActiveTeamId).toHaveBeenCalledWith('team-789')
    })
  })

  it('should render the TODO message', async () => {
    render(<TeamProviders />)
    await waitFor(() => {
      expect(screen.getByText('TODO: Implement team providers management')).toBeDefined()
    })
  })
})
