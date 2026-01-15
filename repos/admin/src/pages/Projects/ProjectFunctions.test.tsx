import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderWithTheme } from '../../../scripts/testUtils'
import { ProjectFunctions } from './ProjectFunctions'
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
  setActiveOrgId: vi.fn(),
  setActiveprojectId: vi.fn(),
}))

// Mock actions
vi.mock('@TAF/actions/functions', () => ({
  fetchFunctions: vi.fn().mockResolvedValue({ functions: {} }),
  deleteFunction: vi.fn(),
}))

describe('ProjectFunctions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render the project functions page', async () => {
    renderWithTheme(<ProjectFunctions />)
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Project Functions' })).toBeDefined()
    })
  })

  it('should call setActiveOrgId with orgId', async () => {
    renderWithTheme(<ProjectFunctions />)
    await waitFor(() => {
      expect(accessors.setActiveOrgId).toHaveBeenCalledWith('org-123')
    })
  })

  it('should call setActiveprojectId with projectId', async () => {
    renderWithTheme(<ProjectFunctions />)
    await waitFor(() => {
      expect(accessors.setActiveprojectId).toHaveBeenCalledWith('project-456')
    })
  })
})
