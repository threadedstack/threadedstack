import { render } from 'ink-testing-library'
import { describe, it, expect } from 'vitest'
import { AssistantMessage } from '@TRL/components/Message/Assistant'

describe(`AssistantMessage`, () => {
  it(`renders markdown content`, () => {
    const { lastFrame } = render(<AssistantMessage text="Hello **world**" />)
    expect(lastFrame()).toContain(`world`)
  })

  it(`renders plain text when markdown is disabled`, () => {
    const { lastFrame } = render(
      <AssistantMessage
        text="Hello world"
        markdown={false}
      />
    )
    expect(lastFrame()).toContain(`Hello world`)
  })
})
