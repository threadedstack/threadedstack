import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { CreateTeamDialog } from './CreateTeamDialog'
import * as teamsActions from '@TAF/actions/teams'

// Mock the actions
vi.mock('@TAF/actions/teams', () => ({
  createTeam: vi.fn().mockResolvedValue({ team: { id: '1', name: 'New Team' } }),
}))

describe('CreateTeamDialog', () => {
  it('should render dialog when open', () => {
    render(
      <CreateTeamDialog
        open={true}
        onClose={vi.fn()}
      />
    )

    expect(screen.getByText('Create New Team')).toBeDefined()
    expect(screen.getByPlaceholderText('Enter team name')).toBeDefined()
  })

  it('should not render when closed', () => {
    render(
      <CreateTeamDialog
        open={false}
        onClose={vi.fn()}
      />
    )

    expect(screen.queryByText('Create New Team')).toBeNull()
  })

  it('should show error when name is empty', async () => {
    render(
      <CreateTeamDialog
        open={true}
        onClose={vi.fn()}
      />
    )

    const submitButton = screen.getByText('Create Team')
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText('Team name is required')).toBeDefined()
    })
  })

  it('should call createTeam with correct data', async () => {
    const onClose = vi.fn()
    render(
      <CreateTeamDialog
        open={true}
        onClose={onClose}
      />
    )

    const nameInput = screen.getByPlaceholderText('Enter team name')
    const descInput = screen.getByPlaceholderText('Enter team description (optional)')

    fireEvent.change(nameInput, { target: { value: 'New Team' } })
    fireEvent.change(descInput, { target: { value: 'Team description' } })

    const submitButton = screen.getByText('Create Team')
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(teamsActions.createTeam).toHaveBeenCalledWith({
        name: 'New Team',
        description: 'Team description',
      })
    })
  })
})
