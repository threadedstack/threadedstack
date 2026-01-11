import { OrgRepos } from './OrgRepos'
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
  useRepos: () => [{}, vi.fn()],
  useThemeType: () => [undefined, vi.fn(), vi.fn()],
}))

vi.mock('@TAF/state/accessors', () => ({
  setActiveOrgId: vi.fn(),
}))

vi.mock('@TAF/actions/repos', () => ({
  fetchRepos: vi.fn(() => ({})),
  deleteRepo: vi.fn(() => ({})),
}))

const renderPage = () => {
  const theme = makeTheme(`light`)
  render(
    <ThemeProvider theme={theme}>
      <OrgRepos />
    </ThemeProvider>
  )
}

describe('OrgRepos', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render the org repos page', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Org Repositories')).toBeDefined()
    })
  })

  it('should call setActiveOrgId with orgId', async () => {
    renderPage()
    await waitFor(() => {
      expect(accessors.setActiveOrgId).toHaveBeenCalledWith('org-def')
    })
  })

  it('should render the Create Repository button', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Create Repository')).toBeDefined()
    })
  })

  it('should render empty state when no repositories', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByText(/No repositories yet/)).toBeDefined()
    })
  })
})
