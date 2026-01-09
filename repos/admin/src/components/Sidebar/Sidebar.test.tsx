import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Sidebar } from './Sidebar'
import type { TNavContext } from '@TAF/types'

// Mock react-router
const mockNavigate = vi.fn()
vi.mock('react-router', () => ({
  useLocation: () => ({ pathname: '/' }),
  useNavigate: () => mockNavigate,
}))

// Default mock state
let mockSidebarOpen = true
let mockSetSidebarOpen = vi.fn()
let mockTeams = {}
let mockRepos = {}
let mockActiveTeamId = null
let mockActiveRepoId = null

// Mock state selectors
vi.mock('@TAF/state/selectors', () => ({
  useSidebarOpen: () => [mockSidebarOpen, mockSetSidebarOpen],
  useTeams: () => [mockTeams, vi.fn()],
  useRepos: () => [mockRepos, vi.fn()],
  useActiveTeamId: () => [mockActiveTeamId, vi.fn()],
  useActiveRepoId: () => [mockActiveRepoId, vi.fn()],
}))

// Mock getDynamicNavConfig with realistic implementation
vi.mock('@TAF/constants/nav', () => ({
  getDynamicNavConfig: (ctx: TNavContext) => {
    const sections = []

    // Global section (always visible)
    sections.push({
      id: 'global',
      items: [
        { text: 'Home', to: '/teams', Icon: null },
        { text: 'AI', to: '/ai', Icon: null },
      ],
    })

    // Team section (visible when teamId is present)
    if (ctx.teamId) {
      sections.push({
        id: 'team',
        header: ctx.teamName || 'Team',
        items: [
          { text: 'Users', to: `/teams/${ctx.teamId}/users`, Icon: null },
          { text: 'Repos', to: `/teams/${ctx.teamId}/repos`, Icon: null },
          { text: 'Secrets', to: `/teams/${ctx.teamId}/secrets`, Icon: null },
          { text: 'Providers', to: `/teams/${ctx.teamId}/providers`, Icon: null },
          { text: 'Team Settings', to: `/teams/${ctx.teamId}/settings`, Icon: null },
        ],
        visible: (c: TNavContext) => !!c.teamId,
      })
    }

    // Repo section (visible when teamId and repoId are present)
    if (ctx.teamId && ctx.repoId) {
      sections.push({
        id: 'repo',
        header: ctx.repoName || 'Repository',
        items: [
          { text: 'Endpoints', to: `/teams/${ctx.teamId}/repos/${ctx.repoId}/endpoints`, Icon: null },
          { text: 'Functions', to: `/teams/${ctx.teamId}/repos/${ctx.repoId}/functions`, Icon: null },
          { text: 'Secrets', to: `/teams/${ctx.teamId}/repos/${ctx.repoId}/secrets`, Icon: null },
          { text: 'Providers', to: `/teams/${ctx.teamId}/repos/${ctx.repoId}/providers`, Icon: null },
          { text: 'Repo Settings', to: `/teams/${ctx.teamId}/repos/${ctx.repoId}/settings`, Icon: null },
        ],
        visible: (c: TNavContext) => !!c.teamId && !!c.repoId,
      })
    }

    return {
      sections,
      bottomItems: [{ text: 'Settings', to: '/settings', Icon: null }],
    }
  },
  BottomNavItems: [{ text: 'Settings', to: '/settings', Icon: null }],
}))

// Mock styled components and MUI
vi.mock('@TAF/components/Sidebar/Sidebar.styles', () => ({
  SideDrawer: ({ children, onClick }: any) => (
    <div data-testid="side-drawer" onClick={onClick}>
      {children}
    </div>
  ),
  SBToggleBox: ({ children }: any) => <div data-testid="toggle-box">{children}</div>,
  SBToggleBtn: ({ children, onClick }: any) => (
    <button data-testid="toggle-btn" onClick={onClick}>
      {children}
    </button>
  ),
  SBNavListSpacer: () => <div data-testid="nav-spacer" />,
  SBSectionHeader: ({ children }: any) => (
    <div data-testid="section-header">{children}</div>
  ),
}))

vi.mock('@TAF/components/Sidebar/SBLogo', () => ({
  SBLogo: ({ full }: { full: boolean }) => (
    <div data-testid="logo">{full ? 'Full Logo' : 'Mini Logo'}</div>
  ),
}))

