import type { TSelectItem } from '@TRL/types'

import React from 'react'
import { Text } from 'ink'
import { render } from 'ink-testing-library'
import { describe, it, expect, vi } from 'vitest'
import { useSubMenu } from './useSubMenu'

/**
 * Mutable ref that gets updated on every render so tests
 * always have the latest hook functions (avoids stale closures).
 */
let hookRef: ReturnType<typeof useSubMenu>

const HookTester = () => {
  const hook = useSubMenu()
  hookRef = hook

  return (
    <Text>
      {`visible:${hook.visible}|prompt:${hook.prompt}|index:${hook.selectedIndex}|count:${hook.items.length}`}
    </Text>
  )
}

const items: TSelectItem[] = [
  { id: `1`, label: `Item 1`, description: `First` },
  { id: `2`, label: `Item 2`, description: `Second` },
  { id: `3`, label: `Item 3` },
]

const wait = () => new Promise((r) => setTimeout(r, 50))

describe(`useSubMenu`, () => {
  it(`starts with visible=false and empty state`, () => {
    const { lastFrame } = render(<HookTester />)
    expect(lastFrame()).toContain(`visible:false`)
    expect(lastFrame()).toContain(`prompt:`)
    expect(lastFrame()).toContain(`index:0`)
    expect(lastFrame()).toContain(`count:0`)
  })

  it(`show() sets items, prompt, and makes visible`, async () => {
    const { lastFrame } = render(<HookTester />)

    hookRef.show(`Pick one:`, items, vi.fn())
    await wait()

    expect(lastFrame()).toContain(`visible:true`)
    expect(lastFrame()).toContain(`prompt:Pick one:`)
    expect(lastFrame()).toContain(`count:3`)
    expect(lastFrame()).toContain(`index:0`)
  })

  it(`close() resets all state`, async () => {
    const { lastFrame } = render(<HookTester />)

    hookRef.show(`Pick:`, items, vi.fn())
    await wait()
    expect(lastFrame()).toContain(`visible:true`)

    hookRef.close()
    await wait()
    expect(lastFrame()).toContain(`visible:false`)
    expect(lastFrame()).toContain(`count:0`)
  })

  it(`select() calls onSelect callback with current item`, async () => {
    const onSelect = vi.fn()
    const { lastFrame } = render(<HookTester />)

    hookRef.show(`Pick:`, items, onSelect)
    await wait()
    // hookRef now has the latest select() that closes over the new items
    hookRef.select()
    await wait()

    expect(onSelect).toHaveBeenCalledWith(items[0])
    expect(lastFrame()).toContain(`visible:false`)
  })

  it(`action() calls onAction callback without closing`, async () => {
    const onSelect = vi.fn()
    const onAction = vi.fn()
    const { lastFrame } = render(<HookTester />)

    hookRef.show(`Pick:`, items, onSelect, { onAction })
    await wait()
    hookRef.action()
    await wait()

    expect(onAction).toHaveBeenCalledWith(items[0])
    expect(lastFrame()).toContain(`visible:true`)
  })

  it(`action() does nothing when no onAction provided`, async () => {
    const onSelect = vi.fn()
    render(<HookTester />)

    hookRef.show(`Pick:`, items, onSelect)
    await wait()

    // Should not throw
    hookRef.action()
    expect(onSelect).not.toHaveBeenCalled()
  })
})
