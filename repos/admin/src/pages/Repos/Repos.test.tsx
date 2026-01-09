import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Repos } from './Repos'

vi.mock('react-router', () => ({
  useNavigate: () => vi.fn(),
}))

vi.mock('@TAF/state/selectors', () => ({
  useRepos: () => [undefined, vi.fn(), vi.fn()],
}))

vi.mock('@TAF/actions/repos', () => ({
  fetchRepos: vi.fn(),
  deleteRepo: vi.fn(),
}))

describe('Repos', () => {
  it('should render the repos page', () => {
    render(<Repos />)
    expect(screen.getByText('Repositories')).toBeDefined()
  })
})
