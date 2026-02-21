import { Spinner } from './Spinner'
import { render } from 'ink-testing-library'
import { describe, it, expect } from 'vitest'

describe(`Spinner`, () => {
  it(`renders with a message`, () => {
    const { lastFrame } = render(<Spinner message="Thinking..." />)
    expect(lastFrame()).toContain(`Thinking...`)
  })

  it(`renders with default message when none provided`, () => {
    const { lastFrame } = render(<Spinner />)
    expect(lastFrame()).toBeTruthy()
  })
})
