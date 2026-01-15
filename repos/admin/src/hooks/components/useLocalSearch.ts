import { useState, useRef, useEffect } from 'react'

export type TLocalSearch<T> = {
  items?: T[]
  onQuery?: (query: string, current: T[], initial: T[]) => T[] | undefined | void
}

export const useLocalSearch = <T>(props: TLocalSearch<T>) => {
  const { onQuery } = props

  const [query, setQuery] = useState(``)
  const itemsRef = useRef<T[]>(props.items)
  const [items, setItems] = useState<T[]>(itemsRef.current)

  const onSearch = (q?: string) => {
    const found = onQuery?.(q ?? query, items, itemsRef.current)
    found && setItems(found)
  }

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
  }, [props.items])

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
