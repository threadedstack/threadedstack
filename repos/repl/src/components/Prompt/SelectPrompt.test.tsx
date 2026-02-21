import { describe, it, expect } from 'vitest'
import { render } from 'ink-testing-library'
import { SelectPrompt } from './SelectPrompt'

describe(`SelectPrompt`, () => {
  const items = [
    { id: `1`, label: `Option A`, description: `First option` },
    { id: `2`, label: `Option B`, description: `Second option` },
  ]

  it(`renders all items with numbers`, () => {
    const { lastFrame } = render(
      <SelectPrompt
        items={items}
        prompt="Pick one:"
        onSelect={() => {}}
      />
    )
    const frame = lastFrame()!
    expect(frame).toContain(`1.`)
    expect(frame).toContain(`Option A`)
    expect(frame).toContain(`2.`)
    expect(frame).toContain(`Option B`)
  })

  it(`renders the prompt text`, () => {
    const { lastFrame } = render(
      <SelectPrompt
        items={items}
        prompt="Pick one:"
        onSelect={() => {}}
      />
    )
    expect(lastFrame()).toContain(`Pick one:`)
  })
})
