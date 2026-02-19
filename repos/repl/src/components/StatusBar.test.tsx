import { describe, it, expect } from 'vitest'
import React from 'react'
import { render } from 'ink-testing-library'
import { StatusBar } from './StatusBar'

describe('StatusBar', () => {
  it('renders agent name', () => {
    const { lastFrame } = render(
      <StatusBar
        agentName="Helper"
        connection="connected"
      />
    )
    expect(lastFrame()).toContain('Helper')
  })

  it('renders provider info', () => {
    const { lastFrame } = render(
      <StatusBar
        agentName="Helper"
        providerName="Anthropic"
        modelName="sonnet"
        connection="connected"
      />
    )
    expect(lastFrame()).toContain('Anthropic')
  })

  it('renders green indicator when connected', () => {
    const { lastFrame } = render(
      <StatusBar
        agentName="Helper"
        connection="connected"
      />
    )
    expect(lastFrame()).toContain('●')
  })

  it('renders thread name', () => {
    const { lastFrame } = render(
      <StatusBar
        agentName="Helper"
        threadName="My Thread"
        connection="connected"
      />
    )
    expect(lastFrame()).toContain('My Thread')
  })
})
