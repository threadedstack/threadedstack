import { describe, it, expect } from 'vitest'
import React from 'react'
import { render } from 'ink-testing-library'
import { Spinner } from './Spinner'

describe('Spinner', () => {
  it('renders with a message', () => {
    const { lastFrame } = render(<Spinner message="Thinking..." />)
    expect(lastFrame()).toContain('Thinking...')
  })

  it('renders with default message when none provided', () => {
    const { lastFrame } = render(<Spinner />)
    expect(lastFrame()).toBeTruthy()
  })
})
