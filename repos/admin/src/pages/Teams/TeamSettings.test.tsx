import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { TeamSettings } from './TeamSettings'
import * as accessors from '@TAF/state/accessors'

// Mock the router
vi.mock('react-router', () => ({
  useParams: () => ({ teamId: 'team-abc' }),
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

describe('TeamSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render the team settings page', async () => {
    render(<TeamSettings />)
    await waitFor(() => {
      expect(screen.getByText('Team Settings')).toBeDefined()
    })
  })

  it('should display the team ID', async () => {
    render(<TeamSettings />)
    await waitFor(() => {
      expect(screen.getByText(/team-abc/)).toBeDefined()
    })
  })

  it('should call setActiveTeamId with teamId', async () => {
    render(<TeamSettings />)
    await waitFor(() => {
      expect(accessors.setActiveTeamId).toHaveBeenCalledWith('team-abc')
    })
  })

  it('should render the TODO message', async () => {
    render(<TeamSettings />)
    await waitFor(() => {
      expect(screen.getByText('TODO: Implement team settings management')).toBeDefined()
    })
  })
})
