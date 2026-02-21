import { render } from 'ink-testing-library'
import { describe, it, expect } from 'vitest'
import { Streaming } from './Streaming'

describe(`Streaming`, () => {
  it(`shows spinner when no text has arrived`, () => {
    const { lastFrame } = render(
      <Streaming
        text=""
        toolCalls={[]}
        isStreaming
      />
    )
    expect(lastFrame()).toBeTruthy()
  })

  it(`renders text as it arrives`, () => {
    const { lastFrame } = render(
      <Streaming
        text="Hello world"
        toolCalls={[]}
        isStreaming
      />
    )
    expect(lastFrame()).toContain(`Hello world`)
  })

  it(`shows tool activity inline`, () => {
    const { lastFrame } = render(
      <Streaming
        text=""
        toolCalls={[
          { name: `readFile`, args: ``, status: `running`, summary: `Reading file...` },
        ]}
        isStreaming
      />
    )
    expect(lastFrame()).toContain(`Reading file`)
  })
})
