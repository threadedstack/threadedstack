import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderWithTheme } from '../../../scripts/testUtils'
import { ProjectSecrets } from './ProjectSecrets'
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
vi.mock('@TAF/actions/secrets', () => ({
  fetchSecrets: vi.fn().mockResolvedValue({ secrets: {} }),
  deleteSecret: vi.fn(),
}))

describe('ProjectSecrets', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render the project secrets page', async () => {
    renderWithTheme(<ProjectSecrets />)
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Secrets' })).toBeDefined()
    })
  })

  it('should call setActiveOrgId with orgId', async () => {
    renderWithTheme(<ProjectSecrets />)
    await waitFor(() => {
      expect(accessors.setActiveOrgId).toHaveBeenCalledWith('org-123')
    })
  })

  it('should call setActiveprojectId with projectId', async () => {
    renderWithTheme(<ProjectSecrets />)
    await waitFor(() => {
      expect(accessors.setActiveprojectId).toHaveBeenCalledWith('project-456')
    })
  })
})
