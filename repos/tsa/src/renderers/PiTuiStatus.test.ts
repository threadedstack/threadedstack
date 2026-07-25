import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock(`chalk`, () => ({
  default: {
    green: (text: string) => `GREEN(${text})`,
    yellow: (text: string) => `YELLOW(${text})`,
    red: (text: string) => `RED(${text})`,
  },
}))

vi.mock(`@TSA/theme`, () => ({
  themed: (_color: string, text: string) => text,
}))

import { PiTuiStatus } from './PiTuiStatus'

describe(`PiTuiStatus`, () => {
  let status: PiTuiStatus

  beforeEach(() => {
    vi.clearAllMocks()
    status = new PiTuiStatus()
  })

  describe(`connection dot`, () => {
    it(`renders the green dot for 'connected'`, () => {
      status.setStatus({ connection: `connected` })
      const [, line] = status.render(80)
      expect(line).toContain(`GREEN(●)`)
    })

    it(`renders the yellow dot for 'reconnecting'`, () => {
      status.setStatus({ connection: `reconnecting` })
      const [, line] = status.render(80)
      expect(line).toContain(`YELLOW(●)`)
    })

    it(`renders the red dot for 'disconnected'`, () => {
      status.setStatus({ connection: `disconnected` })
      const [, line] = status.render(80)
      expect(line).toContain(`RED(●)`)
    })

    it(`falls back to the disconnected (red) dot for an unrecognized connection value`, () => {
      status.setStatus({ connection: `bogus-status` as any })
      const [, line] = status.render(80)
      expect(line).toContain(`RED(●)`)
    })
  })

  describe(`agentName`, () => {
    it(`is included when truthy`, () => {
      status.setStatus({ connection: `connected`, agentName: `my-agent` })
      const [, line] = status.render(80)
      expect(line).toContain(`my-agent`)
    })

    it(`is omitted when absent`, () => {
      status.setStatus({ connection: `connected` })
      const [, line] = status.render(80)
      expect(line).not.toContain(`undefined`)
      expect(line.trim()).toBe(`GREEN(●)`)
    })
  })

  describe(`threadId`, () => {
    it(`is shown as-is when <= 12 chars`, () => {
      status.setStatus({ connection: `connected`, threadId: `short-id` })
      const [, line] = status.render(80)
      expect(line).toContain(`thread:short-id`)
      expect(line).not.toContain(`...`)
    })

    it(`is truncated to 12 chars with a trailing ellipsis when longer than 12 chars`, () => {
      const longId = `thread-id-that-is-quite-long`
      status.setStatus({ connection: `connected`, threadId: longId })
      const [, line] = status.render(80)
      expect(line).toContain(`thread:${longId.slice(0, 12)}...`)
      expect(line).not.toContain(longId)
    })

    it(`is omitted when absent`, () => {
      status.setStatus({ connection: `connected` })
      const [, line] = status.render(80)
      expect(line).not.toContain(`thread:`)
    })
  })

  describe(`modelName / providerName`, () => {
    it(`includes modelName when truthy`, () => {
      status.setStatus({ connection: `connected`, modelName: `claude-sonnet-5` })
      const [, line] = status.render(80)
      expect(line).toContain(`claude-sonnet-5`)
    })

    it(`omits modelName when absent`, () => {
      status.setStatus({ connection: `connected` })
      const [, line] = status.render(80)
      expect(line.trim()).toBe(`GREEN(●)`)
    })

    it(`includes providerName when truthy`, () => {
      status.setStatus({ connection: `connected`, providerName: `anthropic` })
      const [, line] = status.render(80)
      expect(line).toContain(`anthropic`)
    })

    it(`omits providerName when absent`, () => {
      status.setStatus({ connection: `connected` })
      const [, line] = status.render(80)
      expect(line.trim()).toBe(`GREEN(●)`)
    })
  })

  describe(`joined line format`, () => {
    it(`joins parts with ' | ' and wraps the line in leading/trailing spaces`, () => {
      status.setStatus({
        connection: `connected`,
        agentName: `my-agent`,
        modelName: `claude-sonnet-5`,
      })
      const [, line] = status.render(80)
      expect(line).toBe(` GREEN(●) | my-agent | claude-sonnet-5 `)
    })
  })

  describe(`separator lines`, () => {
    it(`repeats the separator character to the given width`, () => {
      status.setStatus({ connection: `connected` })
      const [top, , bottom] = status.render(20)
      expect(top).toBe(`─`.repeat(20))
      expect(bottom).toBe(top)
    })

    it(`clamps width to at least 1 for width=0`, () => {
      status.setStatus({ connection: `connected` })
      const [top] = status.render(0)
      expect(top).toBe(`─`)
    })

    it(`clamps width to at least 1 for a negative width`, () => {
      status.setStatus({ connection: `connected` })
      const [top] = status.render(-5)
      expect(top).toBe(`─`)
    })
  })

  it(`returns exactly [separator, line, separator]`, () => {
    status.setStatus({ connection: `connected` })
    const result = status.render(10)
    expect(result).toHaveLength(3)
    expect(result[0]).toBe(result[2])
  })

  describe(`setStatus merging`, () => {
    it(`merges partial updates, preserving previously-set fields not present in the second call`, () => {
      status.setStatus({
        connection: `connected`,
        agentName: `my-agent`,
        modelName: `claude-sonnet-5`,
      })
      status.setStatus({ providerName: `anthropic` })

      const [, line] = status.render(80)
      expect(line).toContain(`my-agent`)
      expect(line).toContain(`claude-sonnet-5`)
      expect(line).toContain(`anthropic`)
    })

    it(`overwrites a field when the second call provides a new value for it`, () => {
      status.setStatus({ connection: `connected`, agentName: `first-agent` })
      status.setStatus({ agentName: `second-agent` })

      const [, line] = status.render(80)
      expect(line).toContain(`second-agent`)
      expect(line).not.toContain(`first-agent`)
    })
  })
})
