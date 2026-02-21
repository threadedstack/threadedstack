import { UserMessage } from './User'
import { describe, it, expect } from 'vitest'
import { render } from 'ink-testing-library'

describe(`UserMessage`, () => {
  it(`renders user text with dimmed style`, () => {
    const { lastFrame } = render(<UserMessage text="Hello agent" />)
    expect(lastFrame()).toContain(`Hello agent`)
  })
})
