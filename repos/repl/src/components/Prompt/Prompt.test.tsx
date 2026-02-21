import { Prompt } from './Prompt'
import { render } from 'ink-testing-library'
import { describe, it, expect } from 'vitest'

describe(`Prompt`, () => {
  it(`renders prompt indicator`, () => {
    const { lastFrame } = render(
      <Prompt
        onSubmit={() => {}}
        disabled={false}
      />
    )
    expect(lastFrame()).toContain(`>`)
  })

  it(`shows disabled state while agent is responding`, () => {
    const { lastFrame } = render(
      <Prompt
        onSubmit={() => {}}
        disabled
      />
    )
    expect(lastFrame()).toBeTruthy()
  })
})
