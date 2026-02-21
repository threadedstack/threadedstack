import { StatusBar } from './StatusBar'
import { render } from 'ink-testing-library'
import { describe, it, expect } from 'vitest'

describe(`StatusBar`, () => {
  it(`renders agent name`, () => {
    const { lastFrame } = render(
      <StatusBar
        agentName="Helper"
        connection="connected"
      />
    )
    expect(lastFrame()).toContain(`Helper`)
  })

  it(`renders provider info`, () => {
    const { lastFrame } = render(
      <StatusBar
        agentName="Helper"
        modelName="sonnet"
        connection="connected"
        providerName="Anthropic"
      />
    )
    expect(lastFrame()).toContain(`Anthropic`)
  })

  it(`renders green indicator when connected`, () => {
    const { lastFrame } = render(
      <StatusBar
        agentName="Helper"
        connection="connected"
      />
    )
    expect(lastFrame()).toContain(`●`)
  })

  it(`renders thread name`, () => {
    const { lastFrame } = render(
      <StatusBar
        agentName="Helper"
        threadName="My Thread"
        connection="connected"
      />
    )
    expect(lastFrame()).toContain(`My Thread`)
  })
})
