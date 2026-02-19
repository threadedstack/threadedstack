import { describe, it, expect } from 'vitest'
import React from 'react'
import { render } from 'ink-testing-library'
import { ChatSession } from './ChatSession'

describe(`ChatSession`, () => {
  it(`should render status bar, message list, and prompt`, () => {
    const { lastFrame } = render(
      <ChatSession
        agentName="Test Agent"
        connection="connected"
        messages={[]}
        isStreaming={false}
        streamText=""
        toolCalls={[]}
        onSubmit={() => {}}
      />
    )
    const frame = lastFrame()!
    expect(frame).toContain(`Test Agent`)
    expect(frame).toContain(`>`)
  })

  it(`should render messages when provided`, () => {
    const { lastFrame } = render(
      <ChatSession
        agentName="Bot"
        connection="connected"
        messages={[
          { type: `user`, content: `Hello` },
          { type: `assistant`, content: `Hi there` },
        ]}
        isStreaming={false}
        streamText=""
        toolCalls={[]}
        onSubmit={() => {}}
      />
    )
    const frame = lastFrame()!
    expect(frame).toContain(`Hello`)
    expect(frame).toContain(`Hi there`)
  })

  it(`should show streaming response when streaming`, () => {
    const { lastFrame } = render(
      <ChatSession
        agentName="Bot"
        connection="connected"
        messages={[]}
        isStreaming={true}
        streamText="Thinking about..."
        toolCalls={[]}
        onSubmit={() => {}}
      />
    )
    const frame = lastFrame()!
    expect(frame).toContain(`Thinking about...`)
  })

  it(`should pass connection status to StatusBar`, () => {
    const { lastFrame } = render(
      <ChatSession
        agentName="Bot"
        connection="disconnected"
        messages={[]}
        isStreaming={false}
        streamText=""
        toolCalls={[]}
        onSubmit={() => {}}
      />
    )
    const frame = lastFrame()!
    // The status bar renders a colored dot for connection status
    expect(frame).toContain(`Bot`)
  })
})
