import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock(`@tdsk/components`, () => ({
  Text: ({ children, onClick }: any) => <span onClick={onClick}>{children}</span>,
  Chip: ({ label }: any) => <span>{label}</span>,
}))

import { AgentRoadmap } from './AgentRoadmap'

describe(`AgentRoadmap`, () => {
  it(`renders a skeleton while plans are undefined`, () => {
    render(<AgentRoadmap plans={undefined} />)
    expect(screen.getByTestId(`agent-roadmap-skeleton`)).toBeTruthy()
  })

  it(`renders an empty state when fetched but empty`, () => {
    render(<AgentRoadmap plans={[]} />)
    expect(screen.getByText(/No roadmap yet/i)).toBeTruthy()
  })

  it(`renders a plan and reveals milestones on toggle`, () => {
    render(
      <AgentRoadmap
        plans={[
          {
            id: `p1`,
            kind: `initiative`,
            status: `active`,
            title: `Engineering Roadmap`,
            objective: `Ship the visibility surface`,
            milestones: [{ title: `Activity page`, status: `done` }],
          },
        ]}
      />
    )
    expect(screen.getByText(`Engineering Roadmap`)).toBeTruthy()
    expect(screen.getByText(`Ship the visibility surface`)).toBeTruthy()
    // Milestones live behind the details toggle.
    expect(screen.queryByText(`Activity page`)).toBeNull()
    fireEvent.click(screen.getByText(/Show milestones/i))
    expect(screen.getByText(`Activity page`)).toBeTruthy()
  })

  it(`sorts active plans ahead of the rest`, () => {
    render(
      <AgentRoadmap
        plans={[
          { id: `done`, status: `done`, title: `Finished plan` },
          { id: `active`, status: `active`, title: `Current plan` },
        ]}
      />
    )
    const titles = screen.getAllByText(/plan$/).map((n) => n.textContent)
    expect(titles.indexOf(`Current plan`)).toBeLessThan(titles.indexOf(`Finished plan`))
  })
})
