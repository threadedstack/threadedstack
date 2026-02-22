import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router'

const mockSetActiveThreadId = vi.fn()
let mockSearchParams = new URLSearchParams()
const mockSetSearchParams = vi.fn()

const mockUseActiveOrgId = vi.fn(() => [`org-1`])
const mockUseActiveProjectId = vi.fn(() => [`project-1`])
const mockUseActiveThreadId = vi.fn(() => [``, mockSetActiveThreadId])

vi.mock(`@TAF/state/selectors`, () => ({
  // @ts-ignore
  useActiveOrgId: (...args: any[]) => mockUseActiveOrgId(...args),
  // @ts-ignore
  useActiveProjectId: (...args: any[]) => mockUseActiveProjectId(...args),
  // @ts-ignore
  useActiveThreadId: (...args: any[]) => mockUseActiveThreadId(...args),
}))

vi.mock(`react-router`, async () => {
  const actual = await vi.importActual(`react-router`)
  return {
    ...actual,
    useSearchParams: vi.fn(() => [mockSearchParams, mockSetSearchParams]),
  }
})

vi.mock(`@TAF/pages/Page/Page`, () => ({
  Page: ({ children, className }: any) => <div className={className}>{children}</div>,
}))

vi.mock(`@TAF/components/AI/ThreadsTab`, () => ({
  ThreadsTab: ({ onViewThread }: any) => (
    <div data-testid='threads-tab'>
      <button
        data-testid='view-thread-btn'
        onClick={() => onViewThread(`thread-xyz`)}
      >
        View Thread
      </button>
    </div>
  ),
}))

vi.mock(`@TAF/components/AI/MessagesTab`, () => ({
  MessagesTab: () => <div data-testid='messages-tab'>Messages</div>,
}))

vi.mock(`@keg-hub/jsutils/capitalize`, () => ({
  capitalize: (s: string) => s.charAt(0).toUpperCase() + s.slice(1),
}))

import { ProjectThreads } from './ProjectThreads'

describe(`ProjectThreads`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSearchParams = new URLSearchParams()
    mockUseActiveOrgId.mockReturnValue([`org-1`])
    mockUseActiveProjectId.mockReturnValue([`project-1`])
    mockUseActiveThreadId.mockReturnValue([``, mockSetActiveThreadId])
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

  it(`should show threads tab by default`, () => {
    render(
      <MemoryRouter>
        <ProjectThreads />
      </MemoryRouter>
    )

    expect(screen.getByTestId(`threads-tab`)).toBeTruthy()
    expect(screen.queryByTestId(`messages-tab`)).toBeNull()
  })

  it(`should set active thread and show messages tab when URL params are present`, () => {
    mockSearchParams = new URLSearchParams(`thread=abc&tab=messages`)

    render(
      <MemoryRouter>
        <ProjectThreads />
      </MemoryRouter>
    )

    expect(mockSetActiveThreadId).toHaveBeenCalledWith(`abc`)
    expect(screen.getByTestId(`messages-tab`)).toBeTruthy()
    expect(screen.queryByTestId(`threads-tab`)).toBeNull()
  })

  it(`should call setActiveThreadId and setSearchParams when onViewThread is triggered`, () => {
    render(
      <MemoryRouter>
        <ProjectThreads />
      </MemoryRouter>
    )

    const viewBtn = screen.getByTestId(`view-thread-btn`)
    fireEvent.click(viewBtn)

    expect(mockSetActiveThreadId).toHaveBeenCalledWith(`thread-xyz`)
    expect(mockSetSearchParams).toHaveBeenCalledWith({
      thread: `thread-xyz`,
      tab: `messages`,
    })
  })

  it(`should clear search params when switching to threads tab`, () => {
    mockSearchParams = new URLSearchParams(`tab=messages`)

    render(
      <MemoryRouter>
        <ProjectThreads />
      </MemoryRouter>
    )

    const threadsTab = screen.getByRole(`tab`, { name: `Threads` })
    fireEvent.click(threadsTab)

    expect(mockSetSearchParams).toHaveBeenCalledWith({})
  })

  it(`should render only Threads and Messages tabs, not Assets`, () => {
    render(
      <MemoryRouter>
        <ProjectThreads />
      </MemoryRouter>
    )

    expect(screen.getByRole(`tab`, { name: `Threads` })).toBeTruthy()
    expect(screen.getByRole(`tab`, { name: `Messages` })).toBeTruthy()
    expect(screen.queryByRole(`tab`, { name: `Assets` })).toBeNull()
  })

  it(`should render page heading text`, () => {
    render(
      <MemoryRouter>
        <ProjectThreads />
      </MemoryRouter>
    )

    expect(screen.getByText(`AI Threads`)).toBeTruthy()
  })

  it(`should default to threads tab when tab param is invalid`, () => {
    mockSearchParams = new URLSearchParams(`tab=invalid`)

    render(
      <MemoryRouter>
        <ProjectThreads />
      </MemoryRouter>
    )

    expect(screen.getByTestId(`threads-tab`)).toBeTruthy()
    expect(screen.queryByTestId(`messages-tab`)).toBeNull()
  })
})
