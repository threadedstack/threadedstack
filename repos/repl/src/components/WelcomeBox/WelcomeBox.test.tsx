import { WelcomeBox } from './WelcomeBox'
import { render } from 'ink-testing-library'
import { describe, it, expect } from 'vitest'

describe(`WelcomeBox`, () => {
  it(`renders agent name`, () => {
    const { lastFrame } = render(<WelcomeBox agentName="Research Assistant" />)
    expect(lastFrame()).toContain(`Research Assistant`)
  })

  it(`renders description when provided`, () => {
    const { lastFrame } = render(
      <WelcomeBox
        agentName="Helper"
        agentDescription="Helps with tasks"
      />
    )
    expect(lastFrame()).toContain(`Helps with tasks`)
  })

  it(`renders provider info`, () => {
    const { lastFrame } = render(
      <WelcomeBox
        agentName="Agent"
        providerName="Anthropic"
        modelName="claude-sonnet"
      />
    )
    expect(lastFrame()).toContain(`Anthropic`)
  })

  it(`renders thread name when resuming`, () => {
    const { lastFrame } = render(
      <WelcomeBox
        agentName="Agent"
        threadName="Q4 Discussion"
      />
    )
    expect(lastFrame()).toContain(`Q4 Discussion`)
  })

  it(`renders context file count`, () => {
    const { lastFrame } = render(
      <WelcomeBox
        agentName="Agent"
        contextFileCount={3}
      />
    )
    expect(lastFrame()).toContain(`3`)
  })
})
