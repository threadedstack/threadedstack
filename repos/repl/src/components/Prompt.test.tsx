import { describe, it, expect } from 'vitest'
import React from 'react'
import { render } from 'ink-testing-library'
import { Prompt } from './Prompt'

describe('Prompt', () => {
  it('renders prompt indicator', () => {
    const { lastFrame } = render(
      <Prompt
        onSubmit={() => {}}
        disabled={false}
      />
    )
    expect(lastFrame()).toContain('>')
  })

  it('shows disabled state while agent is responding', () => {
    const { lastFrame } = render(
      <Prompt
        onSubmit={() => {}}
        disabled
      />
    )
    expect(lastFrame()).toBeTruthy()
  })
})
