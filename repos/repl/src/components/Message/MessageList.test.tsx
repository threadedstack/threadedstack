import { describe, it, expect } from 'vitest'
import { render } from 'ink-testing-library'
import { MessageList } from '@TRL/components/Message/MessageList'

describe(`MessageList`, () => {
  it(`renders empty state without errors`, () => {
    const { lastFrame } = render(<MessageList messages={[]} />)
    expect(lastFrame()).toBeDefined()
  })

  it(`renders user and assistant messages`, () => {
    const messages = [
      { id: `msg-1`, type: `user`, content: `Hello` },
      { id: `msg-2`, type: `assistant`, content: `Hi there!` },
    ]
    const { lastFrame } = render(<MessageList messages={messages} />)
    const frame = lastFrame()!
    expect(frame).toContain(`Hello`)
    expect(frame).toContain(`Hi there`)
  })
})
