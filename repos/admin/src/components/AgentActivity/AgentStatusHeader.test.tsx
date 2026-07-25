import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock(`@tdsk/components`, () => ({
  Text: ({ children }: any) => <span>{children}</span>,
  Chip: ({ label }: any) => <span>{label}</span>,
}))

import { AgentStatusHeader } from './AgentStatusHeader'

describe(`AgentStatusHeader`, () => {
  it(`renders a skeleton while status is undefined (not fetched)`, () => {
    render(<AgentStatusHeader status={undefined} />)
    expect(screen.getByTestId(`agent-status-skeleton`)).toBeTruthy()
  })

  it(`renders a never-run message when status is null, not an error`, () => {
    render(<AgentStatusHeader status={null} />)
    expect(screen.getByText(/No activity recorded/i)).toBeTruthy()
  })

  it(`renders live liveness fields`, () => {
    render(
      <AgentStatusHeader
        status={{ agentId: `a`, turnCount: 12, queueDepth: 2, currentActivity: `grooming` }}
      />
    )
    expect(screen.getByText(/grooming/)).toBeTruthy()
    expect(screen.getByText(`12`)).toBeTruthy()
  })

  it(`shows a degraded badge only when the watchdog set the flag`, () => {
    const { rerender } = render(<AgentStatusHeader status={{ agentId: `a` }} />)
    expect(screen.queryByTestId(`agent-degraded`)).toBeNull()

    rerender(<AgentStatusHeader status={{ agentId: `a`, degraded: true }} />)
    expect(screen.getByTestId(`agent-degraded`)).toBeTruthy()
  })
})
