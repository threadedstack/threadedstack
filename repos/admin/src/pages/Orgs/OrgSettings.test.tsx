import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderWithTheme } from '../../../scripts/testUtils'
import { OrgSettings } from './OrgSettings'
import * as accessors from '@TAF/state/accessors'

// Mock the router
vi.mock('react-router', () => ({
  useParams: () => ({ orgId: 'org-abc' }),
  useNavigate: () => vi.fn(),
}))

// Mock the Page component
vi.mock('@TAF/pages/Page/Page', () => ({
  Page: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}))

// Mock accessors
vi.mock('@TAF/state/accessors', () => ({
  setActiveOrgId: vi.fn(),
}))

// Mock actions
vi.mock('@TAF/actions/orgs', () => ({
  fetchOrg: vi.fn().mockResolvedValue({
    org: {
      id: 'org-abc',
      name: 'Test Org',
      description: 'Test Description',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  }),
  updateOrg: vi.fn(),
  deleteOrg: vi.fn(),
}))

// Mock state selectors
vi.mock('@TAF/state/selectors', () => ({
  useOrgs: () => [
    {
      'org-abc': {
        id: 'org-abc',
        name: 'Test Org',
        description: 'Test Description',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    },
  ],
}))

describe('OrgSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render the org settings page', async () => {
    renderWithTheme(<OrgSettings />)
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Org Settings' })).toBeDefined()
    })
  })

  it('should display the org ID', async () => {
    renderWithTheme(<OrgSettings />)
    await waitFor(() => {
      expect(screen.getByText('org-abc')).toBeDefined()
    })
  })

  it('should call setActiveOrgId with orgId', async () => {
    renderWithTheme(<OrgSettings />)
    await waitFor(() => {
      expect(accessors.setActiveOrgId).toHaveBeenCalledWith('org-abc')
    })
  })
})
