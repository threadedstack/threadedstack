import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderWithTheme } from '../../../scripts/testUtils'
import { Projects } from './Projects'

vi.mock('react-router', () => ({
  useNavigate: () => vi.fn(),
}))

vi.mock('@TAF/pages/Page/Page', () => ({
  Page: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}))

vi.mock('@TAF/state/selectors', () => ({
  useProjects: () => [undefined, vi.fn(), vi.fn()],
  useOrgs: () => [undefined, vi.fn(), vi.fn()],
}))

vi.mock('@TAF/actions/projects', () => ({
  fetchProjects: vi.fn(),
  deleteProject: vi.fn(),
}))

describe('Projects', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render the projects page', async () => {
    renderWithTheme(<Projects />)

    await waitFor(() => {
      expect(screen.getByText('Projects')).toBeDefined()
    })
  })
})
