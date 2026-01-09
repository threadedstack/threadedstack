import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CreateRepoDialog } from './CreateRepoDialog'

vi.mock('@TAF/state/selectors', () => ({
  useTeams: () => [undefined, vi.fn(), vi.fn()],
}))

vi.mock('@TAF/actions/repos', () => ({
  createRepo: vi.fn(),
}))

vi.mock('@TAF/actions/teams', () => ({
  fetchTeams: vi.fn(),
}))

describe('CreateRepoDialog', () => {
  it('should render the create repo dialog when open', () => {
    render(
      <CreateRepoDialog
        open={true}
        onClose={vi.fn()}
      />
    )
    expect(screen.getByText('Create New Repository')).toBeDefined()
  })

  it('should not render when closed', () => {
    const { container } = render(
      <CreateRepoDialog
        open={false}
        onClose={vi.fn()}
      />
    )
    expect(container.querySelector('[role="dialog"]')).toBeNull()
  })
})
