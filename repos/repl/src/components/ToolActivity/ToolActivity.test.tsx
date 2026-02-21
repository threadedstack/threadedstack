import { render } from 'ink-testing-library'
import { ToolActivity } from './ToolActivity'
import { describe, it, expect } from 'vitest'

describe(`ToolActivity`, () => {
  it(`renders completed tool with checkmark`, () => {
    const { lastFrame } = render(
      <ToolActivity
        tools={[
          {
            name: `readFile`,
            args: `/test.txt`,
            status: `success`,
            summary: `Read file: /test.txt`,
          },
        ]}
      />
    )
    const frame = lastFrame()!
    expect(frame).toContain(`✓`)
    expect(frame).toContain(`Read file`)
  })

  it(`renders failed tool with X`, () => {
    const { lastFrame } = render(
      <ToolActivity
        tools={[
          {
            name: `shellExec`,
            args: `rm -rf`,
            status: `error`,
            summary: `Command failed`,
          },
        ]}
      />
    )
    const frame = lastFrame()!
    expect(frame).toContain(`✗`)
  })

  it(`renders running tool with spinner text`, () => {
    const { lastFrame } = render(
      <ToolActivity
        tools={[
          {
            name: `webSearch`,
            args: `query`,
            status: `running`,
            summary: `Searching...`,
          },
        ]}
      />
    )
    expect(lastFrame()).toContain(`Searching`)
  })

  it(`renders verbose details when verbose is true`, () => {
    const { lastFrame } = render(
      <ToolActivity
        verbose
        tools={[
          {
            name: `readFile`,
            args: `{"path":"/test.txt"}`,
            status: `success`,
            summary: `Read file`,
            result: `file contents here`,
          },
        ]}
      />
    )
    const frame = lastFrame()!
    expect(frame).toContain(`file contents here`)
  })
})
