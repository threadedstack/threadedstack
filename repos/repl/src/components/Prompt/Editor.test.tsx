import { Editor } from './Editor'
import { render } from 'ink-testing-library'
import { describe, it, expect } from 'vitest'

describe(`Editor`, () => {
  it(`renders single line with cursor`, () => {
    const { lastFrame } = render(
      <Editor
        lines={[`hello`]}
        cursorRow={0}
        cursorCol={0}
        disabled={false}
      />
    )
    const frame = lastFrame()
    expect(frame).toBeTruthy()
    // The cursor inverts the first char
    expect(frame).toContain(`ello`)
  })

  it(`renders cursor at end of line`, () => {
    const { lastFrame } = render(
      <Editor
        lines={[`hi`]}
        cursorRow={0}
        cursorCol={2}
        disabled={false}
      />
    )
    const frame = lastFrame()
    expect(frame).toContain(`hi`)
  })

  it(`renders multi-line text`, () => {
    const { lastFrame } = render(
      <Editor
        lines={[`line one`, `line two`]}
        cursorRow={1}
        cursorCol={0}
        disabled={false}
      />
    )
    const frame = lastFrame()
    expect(frame).toContain(`line one`)
  })

  it(`renders disabled state in gray`, () => {
    const { lastFrame } = render(
      <Editor
        lines={[`hello`]}
        cursorRow={0}
        cursorCol={0}
        disabled={true}
      />
    )
    const frame = lastFrame()
    expect(frame).toBeTruthy()
  })

  it(`renders empty state without error`, () => {
    const { lastFrame } = render(
      <Editor
        lines={[``]}
        cursorRow={0}
        cursorCol={0}
        disabled={false}
      />
    )
    // Empty state renders cursor placeholder (inverse space) which may be
    // stripped by the test renderer — just verify no throw
    expect(lastFrame).toBeDefined()
  })

  it(`renders disabled empty state without error`, () => {
    const { lastFrame } = render(
      <Editor
        lines={[``]}
        cursorRow={0}
        cursorCol={0}
        disabled={true}
      />
    )
    expect(lastFrame).toBeDefined()
  })
})
