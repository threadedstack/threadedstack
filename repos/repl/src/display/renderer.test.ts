import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Renderer } from './renderer'

describe(`Renderer`, () => {
  let renderer: Renderer
  let output: string[]

  beforeEach(() => {
    renderer = new Renderer()
    output = []
    vi.spyOn(process.stdout, `write`).mockImplementation((chunk: any) => {
      output.push(String(chunk))
      return true
    })
  })

  const joined = () => output.join(``)

  describe(`renderEvent`, () => {
    it(`should render text events to stdout`, () => {
      renderer.renderEvent({ type: `text`, text: `Hello world` } as any)
      expect(joined()).toContain(`Hello world`)
    })

    it(`should accumulate text across multiple events`, () => {
      renderer.renderEvent({ type: `text`, text: `Hello ` } as any)
      renderer.renderEvent({ type: `text`, text: `world` } as any)
      expect(joined()).toBe(`Hello world`)
    })

    it(`should render tool_call_start with tool name`, () => {
      renderer.renderEvent({
        type: `tool_call_start`,
        id: `tc1`,
        name: `shell_exec`,
      } as any)
      expect(joined()).toContain(`shell_exec`)
    })

    it(`should accumulate tool_call_args`, () => {
      renderer.renderEvent({
        type: `tool_call_start`,
        id: `tc1`,
        name: `shell_exec`,
      } as any)
      renderer.renderEvent({
        type: `tool_call_args`,
        id: `tc1`,
        args: `{"cmd":`,
      } as any)
      renderer.renderEvent({
        type: `tool_call_args`,
        id: `tc1`,
        args: `"ls"}`,
      } as any)

      // Args are accumulated but not rendered until tool_result
      renderer.renderEvent({
        type: `tool_result`,
        toolUseId: `tc1`,
        content: `file1.txt\nfile2.txt`,
        isError: false,
      } as any)

      const text = joined()
      expect(text).toContain(`cmd`)
      expect(text).toContain(`ls`)
    })

    it(`should render tool_result with success marker`, () => {
      renderer.renderEvent({
        type: `tool_call_start`,
        id: `tc1`,
        name: `test`,
      } as any)
      renderer.renderEvent({
        type: `tool_result`,
        toolUseId: `tc1`,
        content: `Success`,
        isError: false,
      } as any)

      expect(joined()).toContain(`✓`)
      expect(joined()).toContain(`Success`)
    })

    it(`should render tool_result with error marker`, () => {
      renderer.renderEvent({
        type: `tool_call_start`,
        id: `tc1`,
        name: `test`,
      } as any)
      renderer.renderEvent({
        type: `tool_result`,
        toolUseId: `tc1`,
        content: `Command failed`,
        isError: true,
      } as any)

      expect(joined()).toContain(`✗`)
      expect(joined()).toContain(`Command failed`)
    })

    it(`should render multi-line tool results with tree structure`, () => {
      renderer.renderEvent({
        type: `tool_call_start`,
        id: `tc1`,
        name: `test`,
      } as any)
      renderer.renderEvent({
        type: `tool_result`,
        toolUseId: `tc1`,
        content: `line1\nline2\nline3`,
        isError: false,
      } as any)

      const text = joined()
      expect(text).toContain(`├`)
      expect(text).toContain(`│`)
      expect(text).toContain(`└`)
    })

    it(`should truncate long tool result content`, () => {
      const longContent = `x`.repeat(600)
      renderer.renderEvent({
        type: `tool_call_start`,
        id: `tc1`,
        name: `test`,
      } as any)
      renderer.renderEvent({
        type: `tool_result`,
        toolUseId: `tc1`,
        content: longContent,
        isError: false,
      } as any)

      const text = joined()
      expect(text).toContain(`...`)
      expect(text.length).toBeLessThan(longContent.length)
    })

    it(`should render error events`, () => {
      renderer.renderEvent({ type: `error`, error: `Something broke` } as any)
      expect(joined()).toContain(`Error:`)
      expect(joined()).toContain(`Something broke`)
    })

    it(`should render done event (flush text buffer)`, () => {
      renderer.renderEvent({ type: `text`, text: `partial` } as any)
      renderer.renderEvent({ type: `done` } as any)
      // done should add a newline to flush the buffer
      expect(joined()).toContain(`\n`)
    })

    it(`should handle tool args that are not valid JSON`, () => {
      renderer.renderEvent({
        type: `tool_call_start`,
        id: `tc1`,
        name: `test`,
      } as any)
      renderer.renderEvent({
        type: `tool_call_args`,
        id: `tc1`,
        args: `not-json`,
      } as any)
      renderer.renderEvent({
        type: `tool_result`,
        toolUseId: `tc1`,
        content: `ok`,
        isError: false,
      } as any)

      // Should still render without crashing, showing raw args
      expect(joined()).toContain(`not-json`)
    })

    it(`should truncate long non-JSON tool args`, () => {
      const longArgs = `a`.repeat(250)
      renderer.renderEvent({
        type: `tool_call_start`,
        id: `tc1`,
        name: `test`,
      } as any)
      renderer.renderEvent({
        type: `tool_call_args`,
        id: `tc1`,
        args: longArgs,
      } as any)
      renderer.renderEvent({
        type: `tool_result`,
        toolUseId: `tc1`,
        content: `ok`,
        isError: false,
      } as any)

      expect(joined()).toContain(`...`)
    })
  })

  describe(`renderWelcome`, () => {
    it(`should show agent name`, () => {
      renderer.renderWelcome(`TestBot`)
      expect(joined()).toContain(`TestBot`)
      expect(joined()).toContain(`tdsk-agent`)
    })

    it(`should show thread id when provided`, () => {
      renderer.renderWelcome(`TestBot`, `t-123`)
      expect(joined()).toContain(`t-123`)
      expect(joined()).toContain(`Thread:`)
    })

    it(`should not show thread when not provided`, () => {
      renderer.renderWelcome(`TestBot`)
      expect(joined()).not.toContain(`Thread:`)
    })

    it(`should show help hint`, () => {
      renderer.renderWelcome(`TestBot`)
      expect(joined()).toContain(`/help`)
    })
  })

  describe(`renderInfo`, () => {
    it(`should output message`, () => {
      renderer.renderInfo(`Some info`)
      expect(joined()).toContain(`Some info`)
    })
  })

  describe(`renderSuccess`, () => {
    it(`should output message`, () => {
      renderer.renderSuccess(`Done!`)
      expect(joined()).toContain(`Done!`)
    })
  })

  describe(`renderWarning`, () => {
    it(`should output message`, () => {
      renderer.renderWarning(`Careful!`)
      expect(joined()).toContain(`Careful!`)
    })
  })

  describe(`spinner`, () => {
    it(`should start and stop cleanly`, () => {
      vi.useFakeTimers()

      const spin = renderer.spinner(`Loading...`)

      // Advance past a few frames
      vi.advanceTimersByTime(240)
      expect(joined()).toContain(`Loading...`)

      spin.stop()

      // After stop, the interval should be cleared (no more writes)
      const writeCountAtStop = output.length
      vi.advanceTimersByTime(240)
      // Only the clear line write should have happened at stop
      expect(output.length).toBe(writeCountAtStop)

      vi.useRealTimers()
    })
  })

  describe(`clear`, () => {
    it(`should reset internal state`, () => {
      // Accumulate some state
      renderer.renderEvent({ type: `text`, text: `buffered` } as any)
      renderer.renderEvent({
        type: `tool_call_start`,
        id: `tc1`,
        name: `test`,
      } as any)

      renderer.clear()

      // After clear, done should not add extra newline (no buffered text)
      output = []
      renderer.renderEvent({ type: `done` } as any)
      expect(joined()).toBe(``)
    })
  })

  describe(`tool call arg formatting`, () => {
    it(`should truncate long arg values in JSON`, () => {
      const longValue = `v`.repeat(100)
      renderer.renderEvent({
        type: `tool_call_start`,
        id: `tc1`,
        name: `test`,
      } as any)
      renderer.renderEvent({
        type: `tool_call_args`,
        id: `tc1`,
        args: JSON.stringify({ key: longValue }),
      } as any)
      renderer.renderEvent({
        type: `tool_result`,
        toolUseId: `tc1`,
        content: `ok`,
        isError: false,
      } as any)

      const text = joined()
      // Key name is wrapped in ANSI gray escape codes, so check separately
      expect(text).toContain(`key`)
      expect(text).toContain(`...`)
      expect(text).not.toContain(longValue)
    })

    it(`should format nested JSON values as stringified`, () => {
      renderer.renderEvent({
        type: `tool_call_start`,
        id: `tc1`,
        name: `test`,
      } as any)
      renderer.renderEvent({
        type: `tool_call_args`,
        id: `tc1`,
        args: JSON.stringify({ nested: { a: 1, b: 2 } }),
      } as any)
      renderer.renderEvent({
        type: `tool_result`,
        toolUseId: `tc1`,
        content: `ok`,
        isError: false,
      } as any)

      const text = joined()
      // Key name is wrapped in ANSI gray escape codes
      expect(text).toContain(`nested`)
      expect(text).toContain(`{"a":1,"b":2}`)
    })
  })
})
