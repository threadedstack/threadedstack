import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'

const mockUseActiveOrgId = vi.fn(() => [`org-1`])
const mockUseActiveProjectId = vi.fn(() => [`project-1`])

vi.mock(`@TAF/state/selectors`, () => ({
  // @ts-ignore
  useActiveOrgId: (...args: any[]) => mockUseActiveOrgId(...args),
  // @ts-ignore
  useActiveProjectId: (...args: any[]) => mockUseActiveProjectId(...args),
}))

vi.mock(`@TAF/pages/Page/Page`, () => ({
  Page: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock(`@TAF/components/Collections/Collections`, () => ({
  Collections: () => <div data-testid='collections-list' />,
}))

import { ProjectCollections } from './ProjectCollections'

describe(`ProjectCollections`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUseActiveOrgId.mockReturnValue([`org-1`])
    mockUseActiveProjectId.mockReturnValue([`project-1`])
  })

  it(`should return null when orgId is missing`, () => {
    mockUseActiveOrgId.mockReturnValue([undefined])

    const { container } = render(
      <MemoryRouter>
        <ProjectCollections />
      </MemoryRouter>
    )

    expect(container.innerHTML).toBe(``)
  })

  it(`should return null when projectId is missing`, () => {
    mockUseActiveProjectId.mockReturnValue([undefined])

    const { container } = render(
      <MemoryRouter>
        <ProjectCollections />
      </MemoryRouter>
    )

    expect(container.innerHTML).toBe(``)
  })

  it(`should render Collections when org and project are set`, () => {
    render(
      <MemoryRouter>
        <ProjectCollections />
      </MemoryRouter>
    )

    expect(screen.getByTestId(`collections-list`)).toBeTruthy()
  })
})
