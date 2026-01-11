import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { TeamSecrets } from './TeamSecrets'
import * as accessors from '@TAF/state/accessors'

// Mock the router
vi.mock('react-router', () => ({
  useParams: () => ({ teamId: 'team-456' }),
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
  ErrorAlert: () => <div>ErrorAlert</div>,
  DataTable: () => <div>DataTable</div>,
}))

// Mock accessors
vi.mock('@TAF/state/accessors', () => ({
  setActiveTeamId: vi.fn(),
}))

// Mock actions
vi.mock('@TAF/actions/secrets', () => ({
  fetchSecrets: vi.fn().mockResolvedValue({ secrets: {} }),
}))

describe('TeamSecrets', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render the team secrets page', async () => {
    render(<TeamSecrets />)
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Team Secrets' })).toBeDefined()
    })
  })

  it('should call setActiveTeamId with teamId', async () => {
    render(<TeamSecrets />)
    await waitFor(() => {
      expect(accessors.setActiveTeamId).toHaveBeenCalledWith('team-456')
    })
  })

  it('should render empty state when no secrets', async () => {
    render(<TeamSecrets />)
    await waitFor(() => {
      expect(
        screen.getByText('No secrets yet. Create your first secret to get started.')
      ).toBeDefined()
    })
  })
})
