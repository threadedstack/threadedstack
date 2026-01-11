import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Home } from './Home'
import * as orgsActions from '@TAF/actions/orgs'
import * as accessors from '@TAF/state/accessors'

const selectorMocks = vi.hoisted(() => {
  return {
    useOrgs: vi.fn(),
    useActiveOrgId: vi.fn(),
  }
})

const mockNavigate = vi.fn()
vi.mock('react-router', () => ({
  useNavigate: () => mockNavigate,
}))

vi.mock('@TAF/pages/Page/Page', () => ({
  Page: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}))

vi.mock('@TAF/pages/Orgs/CreateOrgDialog', () => ({
  CreateOrgDialog: ({ open, onClose }: { open: boolean; onClose: () => void }) =>
    open ? (
      <div data-testid='create-org-dialog'>
        <button onClick={onClose}>Close</button>
      </div>
    ) : null,
}))

const mockOrgsData = {
  '1': { id: '1', name: 'Org Alpha', description: 'First org' },
  '2': { id: '2', name: 'Org Beta', description: 'Second org' },
}

const mockSetOrgsState = vi.fn()

vi.mock('@TAF/state/selectors', () => ({
  useOrgs: selectorMocks.useOrgs,
  useActiveOrgId: selectorMocks.useActiveOrgId,
}))

// Mock the state accessors
vi.mock('@TAF/state/accessors', () => ({
  setActiveOrgId: vi.fn(),
}))

// Mock the actions
vi.mock('@TAF/actions/orgs', () => ({
  fetchOrgs: vi.fn().mockResolvedValue({}),
}))

// Mock MUI useTheme
vi.mock('@mui/material/styles', () => ({
  styled: (...args: any[]) => vi.fn(),
  useTheme: () => ({
    palette: {
      primary: { main: '#1976d2' },
      text: { secondary: '#666' },
    },
  }),
}))

describe('Home', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    selectorMocks.useActiveOrgId.mockImplementation(() => ['1', vi.fn()])
    selectorMocks.useOrgs.mockImplementation(() => [mockOrgsData, mockSetOrgsState])
  })

  afterAll(() => {
    selectorMocks.useOrgs.mockRestore()
    selectorMocks.useActiveOrgId.mockRestore()
  })

  it('should render org selection heading', async () => {
    render(<Home />)
    await waitFor(() => {
      expect(screen.getByText('Your Organizations')).toBeDefined()
    })
  })

  it('should render org selection description', async () => {
    render(<Home />)
    await waitFor(() => {
      expect(
        screen.getByText('Choose an organization to continue or create a new one')
      ).toBeDefined()
    })
  })

  it('should call fetchOrgs on mount', async () => {
    render(<Home />)
    await waitFor(() => {
      expect(orgsActions.fetchOrgs).toHaveBeenCalled()
    })
  })

  it('should display loading state initially', async () => {
    render(<Home />)
    expect(screen.getByText('Loading orgs...')).toBeDefined()
  })

  it('should display org names after loading', async () => {
    render(<Home />)
    await waitFor(() => {
      expect(screen.getByText('Org Alpha')).toBeDefined()
      expect(screen.getByText('Org Beta')).toBeDefined()
    })
  })

  it('should display org descriptions', async () => {
    render(<Home />)
    await waitFor(() => {
      expect(screen.getByText('First org')).toBeDefined()
      expect(screen.getByText('Second org')).toBeDefined()
    })
  })

  it('should highlight active org with Current badge', async () => {
    render(<Home />)
    await waitFor(() => {
      expect(screen.getByText('Current')).toBeDefined()
    })
  })

  it('should render Create New Org button when orgs exist', async () => {
    render(<Home />)
    await waitFor(() => {
      expect(screen.getByText('Create New')).toBeDefined()
    })
  })

  it('should call setActiveOrgId and navigate when org card is clicked', async () => {
    const user = userEvent.setup()
    render(<Home />)

    await waitFor(() => {
      expect(screen.getByText('Org Beta')).toBeDefined()
    })

    const orgCard = screen.getByText('Org Beta').closest('div[class*="MuiCard"]')
    if (orgCard) {
      await user.click(orgCard)
    }

    await waitFor(() => {
      expect(accessors.setActiveOrgId).toHaveBeenCalledWith('2')
      expect(mockNavigate).toHaveBeenCalledWith('/orgs/2')
    })
  })

  it('should open create org dialog when Create New Org button is clicked', async () => {
    const user = userEvent.setup()
    render(<Home />)

    await waitFor(() => {
      expect(screen.getByText('Create New')).toBeDefined()
    })

    const createButton = screen.getByText('Create New')
    await user.click(createButton)

    await waitFor(() => {
      expect(screen.getByTestId('create-org-dialog')).toBeDefined()
    })
  })
})

describe('Home - Empty State', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    selectorMocks.useActiveOrgId.mockImplementation(() => [undefined, vi.fn()])
    selectorMocks.useOrgs.mockImplementation(() => [{}, mockSetOrgsState])
  })

  afterAll(() => {
    selectorMocks.useOrgs.mockRestore()
    selectorMocks.useActiveOrgId.mockRestore()
  })

  it('should show empty state when no orgs exist', async () => {
    vi.doMock('@TAF/state/selectors', () => ({
      useOrgs: () => [{}, mockSetOrgsState],
      useActiveOrgId: () => [null, vi.fn()],
    }))

    const { Home: HomeComponent } = await import('./Home')
    render(<HomeComponent />)

    await waitFor(() => {
      expect(
        screen.getByText(
          'No organizations yet. Create your first organization to get started.'
        )
      ).toBeDefined()
    })
  })

  it('should render Create Org button in empty state', async () => {
    // Create a custom mock for empty orgs
    vi.doMock('@TAF/state/selectors', () => ({
      useOrgs: () => [{}, mockSetOrgsState],
      useActiveOrgId: () => [null, vi.fn()],
    }))

    const { Home: HomeComponent } = await import('./Home')
    render(<HomeComponent />)

    await waitFor(() => {
      expect(screen.getByText('Create')).toBeDefined()
    })
  })
})

describe('Home - Org Selection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    selectorMocks.useActiveOrgId.mockImplementation(() => ['1', vi.fn()])
    selectorMocks.useOrgs.mockImplementation(() => [mockOrgsData, mockSetOrgsState])
  })

  afterAll(() => {
    selectorMocks.useOrgs.mockRestore()
    selectorMocks.useActiveOrgId.mockRestore()
  })

  it('should call setActiveOrgId when select icon button is clicked', async () => {
    const user = userEvent.setup()
    render(<Home />)

    await waitFor(() => {
      expect(screen.getByText('Org Alpha')).toBeDefined()
    })

    const iconButtons = screen.getAllByRole('button', {
      name: /select org|continue with org/i,
    })
    expect(iconButtons.length).toBeGreaterThan(0)

    await user.click(iconButtons[0])

    await waitFor(() => {
      expect(accessors.setActiveOrgId).toHaveBeenCalled()
      expect(mockNavigate).toHaveBeenCalled()
    })
  })

  it('should display org IDs', async () => {
    render(<Home />)
    await waitFor(() => {
      expect(screen.getByText(/ID: 1/)).toBeDefined()
      expect(screen.getByText(/ID: 2/)).toBeDefined()
    })
  })

  it('should render org icons for each org card', async () => {
    render(<Home />)
    await waitFor(() => {
      const orgCards = screen.getAllByText(/Org Alpha|Org Beta/)
      expect(orgCards.length).toBeGreaterThanOrEqual(2)
    })
  })
})
