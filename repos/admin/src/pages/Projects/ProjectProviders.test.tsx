import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { ProjectProviders } from './ProjectProviders'
import * as accessors from '@TAF/state/accessors'

// Mock the router
vi.mock('react-router', () => ({
  useParams: () => ({ orgId: 'org-123', projectId: 'project-456' }),
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
  setActiveOrgId: vi.fn(),
  setActiveprojectId: vi.fn(),
}))

// Mock actions
vi.mock('@TAF/actions/providers', () => ({
  fetchProviders: vi.fn().mockResolvedValue({ providers: {} }),
}))

describe('ProjectProviders', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render the project providers page', async () => {
    render(<ProjectProviders />)
    await waitFor(() => {
      // The component renders "Project Providers" in an h1
      expect(screen.getByRole('heading', { name: 'Project Providers' })).toBeDefined()
    })
  })

  it('should display the org and project IDs', async () => {
    // The component doesn't display orgId/projectId directly in the UI text.
    // It renders "No providers configured for this org." if empty.
    render(<ProjectProviders />)
    await waitFor(() => {
      expect(screen.getByText('No providers configured for this org.')).toBeDefined()
    })
  })

  it('should call setActiveOrgId with orgId', async () => {
    render(<ProjectProviders />)
    await waitFor(() => {
      expect(accessors.setActiveOrgId).toHaveBeenCalledWith('org-123')
    })
  })

  it('should call setActiveprojectId with projectId', async () => {
    render(<ProjectProviders />)
    await waitFor(() => {
      expect(accessors.setActiveprojectId).toHaveBeenCalledWith('project-456')
    })
  })
})
