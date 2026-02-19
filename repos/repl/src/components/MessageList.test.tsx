import { describe, it, expect } from 'vitest'
import React from 'react'
import { render } from 'ink-testing-library'
import { MessageList } from './MessageList'

describe('MessageList', () => {
  it('renders empty state without errors', () => {
    const { lastFrame } = render(<MessageList messages={[]} />)
    expect(lastFrame()).toBeDefined()
  })

  it('renders user and assistant messages', () => {
    const messages = [
      { type: 'user', content: 'Hello' },
      { type: 'assistant', content: 'Hi there!' },
    ]
    const { lastFrame } = render(<MessageList messages={messages} />)
    const frame = lastFrame()!
    expect(frame).toContain('Hello')
    expect(frame).toContain('Hi there')
  })
})
