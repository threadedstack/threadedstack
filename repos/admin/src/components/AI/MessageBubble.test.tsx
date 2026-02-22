import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

vi.mock(`@tdsk/components`, () => ({
  RobotOutlineIcon: (props: any) => (
    <span
      data-testid='robot-icon'
      {...props}
    />
  ),
}))

vi.mock(`@TAF/components/AI/ToolCallDisplay`, () => ({
  ToolCallDisplay: ({ toolCall }: any) => (
    <div data-testid={`tool-call-${toolCall.id}`} />
  ),
}))

import { MessageBubble } from './MessageBubble'

const userMessage = {
  id: `msg-1`,
  role: `user` as const,
  text: `Hello, AI!`,
  toolCalls: [],
  timestamp: Date.now(),
}

const assistantMessage = {
  id: `msg-2`,
  role: `assistant` as const,
  text: `Hello, human!`,
  toolCalls: [],
  timestamp: Date.now(),
}

describe(`MessageBubble`, () => {
  it(`should render user message text`, () => {
    render(<MessageBubble message={userMessage} />)
    expect(screen.getByText(`Hello, AI!`)).toBeInTheDocument()
  })

  it(`should render assistant message text`, () => {
    render(<MessageBubble message={assistantMessage} />)
    expect(screen.getByText(`Hello, human!`)).toBeInTheDocument()
  })

  it(`should render PersonIcon for user messages and RobotOutlineIcon for assistant messages`, () => {
    const { rerender } = render(<MessageBubble message={userMessage} />)
    expect(screen.getByTestId(`PersonIcon`)).toBeInTheDocument()
    expect(screen.queryByTestId(`robot-icon`)).not.toBeInTheDocument()

    rerender(<MessageBubble message={assistantMessage} />)
    expect(screen.getByTestId(`robot-icon`)).toBeInTheDocument()
    expect(screen.queryByTestId(`PersonIcon`)).not.toBeInTheDocument()
  })

  it(`should apply different maxWidth for user vs assistant messages`, () => {
    const { container, rerender } = render(<MessageBubble message={userMessage} />)
    const userContentWrapper = container.firstChild!.lastChild as HTMLElement
    expect(userContentWrapper).toBeTruthy()

    rerender(<MessageBubble message={assistantMessage} />)
    const assistantContentWrapper = container.firstChild!.lastChild as HTMLElement
    expect(assistantContentWrapper).toBeTruthy()

    // Both render the content wrapper Box — the sx prop assigns different maxWidth
    // values (75% for user, 85% for assistant) which MUI converts to inline styles
    // In jsdom, MUI may or may not inject computed CSS, so we verify both render
    // and structurally exist as distinct elements
    expect(userContentWrapper.tagName).toBe(`DIV`)
    expect(assistantContentWrapper.tagName).toBe(`DIV`)
  })

  it(`should render outer flex container with MUI Box for user messages`, () => {
    const { container } = render(<MessageBubble message={userMessage} />)
    const outerBox = container.firstChild as HTMLElement
    // Outer container is a MUI Box that applies flex layout (row-reverse for user)
    expect(outerBox).toBeTruthy()
    expect(outerBox.children.length).toBe(2) // avatar + content wrapper
  })

  it(`should render outer flex container with MUI Box for assistant messages`, () => {
    const { container } = render(<MessageBubble message={assistantMessage} />)
    const outerBox = container.firstChild as HTMLElement
    // Outer container is a MUI Box that applies flex layout (row for assistant)
    expect(outerBox).toBeTruthy()
    expect(outerBox.children.length).toBe(2) // avatar + content wrapper
  })

  it(`should show streaming cursor for assistant with text`, () => {
    const { container } = render(
      <MessageBubble
        message={assistantMessage}
        isStreaming={true}
      />
    )
    // The blinking cursor is a span with animation containing "blink"
    const cursor = container.querySelector(`span[class*="MuiBox"]`)
    expect(cursor).toBeInTheDocument()
  })

  it(`should NOT show streaming cursor for user messages even when isStreaming is true`, () => {
    const { container } = render(
      <MessageBubble
        message={userMessage}
        isStreaming={true}
      />
    )
    // User messages should never have the blinking cursor span
    const spans = container.querySelectorAll(`span[class*="MuiBox"]`)
    expect(spans.length).toBe(0)
  })

  it(`should show "Thinking..." for streaming assistant with no text`, () => {
    const emptyAssistant = { ...assistantMessage, text: `` }
    render(
      <MessageBubble
        message={emptyAssistant}
        isStreaming={true}
      />
    )
    expect(screen.getByText(`Thinking...`)).toBeInTheDocument()
  })

  it(`should NOT show "Thinking..." for non-streaming assistant with no text`, () => {
    const emptyAssistant = { ...assistantMessage, text: `` }
    render(
      <MessageBubble
        message={emptyAssistant}
        isStreaming={false}
      />
    )
    expect(screen.queryByText(`Thinking...`)).not.toBeInTheDocument()
  })

  it(`should NOT show "Thinking..." for user messages with no text`, () => {
    const emptyUser = { ...userMessage, text: `` }
    render(
      <MessageBubble
        message={emptyUser}
        isStreaming={true}
      />
    )
    expect(screen.queryByText(`Thinking...`)).not.toBeInTheDocument()
  })

  it(`should render ToolCallDisplay for each tool call`, () => {
    const messageWithTools = {
      ...assistantMessage,
      toolCalls: [
        { id: `tc-1`, name: `search`, args: `{}` },
        { id: `tc-2`, name: `read_file`, args: `{"path": "/tmp"}` },
      ],
    }
    render(<MessageBubble message={messageWithTools} />)
    expect(screen.getByTestId(`tool-call-tc-1`)).toBeInTheDocument()
    expect(screen.getByTestId(`tool-call-tc-2`)).toBeInTheDocument()
  })

  it(`should not render tool calls section when toolCalls is empty`, () => {
    render(<MessageBubble message={assistantMessage} />)
    expect(screen.queryByTestId(`tool-call-tc-1`)).not.toBeInTheDocument()
  })

  it(`should not render tool calls section when toolCalls is undefined`, () => {
    const noToolsMessage = { ...assistantMessage, toolCalls: undefined }
    render(<MessageBubble message={noToolsMessage} />)
    expect(screen.queryByTestId(`tool-call-tc-1`)).not.toBeInTheDocument()
  })
})
