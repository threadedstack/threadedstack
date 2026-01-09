import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { TeamUsers } from './TeamUsers'
import * as accessors from '@TAF/state/accessors'

// Mock the router
vi.mock('react-router', () => ({
  useParams: () => ({ teamId: 'team-123' }),
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

describe('TeamUsers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render the team users page', async () => {
    render(<TeamUsers />)
    await waitFor(() => {
      expect(screen.getByText('Team Users')).toBeDefined()
    })
  })

  it('should display the team ID', async () => {
    render(<TeamUsers />)
    await waitFor(() => {
      expect(screen.getByText(/team-123/)).toBeDefined()
    })
  })

  it('should call setActiveTeamId with teamId', async () => {
    render(<TeamUsers />)
    await waitFor(() => {
      expect(accessors.setActiveTeamId).toHaveBeenCalledWith('team-123')
    })
  })

  it('should render the Team Users header', async () => {
    render(<TeamUsers />)
    await waitFor(() => {
      expect(screen.getByText('Team Users')).toBeDefined()
    })
  })
})
