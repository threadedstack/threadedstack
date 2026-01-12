import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { Project } from './Project'

vi.mock('react-router', () => ({
  useParams: () => ({ projectId: '1' }),
  useNavigate: () => vi.fn(),
}))

vi.mock('@TAF/state/selectors', () => ({
  useProjects: () => [undefined, vi.fn(), vi.fn()],
  useThemeType: () => [undefined, vi.fn(), vi.fn()],
}))

vi.mock('@TAF/actions/projects', () => ({
  fetchProject: vi.fn(),
  deleteProject: vi.fn(),
}))

describe('Project', () => {
  it('should render the project detail page', async () => {
    render(<Project />)
    //await waitFor(() => {
    //  expect(screen.getByText('Loading project...')).toBeDefined()
    //})
  })
})
