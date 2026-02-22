import { render } from 'ink-testing-library'
import { SubMenu } from './SubMenu'
import { describe, it, expect } from 'vitest'

describe(`SubMenu`, () => {
  const items = [
    { id: `1`, label: `Item 1`, description: `First item` },
    { id: `2`, label: `Item 2`, description: `Second item` },
    { id: `3`, label: `Item 3` },
  ]

  it(`renders nothing when visible is false`, () => {
    const { lastFrame } = render(
      <SubMenu
        visible={false}
        prompt="Pick one:"
        items={items}
        selectedIndex={0}
      />
    )
    expect(lastFrame()).toBe(``)
  })

  it(`renders prompt and items when visible`, () => {
    const { lastFrame } = render(
      <SubMenu
        visible={true}
        prompt="Pick one:"
        items={items}
        selectedIndex={0}
      />
    )
    const frame = lastFrame()!
    expect(frame).toContain(`Pick one:`)
    expect(frame).toContain(`Item 1`)
    expect(frame).toContain(`Item 2`)
    expect(frame).toContain(`Item 3`)
  })

  it(`renders item descriptions`, () => {
    const { lastFrame } = render(
      <SubMenu
        visible={true}
        prompt="Pick:"
        items={items}
        selectedIndex={0}
      />
    )
    const frame = lastFrame()!
    expect(frame).toContain(`First item`)
    expect(frame).toContain(`Second item`)
  })

  it(`shows "No items" when items is empty`, () => {
    const { lastFrame } = render(
      <SubMenu
        visible={true}
        prompt="Pick:"
        items={[]}
        selectedIndex={0}
      />
    )
    expect(lastFrame()).toContain(`No items`)
  })

  it(`renders numbered items`, () => {
    const { lastFrame } = render(
      <SubMenu
        visible={true}
        prompt="Pick:"
        items={items}
        selectedIndex={0}
      />
    )
    const frame = lastFrame()!
    expect(frame).toContain(`1.`)
    expect(frame).toContain(`2.`)
    expect(frame).toContain(`3.`)
  })
})
