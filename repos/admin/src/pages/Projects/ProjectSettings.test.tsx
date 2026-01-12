import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { ProjectSettings } from './ProjectSettings'
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
vi.mock('@TAF/actions/projects', () => ({
  fetchProject: vi.fn().mockResolvedValue({
    project: {
      id: 'project-456',
      orgId: 'org-123',
      name: 'Test Project',
      gitUrl: 'https://github.com/test/project.git',
      branch: 'main',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  }),
  updateProject: vi.fn(),
  deleteProject: vi.fn(),
}))

vi.mock('@TAF/actions/configs', () => ({
  fetchConfigs: vi.fn().mockResolvedValue({ configs: {} }),
}))

// Mock state selectors
vi.mock('@TAF/state/selectors', () => ({
  useProjects: () => [
    {
      'project-456': {
        id: 'project-456',
        orgId: 'org-123',
        name: 'Test Project',
        gitUrl: 'https://github.com/test/project.git',
        branch: 'main',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    },
  ],
  useConfigs: () => [{}],
}))

describe('ProjectSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render the project settings page', async () => {
    render(<ProjectSettings />)
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Project Settings' })).toBeDefined()
    })
  })

  it('should display the org and project IDs', async () => {
    render(<ProjectSettings />)
    await waitFor(() => {
      expect(screen.getByText('project-456')).toBeDefined()
      expect(screen.getByText('org-123')).toBeDefined()
    })
  })

  it('should call setActiveOrgId with orgId', async () => {
    render(<ProjectSettings />)
    await waitFor(() => {
      expect(accessors.setActiveOrgId).toHaveBeenCalledWith('org-123')
    })
  })

  it('should call setActiveprojectId with projectId', async () => {
    render(<ProjectSettings />)
    await waitFor(() => {
      expect(accessors.setActiveprojectId).toHaveBeenCalledWith('project-456')
    })
  })
})
