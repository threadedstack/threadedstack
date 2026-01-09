import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { Repo } from './Repo'

vi.mock('react-router', () => ({
  useParams: () => ({ repoId: '1' }),
  useNavigate: () => vi.fn(),
}))

vi.mock('@TAF/state/selectors', () => ({
  useRepos: () => [undefined, vi.fn(), vi.fn()],
  useThemeType: () => [undefined, vi.fn(), vi.fn()],
}))

vi.mock('@TAF/actions/repos', () => ({
  fetchRepo: vi.fn(),
  deleteRepo: vi.fn(),
}))

describe('Repo', () => {
  it('should render the repo detail page', async () => {
    render(<Repo />)
    //await waitFor(() => {
    //  expect(screen.getByText('Loading repository...')).toBeDefined()
    //})
  })
})
