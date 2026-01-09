import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { Repos } from './Repos'

vi.mock('react-router', () => ({
  useNavigate: () => vi.fn(),
}))

vi.mock('@TAF/pages/Page/Page', () => ({
  Page: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}))

vi.mock('@TAF/state/selectors', () => ({
  useRepos: () => [undefined, vi.fn(), vi.fn()],
  useTeams: () => [undefined, vi.fn(), vi.fn()],
}))

vi.mock('@TAF/actions/repos', () => ({
  fetchRepos: vi.fn(),
  deleteRepo: vi.fn(),
}))

describe('Repos', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render the repos page', async () => {
    render(<Repos />)

    await waitFor(() => {
      expect(screen.getByText('Repositories')).toBeDefined()
    })
  })
})
