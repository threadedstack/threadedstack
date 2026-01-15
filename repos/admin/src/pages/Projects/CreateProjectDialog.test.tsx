import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithTheme } from '../../../scripts/testUtils'
import { CreateProjectDialog } from './CreateProjectDialog'

vi.mock('@TAF/state/selectors', () => ({
  useOrgs: () => [undefined, vi.fn(), vi.fn()],
}))

vi.mock('@TAF/actions/projects', () => ({
  createProject: vi.fn(),
}))

vi.mock('@TAF/actions/orgs', () => ({
  fetchOrgs: vi.fn(),
}))

describe('CreateProjectDialog', () => {
  it('should render the create project dialog when open', () => {
    renderWithTheme(
      <CreateProjectDialog
        open={true}
        onClose={vi.fn()}
      />
    )
    expect(screen.getByText('Create New Project')).toBeDefined()
  })

  it('should not render when closed', () => {
    const { container } = renderWithTheme(
      <CreateProjectDialog
        open={false}
        onClose={vi.fn()}
      />
    )
    expect(container.querySelector('[role="dialog"]')).toBeNull()
  })
})
