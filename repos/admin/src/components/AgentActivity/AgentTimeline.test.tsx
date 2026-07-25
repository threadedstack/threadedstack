import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock(`@tdsk/components`, () => ({
  Text: ({ children }: any) => <span>{children}</span>,
  Chip: ({ label }: any) => <span>{label}</span>,
}))

import { AgentTimeline } from './AgentTimeline'

const entries = [
  { id: `m1`, kind: `message` as const, at: `2026-07-24T12:00:00Z`, title: `hi`, body: `hello` },
  { id: `t1`, kind: `turn` as const, at: `2026-07-24T10:00:00Z`, title: `agenda:groom`, summary: `did the thing` },
]

describe(`AgentTimeline`, () => {
  it(`renders a skeleton while loading (nothing fetched yet)`, () => {
    render(<AgentTimeline entries={[]} loading />)
    expect(screen.getByTestId(`agent-timeline-skeleton`)).toBeTruthy()
  })

  it(`renders an empty state when fetched but empty`, () => {
    render(<AgentTimeline entries={[]} loading={false} />)
    expect(screen.getByText(/No activity yet/i)).toBeTruthy()
  })

  it(`renders every entry newest first with its preview`, () => {
    render(<AgentTimeline entries={entries} loading={false} />)
    expect(screen.getByText(`hi`)).toBeTruthy()
    expect(screen.getByText(`agenda:groom`)).toBeTruthy()
    expect(screen.getByText(`did the thing`)).toBeTruthy()
  })

  it(`expands an entry body on click`, () => {
    render(<AgentTimeline entries={entries} loading={false} />)
    expect(screen.queryByText(`hello`)).toBeNull()
    fireEvent.click(screen.getByTestId(`timeline-entry-m1`))
    expect(screen.getByText(`hello`)).toBeTruthy()
  })
})
