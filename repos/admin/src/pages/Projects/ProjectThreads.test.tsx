import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router'

const mockNavigate = vi.fn()

const mockUseActiveOrgId = vi.fn(() => [`org-1`])
const mockUseActiveProjectId = vi.fn(() => [`project-1`])

vi.mock(`@TAF/state/selectors`, () => ({
  // @ts-ignore
  useActiveOrgId: (...args: any[]) => mockUseActiveOrgId(...args),
  // @ts-ignore
  useActiveProjectId: (...args: any[]) => mockUseActiveProjectId(...args),
  useActiveOrgResolvedPerms: vi.fn(() => [undefined]),
}))

vi.mock(`react-router`, async () => {
  const actual = await vi.importActual(`react-router`)
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ agentId: `agent-1` }),
  }
})

vi.mock(`@TAF/components/AI/ThreadsTab`, () => ({
  ThreadsTab: ({ onViewThread, onChatWithThread }: any) => (
    <div data-testid='threads-tab'>
      <button
        data-testid='view-thread-btn'
        onClick={() => onViewThread(`thread-xyz`)}
      >
        View Thread
      </button>
      <button
        data-testid='chat-thread-btn'
        onClick={() => onChatWithThread(`thread-xyz`, `agent-1`)}
      >
        Chat Thread
      </button>
    </div>
  ),
}))

import { ProjectThreads } from './ProjectThreads'

describe(`ProjectThreads`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseActiveOrgId.mockReturnValue([`org-1`])
    mockUseActiveProjectId.mockReturnValue([`project-1`])
  })

  it(`should return null when orgId is missing`, () => {
    mockUseActiveOrgId.mockReturnValue([undefined])

    const { container } = render(
      <MemoryRouter>
        <ProjectThreads />
      </MemoryRouter>
    )

    expect(container.innerHTML).toBe(``)
  })

  it(`should return null when projectId is missing`, () => {
    mockUseActiveProjectId.mockReturnValue([undefined])

    const { container } = render(
      <MemoryRouter>
        <ProjectThreads />
      </MemoryRouter>
    )

    expect(container.innerHTML).toBe(``)
  })

  it(`should render ThreadsTab`, () => {
    render(
      <MemoryRouter>
        <ProjectThreads />
      </MemoryRouter>
    )

    expect(screen.getByTestId(`threads-tab`)).toBeTruthy()
  })

  it(`should navigate to thread detail when onViewThread is called`, () => {
    render(
      <MemoryRouter>
        <ProjectThreads />
      </MemoryRouter>
    )

    fireEvent.click(screen.getByTestId(`view-thread-btn`))
    expect(mockNavigate).toHaveBeenCalledWith(
      `/orgs/org-1/projects/project-1/agents/agent-1/threads/thread-xyz`
    )
  })

  it(`should navigate to thread chat when onChatWithThread is called`, () => {
    render(
      <MemoryRouter>
        <ProjectThreads />
      </MemoryRouter>
    )

    fireEvent.click(screen.getByTestId(`chat-thread-btn`))
    expect(mockNavigate).toHaveBeenCalledWith(
      `/orgs/org-1/projects/project-1/agents/agent-1/threads/thread-xyz/chat`
    )
  })
})
