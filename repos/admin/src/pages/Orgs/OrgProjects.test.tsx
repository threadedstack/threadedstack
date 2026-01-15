import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderWithTheme } from '../../../scripts/testUtils'
import { OrgProjects } from './OrgProjects'
import * as accessors from '@TAF/state/accessors'

vi.mock('react-router', () => ({
  useParams: () => ({ orgId: 'org-def' }),
  useNavigate: () => vi.fn(),
}))

vi.mock('@TAF/state/selectors', () => ({
  useUser: () => [{}, vi.fn()],
  useProjects: () => [{}, vi.fn()],
  useThemeType: () => [undefined, vi.fn(), vi.fn()],
  useActiveOrgId: () => ['org-def', vi.fn()],
}))

vi.mock('@TAF/state/accessors', () => ({
  setActiveOrgId: vi.fn(),
}))

vi.mock('@TAF/actions/projects', () => ({
  fetchProjects: vi.fn(() => ({})),
  deleteProject: vi.fn(() => ({})),
}))

describe('OrgProjects', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render the org projects page', async () => {
    renderWithTheme(<OrgProjects />)
    await waitFor(() => {
      expect(screen.getByText('Organization Projects')).toBeDefined()
    })
  })

  it('should call setActiveOrgId with orgId', async () => {
    renderWithTheme(<OrgProjects />)
    await waitFor(() => {
      expect(accessors.setActiveOrgId).toHaveBeenCalledWith('org-def')
    })
  })

  it('should render the Create Project button', async () => {
    renderWithTheme(<OrgProjects />)
    await waitFor(() => {
      expect(screen.getByText('Create Project')).toBeDefined()
    })
  })

  it('should render empty state when no projects', async () => {
    renderWithTheme(<OrgProjects />)
    await waitFor(() => {
      expect(screen.getByText(/No projects yet/)).toBeDefined()
    })
  })
})
