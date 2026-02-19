import { describe, it, expect } from 'vitest'
import React from 'react'
import { render } from 'ink-testing-library'
import { AssistantMessage } from './AssistantMessage'

describe('AssistantMessage', () => {
  it('renders markdown content', () => {
    const { lastFrame } = render(<AssistantMessage text="Hello **world**" />)
    expect(lastFrame()).toContain('world')
  })

  it('renders plain text when markdown is disabled', () => {
    const { lastFrame } = render(
      <AssistantMessage
        text="Hello world"
        markdown={false}
      />
    )
    expect(lastFrame()).toContain('Hello world')
  })
})
