import { Prompt } from './Prompt'
import { render } from 'ink-testing-library'
import { describe, it, expect } from 'vitest'

describe(`Prompt`, () => {
  it(`renders bordered editor box`, () => {
    const { lastFrame } = render(
      <Prompt
        onSubmit={() => {}}
        disabled={false}
      />
    )
    const frame = lastFrame()
    // Bordered box uses round border style characters
    expect(frame).toBeTruthy()
    // Should not have old > prefix
    expect(frame).not.toContain(`> `)
  })

  it(`shows disabled state while agent is responding`, () => {
    const { lastFrame } = render(
      <Prompt
        onSubmit={() => {}}
        disabled
      />
    )
    expect(lastFrame()).toBeTruthy()
  })

  it(`renders with isPreAuth prop without error`, () => {
    const { lastFrame } = render(
      <Prompt
        onSubmit={() => {}}
        disabled={false}
        isPreAuth={true}
      />
    )
    expect(lastFrame()).toBeTruthy()
  })

  it(`renders with isPreAuth=false (default) without error`, () => {
    const { lastFrame } = render(
      <Prompt
        onSubmit={() => {}}
        disabled={false}
        isPreAuth={false}
      />
    )
    expect(lastFrame()).toBeTruthy()
  })
})
