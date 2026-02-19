import { describe, it, expect } from 'vitest'
import React from 'react'
import { render } from 'ink-testing-library'
import { UserMessage } from './UserMessage'

describe('UserMessage', () => {
  it('renders user text with dimmed style', () => {
    const { lastFrame } = render(<UserMessage text="Hello agent" />)
    expect(lastFrame()).toContain('Hello agent')
  })
})
