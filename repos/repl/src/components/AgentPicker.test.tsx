import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { render } from 'ink-testing-library'
import { AgentPicker } from './AgentPicker'

describe('AgentPicker', () => {
  const agents = [
    { id: 'a1', name: 'Research Assistant', description: 'Finds information' },
    { id: 'a2', name: 'Code Helper', description: 'Helps with code' },
  ]

  it('renders agent list', () => {
    const { lastFrame } = render(
      <AgentPicker
        agents={agents}
        onSelect={() => {}}
      />
    )
    const frame = lastFrame()!
    expect(frame).toContain('Research Assistant')
    expect(frame).toContain('Code Helper')
  })

  it('auto-selects when only one agent', () => {
    const onSelect = vi.fn()
    render(
      <AgentPicker
        agents={[agents[0]]}
        onSelect={onSelect}
      />
    )
    expect(onSelect).toHaveBeenCalledWith(agents[0])
  })
})
