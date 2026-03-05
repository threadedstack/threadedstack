import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
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

  it(`should render PersonIcon for user messages`, () => {
    render(<MessageBubble message={userMessage} />)
    expect(screen.getByTestId(`PersonIcon`)).toBeInTheDocument()
  })

  it(`should render robot icon for assistant messages`, () => {
    const { container } = render(<MessageBubble message={assistantMessage} />)
    // RobotOutlineIcon renders an SVG element
    const svg = container.querySelector(`svg`)
    expect(svg).toBeInTheDocument()
    expect(screen.queryByTestId(`PersonIcon`)).not.toBeInTheDocument()
  })

  it(`should apply different maxWidth for user vs assistant messages`, () => {
    const { container, rerender } = render(<MessageBubble message={userMessage} />)
    const userContentWrapper = container.firstChild!.lastChild as HTMLElement
    expect(userContentWrapper).toBeTruthy()

    rerender(<MessageBubble message={assistantMessage} />)
    const assistantContentWrapper = container.firstChild!.lastChild as HTMLElement
    expect(assistantContentWrapper).toBeTruthy()

    expect(userContentWrapper.tagName).toBe(`DIV`)
    expect(assistantContentWrapper.tagName).toBe(`DIV`)
  })

  it(`should render outer flex container with MUI Box for user messages`, () => {
    const { container } = render(<MessageBubble message={userMessage} />)
    const outerBox = container.firstChild as HTMLElement
    expect(outerBox).toBeTruthy()
    expect(outerBox.children.length).toBe(2)
  })

  it(`should render outer flex container with MUI Box for assistant messages`, () => {
    const { container } = render(<MessageBubble message={assistantMessage} />)
    const outerBox = container.firstChild as HTMLElement
    expect(outerBox).toBeTruthy()
    expect(outerBox.children.length).toBe(2)
  })

  it(`should show streaming cursor for assistant with text`, () => {
    const { container } = render(
      <MessageBubble
        message={assistantMessage}
        isStreaming={true}
      />
    )
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
    // Real ToolCallDisplay renders tool names as Chip labels
    expect(screen.getByText(`search`)).toBeInTheDocument()
    expect(screen.getByText(`read_file`)).toBeInTheDocument()
  })

  it(`should not render tool calls section when toolCalls is empty`, () => {
    render(<MessageBubble message={assistantMessage} />)
    expect(screen.queryByText(`search`)).not.toBeInTheDocument()
  })

  it(`should not render tool calls section when toolCalls is undefined`, () => {
    const noToolsMessage = { ...assistantMessage, toolCalls: undefined }
    render(<MessageBubble message={noToolsMessage} />)
    expect(screen.queryByText(`search`)).not.toBeInTheDocument()
  })
})
