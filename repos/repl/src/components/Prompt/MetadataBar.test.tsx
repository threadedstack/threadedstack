import { render } from 'ink-testing-library'
import { MetadataBar } from './MetadataBar'
import { describe, it, expect } from 'vitest'

describe(`MetadataBar`, () => {
  it(`renders org and agent names`, () => {
    const { lastFrame } = render(
      <MetadataBar
        orgName="Acme"
        agentName="Helper"
        connection="connected"
      />
    )
    const frame = lastFrame()!
    expect(frame).toContain(`org: Acme`)
    expect(frame).toContain(`agent: Helper`)
  })

  it(`shows "new" when no thread name`, () => {
    const { lastFrame } = render(
      <MetadataBar
        agentName="Bot"
        connection="connected"
      />
    )
    expect(lastFrame()).toContain(`thread: new`)
  })

  it(`shows thread name when provided`, () => {
    const { lastFrame } = render(
      <MetadataBar
        agentName="Bot"
        threadName="thread-123"
        connection="connected"
      />
    )
    expect(lastFrame()).toContain(`thread: thread-123`)
  })

  it(`shows connected status`, () => {
    const { lastFrame } = render(<MetadataBar connection="connected" />)
    expect(lastFrame()).toContain(`connected`)
  })

  it(`shows disconnected status`, () => {
    const { lastFrame } = render(<MetadataBar connection="disconnected" />)
    expect(lastFrame()).toContain(`disconnected`)
  })

  it(`shows project name when provided`, () => {
    const { lastFrame } = render(
      <MetadataBar
        orgName="Acme"
        projectName="My Project"
        agentName="Bot"
        connection="connected"
      />
    )
    expect(lastFrame()).toContain(`project: My Project`)
  })
})
