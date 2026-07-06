import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useLocalSearch } from './useLocalSearch'

// NOTE: items arrays are hoisted to stable references. Passing a fresh array
// literal from inside the renderHook callback would give props.items a new
// identity on every internal re-render (independent of this hook's
// correctness) and mask/produce infinite-loop behavior in the test itself.
const fruits = ['apple', 'banana', 'cherry']
const fruits2 = ['avocado', 'blueberry', 'apricot']

const makeOnQuery = () =>
  vi.fn((query: string, _current: string[], initial: string[]) =>
    initial.filter((item) => item.includes(query))
  )

describe('useLocalSearch', () => {
  it('initializes items from props.items', () => {
    const { result } = renderHook(() => useLocalSearch<string>({ items: fruits }))

    expect(result.current.items).toEqual(fruits)
    expect(result.current.query).toBe(``)
  })

  it('filters items via onChange using the latest query and props.items', () => {
    const onQuery = makeOnQuery()
    const { result } = renderHook(() =>
      useLocalSearch<string>({ items: fruits, onQuery })
    )

    act(() => result.current.onChange('an'))

    expect(result.current.query).toBe('an')
    expect(result.current.items).toEqual(['banana'])
  })

  it('re-filters with the current query when props.items changes, without a stale query', () => {
    const onQuery = makeOnQuery()
    const { result, rerender } = renderHook(
      ({ items }) => useLocalSearch<string>({ items, onQuery }),
      { initialProps: { items: fruits } }
    )

    act(() => result.current.onChange('a'))
    expect(result.current.items).toEqual(['apple', 'banana'])

    // New items arrive from the parent (e.g. a fresh API load) — the effect
    // must re-run onQuery against the NEW initial list using the CURRENT
    // query, not a stale query captured at an earlier render.
    rerender({ items: fruits2 })

    expect(result.current.items).toEqual(['avocado', 'apricot'])
  })

  it('does not change identity of onSearch across re-renders caused by unrelated state', () => {
    const onQuery = makeOnQuery()
    const seen = new Set<Function>()
    const { rerender } = renderHook(() => {
      const search = useLocalSearch<string>({ items: fruits, onQuery })
      seen.add(search.onSearch)
      return search
    })

    rerender()
    rerender()

    // onSearch must be memoized (stable reference) so consumers that pass it
    // into their own effect dependency arrays don't re-run on every render.
    expect(seen.size).toBe(1)
  })

  it('settles after a single re-filter and does not loop when onQuery returns a new array each call', () => {
    const onQuery = makeOnQuery()
    const { result } = renderHook(() =>
      useLocalSearch<string>({ items: fruits, onQuery })
    )

    act(() => result.current.onChange('a'))

    const callsAfterChange = onQuery.mock.calls.length
    act(() => {})
    expect(onQuery.mock.calls.length).toBe(callsAfterChange)
  })

  it('onReset restores the original items and clears the query', () => {
    const onQuery = makeOnQuery()
    const { result } = renderHook(() =>
      useLocalSearch<string>({ items: fruits, onQuery })
    )

    act(() => result.current.onChange('an'))
    expect(result.current.items).toEqual(['banana'])

    act(() => result.current.onReset())
    expect(result.current.query).toBe(``)
    expect(result.current.items).toEqual(fruits)
  })
})
