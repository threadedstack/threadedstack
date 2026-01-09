import { TeamRepos } from './TeamRepos'
import { makeTheme } from '@tdsk/components'
import * as accessors from '@TAF/state/accessors'
import { ThemeProvider } from '@mui/material/styles'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

vi.mock('react-router', () => ({
  useParams: () => ({ teamId: 'team-def' }),
  useNavigate: () => vi.fn(),
}))

vi.mock('@TAF/state/selectors', () => ({
  useUser: () => [{}, vi.fn()],
  useRepos: () => [{}, vi.fn()],
  useThemeType: () => [undefined, vi.fn(), vi.fn()],
}))

vi.mock('@TAF/state/accessors', () => ({
  setActiveTeamId: vi.fn(),
}))

vi.mock('@TAF/actions/repos', () => ({
  fetchRepos: vi.fn(() => ({})),
  deleteRepo: vi.fn(() => ({})),
}))

const renderPage = () => {
  const theme = makeTheme(`light`)
  render(
    <ThemeProvider theme={theme}>
      <TeamRepos />
    </ThemeProvider>
  )
}

describe('TeamRepos', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render the team repos page', async () => {
    renderPage()
    await waitFor(() => {
      expect(screen.getByText('Team Repositories')).toBeDefined()
    })
  })

  it('should call setActiveTeamId with teamId', async () => {
    renderPage()
    await waitFor(() => {
      expect(accessors.setActiveTeamId).toHaveBeenCalledWith('team-def')
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
