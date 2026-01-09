import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { TeamSecrets } from './TeamSecrets'
import * as accessors from '@TAF/state/accessors'

// Mock the router
vi.mock('react-router', () => ({
  useParams: () => ({ teamId: 'team-456' }),
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

describe('TeamSecrets', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render the team secrets page', async () => {
    render(<TeamSecrets />)
    await waitFor(() => {
      expect(screen.getByText('Team Secrets')).toBeDefined()
    })
  })

  it('should display the team ID', async () => {
    render(<TeamSecrets />)
    await waitFor(() => {
      expect(screen.getByText(/team-456/)).toBeDefined()
    })
  })

  it('should call setActiveTeamId with teamId', async () => {
    render(<TeamSecrets />)
    await waitFor(() => {
      expect(accessors.setActiveTeamId).toHaveBeenCalledWith('team-456')
    })
  })

  it('should render the TODO message', async () => {
    render(<TeamSecrets />)
    await waitFor(() => {
      expect(screen.getByText('TODO: Implement team secrets management')).toBeDefined()
    })
  })
})
