import { useState, useRef, useEffect, useCallback } from 'react'

export type TLocalSearch<T> = {
  items?: T[]
  onQuery?: (query: string, current: T[], initial: T[]) => T[] | undefined | void
}

export const useLocalSearch = <T>(props: TLocalSearch<T>) => {
  const { onQuery } = props
  // Read via a ref rather than a dependency — onQuery is commonly an inline
  // callback that consumers recreate every render, and depending on it here
  // would make onSearch (and the effect below) re-fire on every parent
  // render instead of only when props.items actually changes.
  const onQueryRef = useRef(onQuery)
  onQueryRef.current = onQuery

  const [query, setQueryState] = useState(``)
  const queryRef = useRef(query)
  const itemsRef = useRef<T[]>(props.items)
  const [items, setItemsState] = useState<T[]>(itemsRef.current)
  const currentItemsRef = useRef<T[]>(items)

  const setQuery = useCallback((next: string) => {
    queryRef.current = next
    setQueryState(next)
  }, [])

  const setItems = useCallback((next: T[]) => {
    currentItemsRef.current = next
    setItemsState(next)
  }, [])

  const onSearch = useCallback(
    (q?: string) => {
      const found = onQueryRef.current?.(
        q ?? queryRef.current,
        currentItemsRef.current,
        itemsRef.current
      )
      found && setItems(found)
    },
    [setItems]
  )

  const onReset = () => {
    setItems(itemsRef.current)
    setQuery(``)
  }

  const onChange = (change: string) => {
    setQuery(change)
    onSearch(change)
  }

  useEffect(() => {
    itemsRef.current = props.items
    onSearch()
  }, [props.items, onSearch])

  return {
    items,
    query,
    onReset,
    setQuery,
    onSearch,
    setItems,
    onChange,
  }
}