vi.mock('@TAF/components/Sidebar/SBNavList', () => ({
  SBNavList: ({ items, context }: any) => (
    <div data-testid="nav-list">
      {items?.map((item: any, i: number) => (
        <div key={i} data-testid="nav-item">
          {item.text}
        </div>
      ))}
    </div>
  ),
}))

vi.mock('@mui/material', () => ({
  Toolbar: ({ children, sx }: any) => <div data-testid="toolbar">{children}</div>,
  Divider: () => <hr data-testid="divider" />,
  Typography: ({ children }: any) => <span>{children}</span>,
}))

vi.mock('@mui/icons-material', () => ({
  ChevronLeft: () => <span data-testid="chevron-left">ChevronLeft</span>,
  ChevronRight: () => <span data-testid="chevron-right">ChevronRight</span>,
}))

vi.mock('@tdsk/components', () => ({
  dims: { header: { hpx: '64px' } },
}))

describe('Sidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset to default state
    mockSidebarOpen = true
    mockSetSidebarOpen = vi.fn()
    mockTeams = {}
    mockRepos = {}
    mockActiveTeamId = null
    mockActiveRepoId = null
  })

  describe('Basic Rendering', () => {
    it('should render the sidebar', () => {
      render(<Sidebar />)
      expect(screen.getByTestId('side-drawer')).toBeDefined()
    })

    it('should render the logo', () => {
      render(<Sidebar />)
      expect(screen.getByTestId('logo')).toBeDefined()
    })

    it('should render full logo when sidebar is open', () => {
      mockSidebarOpen = true
      render(<Sidebar />)
      expect(screen.getByText('Full Logo')).toBeDefined()
    })

    it('should render mini logo when sidebar is closed', () => {
      mockSidebarOpen = false
      render(<Sidebar />)
      expect(screen.getByText('Mini Logo')).toBeDefined()
    })

    it('should render toolbar', () => {
      render(<Sidebar />)
      expect(screen.getByTestId('toolbar')).toBeDefined()
    })

    it('should render toggle button', () => {
      render(<Sidebar />)
      expect(screen.getByTestId('toggle-btn')).toBeDefined()
    })

    it('should render divider', () => {
      render(<Sidebar />)
      expect(screen.getByTestId('divider')).toBeDefined()
    })

    it('should render nav spacer', () => {
      render(<Sidebar />)
      expect(screen.getByTestId('nav-spacer')).toBeDefined()
    })
  })

  describe('Navigation Lists', () => {
    it('should render nav lists', () => {
      render(<Sidebar />)
      const navLists = screen.getAllByTestId('nav-list')
      expect(navLists.length).toBeGreaterThan(0)
    })

    it('should render bottom navigation items', () => {
      render(<Sidebar />)
      expect(screen.getByText('Settings')).toBeDefined()
    })
  })

  describe('Toggle Functionality', () => {
    it('should show ChevronLeft icon when sidebar is open', () => {
      mockSidebarOpen = true
      render(<Sidebar />)
      expect(screen.getByTestId('chevron-left')).toBeDefined()
    })

    it('should show ChevronRight icon when sidebar is closed', () => {
      mockSidebarOpen = false
      render(<Sidebar />)
      expect(screen.getByTestId('chevron-right')).toBeDefined()
    })

    it('should toggle sidebar when toggle button is clicked', () => {
      mockSidebarOpen = true
      render(<Sidebar />)
      const toggleBtn = screen.getByTestId('toggle-btn')
      fireEvent.click(toggleBtn)
      expect(mockSetSidebarOpen).toHaveBeenCalledWith(false)
    })

    it('should open sidebar when clicking on closed drawer', () => {
      mockSidebarOpen = false
      render(<Sidebar />)
      const drawer = screen.getByTestId('side-drawer')
      fireEvent.click(drawer)
      expect(mockSetSidebarOpen).toHaveBeenCalledWith(true)
    })

    it('should not trigger open when clicking on open drawer', () => {
      mockSidebarOpen = true
      render(<Sidebar />)
      const drawer = screen.getByTestId('side-drawer')
      fireEvent.click(drawer)
      expect(mockSetSidebarOpen).not.toHaveBeenCalled()
    })
  })

  describe('Context: No Team/Repo Selected', () => {
    beforeEach(() => {
      mockActiveTeamId = null
      mockActiveRepoId = null
      mockTeams = {}
      mockRepos = {}
    })

    it('should render only global navigation', () => {
      render(<Sidebar />)
      expect(screen.getByText('Home')).toBeDefined()
      expect(screen.getByText('AI')).toBeDefined()
    })

    it('should not render team section headers', () => {
      render(<Sidebar />)
      const headers = screen.queryAllByTestId('section-header')
      expect(headers.length).toBe(0)
    })

    it('should not render team navigation items', () => {
      render(<Sidebar />)
      expect(screen.queryByText('Users')).toBeNull()
      expect(screen.queryByText('Repos')).toBeNull()
    })

    it('should not render repo navigation items', () => {
      render(<Sidebar />)
      expect(screen.queryByText('Endpoints')).toBeNull()
      expect(screen.queryByText('Functions')).toBeNull()
    })
  })

  describe('Context: Team Selected, No Repo', () => {
    beforeEach(() => {
      mockActiveTeamId = 'team-1'
      mockActiveRepoId = null
      mockTeams = {
        'team-1': { id: 'team-1', name: 'Engineering Team' },
      }
      mockRepos = {}
    })

    it('should render global and team navigation', () => {
      render(<Sidebar />)
      expect(screen.getByText('Home')).toBeDefined()
      expect(screen.getByText('AI')).toBeDefined()
      expect(screen.getByText('Users')).toBeDefined()
      expect(screen.getByText('Repos')).toBeDefined()
    })

    it('should render team section header with team name', () => {
      render(<Sidebar />)
      const headers = screen.getAllByTestId('section-header')
      expect(headers.length).toBeGreaterThan(0)
      expect(screen.getByText('Engineering Team')).toBeDefined()
    })

    it('should render team navigation items', () => {
      render(<Sidebar />)
      expect(screen.getByText('Users')).toBeDefined()
      expect(screen.getByText('Repos')).toBeDefined()
      expect(screen.getAllByText('Secrets').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Providers').length).toBeGreaterThan(0)
      expect(screen.getByText('Team Settings')).toBeDefined()
    })

    it('should not render repo navigation items', () => {
      render(<Sidebar />)
      expect(screen.queryByText('Endpoints')).toBeNull()
      expect(screen.queryByText('Functions')).toBeNull()
      expect(screen.queryByText('Repo Settings')).toBeNull()
    })

    it('should use default team name when team name is not available', () => {
      mockTeams = { 'team-1': { id: 'team-1' } }
      render(<Sidebar />)
      expect(screen.getByText('Team')).toBeDefined()
    })
  })

  describe('Context: Team and Repo Selected', () => {
    beforeEach(() => {
      mockActiveTeamId = 'team-1'
      mockActiveRepoId = 'repo-1'
      mockTeams = {
        'team-1': { id: 'team-1', name: 'Engineering Team' },
      }
      mockRepos = {
        'repo-1': { id: 'repo-1', name: 'API Gateway' },
      }
    })

    it('should render all navigation sections', () => {
      render(<Sidebar />)
      // Global
      expect(screen.getByText('Home')).toBeDefined()
      expect(screen.getByText('AI')).toBeDefined()
      // Team
      expect(screen.getByText('Users')).toBeDefined()
      expect(screen.getByText('Repos')).toBeDefined()
      // Repo
      expect(screen.getByText('Endpoints')).toBeDefined()
      expect(screen.getByText('Functions')).toBeDefined()
    })

    it('should render both team and repo section headers', () => {
      render(<Sidebar />)
      const headers = screen.getAllByTestId('section-header')
      expect(headers.length).toBe(2)
      expect(screen.getByText('Engineering Team')).toBeDefined()
      expect(screen.getByText('API Gateway')).toBeDefined()
    })

    it('should render team navigation items', () => {
      render(<Sidebar />)
      expect(screen.getByText('Users')).toBeDefined()
      expect(screen.getByText('Repos')).toBeDefined()
      expect(screen.getByText('Team Settings')).toBeDefined()
    })

    it('should render repo navigation items', () => {
      render(<Sidebar />)
      expect(screen.getByText('Endpoints')).toBeDefined()
      expect(screen.getByText('Functions')).toBeDefined()
      expect(screen.getByText('Repo Settings')).toBeDefined()
    })

    it('should render Secrets in both team and repo sections', () => {
      render(<Sidebar />)
      const secretsItems = screen.getAllByText('Secrets')
      expect(secretsItems.length).toBe(2) // One in team section, one in repo section
    })

    it('should render Providers in both team and repo sections', () => {
      render(<Sidebar />)
      const providersItems = screen.getAllByText('Providers')
      expect(providersItems.length).toBe(2) // One in team section, one in repo section
    })

    it('should use default repo name when repo name is not available', () => {
      mockRepos = { 'repo-1': { id: 'repo-1' } }
      render(<Sidebar />)
      expect(screen.getByText('Repository')).toBeDefined()
    })
  })

  describe('Section Headers with Open/Closed State', () => {
    beforeEach(() => {
      mockActiveTeamId = 'team-1'
      mockActiveRepoId = 'repo-1'
      mockTeams = {
        'team-1': { id: 'team-1', name: 'Engineering Team' },
      }
      mockRepos = {
        'repo-1': { id: 'repo-1', name: 'API Gateway' },
      }
    })

    it('should render section headers when sidebar is open', () => {
      mockSidebarOpen = true
      render(<Sidebar />)
      expect(screen.getByText('Engineering Team')).toBeDefined()
      expect(screen.getByText('API Gateway')).toBeDefined()
    })

    it('should not render section headers when sidebar is closed', () => {
      mockSidebarOpen = false
      render(<Sidebar />)
      expect(screen.queryByText('Engineering Team')).toBeNull()
      expect(screen.queryByText('API Gateway')).toBeNull()
    })
  })

  describe('Navigation Items Rendering', () => {
    it('should render correct number of global nav items', () => {
      render(<Sidebar />)
      expect(screen.getByText('Home')).toBeDefined()
      expect(screen.getByText('AI')).toBeDefined()
    })

    it('should render correct number of team nav items when team is selected', () => {
      mockActiveTeamId = 'team-1'
      mockTeams = { 'team-1': { id: 'team-1', name: 'Engineering Team' } }
      render(<Sidebar />)

      expect(screen.getByText('Users')).toBeDefined()
      expect(screen.getByText('Repos')).toBeDefined()
      expect(screen.getByText('Team Settings')).toBeDefined()
    })

    it('should render correct number of repo nav items when repo is selected', () => {
      mockActiveTeamId = 'team-1'
      mockActiveRepoId = 'repo-1'
      mockTeams = { 'team-1': { id: 'team-1', name: 'Engineering Team' } }
      mockRepos = { 'repo-1': { id: 'repo-1', name: 'API Gateway' } }
      render(<Sidebar />)

      expect(screen.getByText('Endpoints')).toBeDefined()
      expect(screen.getByText('Functions')).toBeDefined()
      expect(screen.getByText('Repo Settings')).toBeDefined()
    })
  })

  describe('Context Building', () => {
    it('should build context with no IDs when nothing is selected', () => {
      mockActiveTeamId = null
      mockActiveRepoId = null
      render(<Sidebar />)
      // Component should render without errors
      expect(screen.getByTestId('side-drawer')).toBeDefined()
    })

    it('should build context with team ID and name', () => {
      mockActiveTeamId = 'team-1'
      mockTeams = { 'team-1': { id: 'team-1', name: 'Engineering Team' } }
      render(<Sidebar />)
      expect(screen.getByText('Engineering Team')).toBeDefined()
    })

    it('should build context with repo ID and name', () => {
      mockActiveTeamId = 'team-1'
      mockActiveRepoId = 'repo-1'
      mockTeams = { 'team-1': { id: 'team-1', name: 'Engineering Team' } }
      mockRepos = { 'repo-1': { id: 'repo-1', name: 'API Gateway' } }
      render(<Sidebar />)
      expect(screen.getByText('API Gateway')).toBeDefined()
    })

    it('should handle missing team data gracefully', () => {
      mockActiveTeamId = 'team-1'
      mockTeams = {}
      render(<Sidebar />)
      expect(screen.getByText('Team')).toBeDefined()
    })

    it('should handle missing repo data gracefully', () => {
      mockActiveTeamId = 'team-1'
      mockActiveRepoId = 'repo-1'
      mockTeams = { 'team-1': { id: 'team-1', name: 'Engineering Team' } }
      mockRepos = {}
      render(<Sidebar />)
      expect(screen.getByText('Repository')).toBeDefined()
    })
  })
})
