import { describe, it, expect } from 'vitest'
import React from 'react'
import { render } from 'ink-testing-library'
import { StreamingResponse } from './StreamingResponse'

describe('StreamingResponse', () => {
  it('shows spinner when no text has arrived', () => {
    const { lastFrame } = render(
      <StreamingResponse
        text=""
        toolCalls={[]}
        isStreaming
      />
    )
    expect(lastFrame()).toBeTruthy()
  })

  it('renders text as it arrives', () => {
    const { lastFrame } = render(
      <StreamingResponse
        text="Hello world"
        toolCalls={[]}
        isStreaming
      />
    )
    expect(lastFrame()).toContain('Hello world')
  })

  it('shows tool activity inline', () => {
    const { lastFrame } = render(
      <StreamingResponse
        text=""
        toolCalls={[
          { name: 'readFile', args: '', status: 'running', summary: 'Reading file...' },
        ]}
        isStreaming
      />
    )
    expect(lastFrame()).toContain('Reading file')
  })
})
