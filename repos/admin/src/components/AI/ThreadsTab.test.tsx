import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const mockOnViewThread = vi.fn()
const mockSetActiveThreadId = vi.fn()
const mockFetchThreads = vi.fn().mockResolvedValue({ data: {} })
const mockDeleteThread = vi.fn().mockResolvedValue({ data: {} })

const mockUseActiveOrgId = vi.fn(() => [`org-1`])
const mockUseOrgAgents = vi.fn(() => [
  {
    'agent-1': {
      id: `agent-1`,
      name: `Test Agent`,
      primaryProvider: { id: `provider-1`, name: `Anthropic` },
    },
  },
])
const mockUseOrgThreads = vi.fn(() => [{}])
const mockUseProviders = vi.fn(() => [{}])
const mockUseActiveAgentId = vi.fn(() => [`agent-1`])
const mockUseActiveThreadId = vi.fn(() => [`thread-1`, mockSetActiveThreadId])

vi.mock(`@TAF/state/selectors`, () => ({
  useActiveOrgId: () => mockUseActiveOrgId(),
  useOrgAgents: () => mockUseOrgAgents(),
  useOrgThreads: () => mockUseOrgThreads(),
  useProviders: () => mockUseProviders(),
  useActiveAgentId: () => mockUseActiveAgentId(),
  useActiveThreadId: () => mockUseActiveThreadId(),
  useActiveOrgResolvedPerms: vi.fn(() => [undefined]),
}))

vi.mock(`@TAF/actions/threads/api/fetchThreads`, () => ({
  fetchThreads: (...args: any[]) => mockFetchThreads(...args),
}))

vi.mock(`@TAF/actions/threads/api/deleteThread`, () => ({
  deleteThread: (...args: any[]) => mockDeleteThread(...args),
}))

vi.mock(`@TAF/components/PageLayout/PageLayout`, () => ({
  PageLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock(`@TAF/components/EmptyState/EmptyState`, () => ({
  EmptyState: ({ message }: { message: string }) => (
    <div data-testid='empty-state'>{message}</div>
  ),
}))

vi.mock(`@TAF/components/AI/EditThreadDrawer`, () => ({
  EditThreadDrawer: () => null,
}))

vi.mock(`@TAF/components/AI/CreateThreadDrawer`, () => ({
  CreateThreadDrawer: () => null,
}))

vi.mock(`@tdsk/components`, () => ({
  ConfirmDelete: () => null,
}))

import { ThreadsTab } from './ThreadsTab'

const threadsMockData = {
  'thread-1': {
    id: `thread-1`,
    name: `Thread One`,
    agentId: `agent-1`,
    orgId: `org-1`,
    public: false,
    providerId: `provider-1`,
    updatedAt: `2026-01-01`,
  },
  'thread-2': {
    id: `thread-2`,
    name: `Thread Two`,
    agentId: `agent-1`,
    orgId: `org-1`,
    public: true,
    providerId: `provider-2`,
    updatedAt: `2026-01-02`,
  },
}

const providersMockData = {
  'provider-1': { id: `provider-1`, name: `Anthropic`, type: `ai`, orgId: `org-1` },
  'provider-2': { id: `provider-2`, name: `OpenAI`, type: `ai`, orgId: `org-1` },
}

describe(`ThreadsTab`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetchThreads.mockResolvedValue({ data: {} })
    mockDeleteThread.mockResolvedValue({ data: {} })
    mockUseActiveOrgId.mockReturnValue([`org-1`])
    mockUseOrgAgents.mockReturnValue([
      {
        'agent-1': {
          id: `agent-1`,
          name: `Test Agent`,
          primaryProvider: { id: `provider-1`, name: `Anthropic` },
        },
      },
    ])
    mockUseOrgThreads.mockReturnValue([threadsMockData])
    mockUseProviders.mockReturnValue([providersMockData])
    mockUseActiveAgentId.mockReturnValue([`agent-1`])
    mockUseActiveThreadId.mockReturnValue([`thread-1`, mockSetActiveThreadId])
  })

  it(`should call onViewThread when a table row is clicked`, () => {
    render(<ThreadsTab onViewThread={mockOnViewThread} />)

    const threadRow = screen.getByText(`Thread One`).closest(`tr`)
    expect(threadRow).toBeTruthy()
    fireEvent.click(threadRow!)

    expect(mockOnViewThread).toHaveBeenCalledWith(`thread-1`)
    expect(mockSetActiveThreadId).toHaveBeenCalledWith(`thread-1`)
  })

  it(`should not call onViewThread when the edit button is clicked`, () => {
    render(<ThreadsTab onViewThread={mockOnViewThread} />)

    const editButtons = screen.getAllByTitle(`Edit thread`)
    fireEvent.click(editButtons[0])

    expect(mockOnViewThread).not.toHaveBeenCalled()
  })

  it(`should not call onViewThread when the delete button is clicked`, () => {
    render(<ThreadsTab onViewThread={mockOnViewThread} />)

    const deleteButtons = screen.getAllByTitle(`Delete thread`)
    fireEvent.click(deleteButtons[0])

    expect(mockOnViewThread).not.toHaveBeenCalled()
  })

  it(`should render provider filter when multiple providers exist`, () => {
    render(<ThreadsTab onViewThread={mockOnViewThread} />)

    expect(screen.getByLabelText(`Filter by Provider`)).toBeTruthy()
  })

  it(`should not render provider filter with a single provider`, () => {
    const singleProviderThreads = {
      'thread-1': {
        id: `thread-1`,
        name: `Thread One`,
        agentId: `agent-1`,
        orgId: `org-1`,
        public: false,
        providerId: `provider-1`,
        updatedAt: `2026-01-01`,
      },
    }
    const singleProvider = {
      'provider-1': { id: `provider-1`, name: `Anthropic`, type: `ai`, orgId: `org-1` },
    }

    mockUseOrgThreads.mockReturnValue([singleProviderThreads])
    mockUseProviders.mockReturnValue([singleProvider])

    render(<ThreadsTab onViewThread={mockOnViewThread} />)

    expect(screen.queryByLabelText(`Filter by Provider`)).toBeNull()
  })

  it(`should filter threads when a provider is selected`, () => {
    render(<ThreadsTab onViewThread={mockOnViewThread} />)

    expect(screen.getByText(`Thread One`)).toBeTruthy()
    expect(screen.getByText(`Thread Two`)).toBeTruthy()

    const filterSelect = screen.getByLabelText(`Filter by Provider`)
    fireEvent.mouseDown(filterSelect)

    const openAIOption = screen.getByRole(`option`, { name: `OpenAI` })
    fireEvent.click(openAIOption)

    expect(screen.queryByText(`Thread One`)).toBeNull()
    expect(screen.getByText(`Thread Two`)).toBeTruthy()
  })
})
