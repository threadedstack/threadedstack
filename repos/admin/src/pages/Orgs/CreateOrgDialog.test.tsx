import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { CreateOrgDialog } from './CreateOrgDialog'
import * as orgsActions from '@TAF/actions/orgs'

// Mock the actions
vi.mock('@TAF/actions/orgs', () => ({
  createOrg: vi.fn().mockResolvedValue({ org: { id: '1', name: 'New Org' } }),
}))

describe('CreateOrgDialog', () => {
  it('should render dialog when open', () => {
    render(
      <CreateOrgDialog
        open={true}
        onClose={vi.fn()}
      />
    )

    expect(screen.getByText('Create New Org')).toBeDefined()
    expect(screen.getByPlaceholderText('Enter org name')).toBeDefined()
  })

  it('should not render when closed', () => {
    render(
      <CreateOrgDialog
        open={false}
        onClose={vi.fn()}
      />
    )

    expect(screen.queryByText('Create New Org')).toBeNull()
  })

  it('should show error when submitting with empty name', async () => {
    render(
      <CreateOrgDialog
        open={true}
        onClose={vi.fn()}
      />
    )

    // Clear any value and ensure the input is empty
    const nameInput = screen.getByPlaceholderText('Enter org name')
    fireEvent.change(nameInput, { target: { value: '' } })

    // Submit the form directly to bypass browser validation
    const form = screen.getByText('Create New Org').closest('form')
    fireEvent.submit(form!)

    await waitFor(() => {
      expect(screen.getByText('Org name is required')).toBeDefined()
    })
  })

  it('should call createOrg with correct data', async () => {
    const onClose = vi.fn()
    render(
      <CreateOrgDialog
        open={true}
        onClose={onClose}
      />
    )

    const nameInput = screen.getByPlaceholderText('Enter org name')
    const descInput = screen.getByPlaceholderText('Enter org description (optional)')

    fireEvent.change(nameInput, { target: { value: 'New Org' } })
    fireEvent.change(descInput, { target: { value: 'Org description' } })

    const submitButton = screen.getByText('Create Org')
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(orgsActions.createOrg).toHaveBeenCalledWith({
        name: 'New Org',
        description: 'Org description',
      })
    })
  })
})
