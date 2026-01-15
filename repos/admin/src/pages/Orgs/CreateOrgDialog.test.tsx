import { describe, it, expect, vi } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { renderWithTheme } from '../../../scripts/testUtils'
import { CreateOrgDialog } from './CreateOrgDialog'
import * as orgsActions from '@TAF/actions/orgs'

// Mock the actions
vi.mock('@TAF/actions/orgs', () => ({
  createOrg: vi.fn().mockResolvedValue({ org: { id: '1', name: 'New Org' } }),
}))

describe('CreateOrgDialog', () => {
  it('should render dialog when open', () => {
    renderWithTheme(
      <CreateOrgDialog
        open={true}
        onClose={vi.fn()}
      />
    )

    expect(screen.getByText('Create')).toBeDefined()
    expect(screen.getByPlaceholderText('Enter organization name')).toBeDefined()
  })

  it('should not render when closed', () => {
    renderWithTheme(
      <CreateOrgDialog
        open={false}
        onClose={vi.fn()}
      />
    )

    expect(screen.queryByText('Create')).toBeNull()
  })

  it('should show error when submitting with empty name', async () => {
    renderWithTheme(
      <CreateOrgDialog
        open={true}
        onClose={vi.fn()}
      />
    )

    // Clear any value and ensure the input is empty
    const nameInput = screen.getByPlaceholderText('Enter organization name')
    fireEvent.change(nameInput, { target: { value: '' } })

    // Submit the form directly by ID to bypass browser validation
    const form = document.getElementById('create-org-form')
    fireEvent.submit(form!)

    await waitFor(() => {
      expect(screen.getByText('Organization name is required')).toBeDefined()
    })
  })

  it('should call createOrg with correct data', async () => {
    const onClose = vi.fn()
    renderWithTheme(
      <CreateOrgDialog
        open={true}
        onClose={onClose}
      />
    )

    const nameInput = screen.getByPlaceholderText('Enter organization name')
    const descInput = screen.getByPlaceholderText(
      'Enter organization description (optional)'
    )

    fireEvent.change(nameInput, { target: { value: 'New Org' } })
    fireEvent.change(descInput, { target: { value: 'Org description' } })

    const submitButton = screen.getByText('Create')
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(orgsActions.createOrg).toHaveBeenCalledWith({
        name: 'New Org',
        description: 'Org description',
      })
    })
  })
})
