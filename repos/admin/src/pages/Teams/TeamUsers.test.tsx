import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { TeamUsers } from './TeamUsers'
import * as accessors from '@TAF/state/accessors'

// Mock the router
vi.mock('react-router', () => ({
  useParams: () => ({ teamId: 'team-123' }),
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
  ErrorAlert: () => <div>ErrorAlert</div>,
}))

// Mock accessors
vi.mock('@TAF/state/accessors', () => ({
  setActiveTeamId: vi.fn(),
}))

// Mock services
vi.mock('@TAF/services', () => ({
  usersApi: {
    listByTeam: vi.fn().mockResolvedValue({ data: [] }),
    removeFromTeam: vi.fn(),
  },
}))

describe('TeamUsers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render the team users page', async () => {
    render(<TeamUsers />)
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Team Users' })).toBeDefined()
    })
  })

  it('should call setActiveTeamId with teamId', async () => {
    render(<TeamUsers />)
    await waitFor(() => {
      expect(accessors.setActiveTeamId).toHaveBeenCalledWith('team-123')
    })
  })

  it('should render empty state when no users', async () => {
    render(<TeamUsers />)
    await waitFor(() => {
      expect(
        screen.getByText('No team members yet. Invite users to this team to get started.')
      ).toBeDefined()
    })
  })
})
