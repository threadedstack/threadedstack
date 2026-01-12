import { OrgProjects } from './OrgProjects'
import { makeTheme } from '@tdsk/components'
import * as accessors from '@TAF/state/accessors'
import { ThemeProvider } from '@mui/material/styles'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

vi.mock('react-router', () => ({
  useParams: () => ({ orgId: 'org-def' }),
  useNavigate: () => vi.fn(),
}))

vi.mock('@TAF/state/selectors', () => ({
  useUser: () => [{}, vi.fn()],
  useProjects: () => [{}, vi.fn()],
  useThemeType: () => [undefined, vi.fn(), vi.fn()],
}))

vi.mock('@TAF/state/accessors', () => ({
  setActiveOrgId: vi.fn(),
}))

vi.mock('@TAF/actions/projects', () => ({
  fetchProjects: vi.fn(() => ({})),
  deleteProject: vi.fn(() => ({})),
}))

const renderPage = () => {
  const theme = makeTheme(`light`)
  render(
    <ThemeProvider theme={theme}>
      <OrgProjects />
    </ThemeProvider>
  )
}

describe('OrgProjects', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render the org projects page', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Organization Projects')).toBeDefined()
    })
  })

  it('should call setActiveOrgId with orgId', async () => {
    renderPage()
    await waitFor(() => {
      expect(accessors.setActiveOrgId).toHaveBeenCalledWith('org-def')
    })
  })

  it('should render the Create Project button', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Create Project')).toBeDefined()
    })
  })

  it('should render empty state when no projects', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByText(/No projects yet/)).toBeDefined()
    })
  })
})
