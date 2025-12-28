import { useInline } from '@TSC/hooks/components/useInline'
import { exists } from '@keg-hub/jsutils/exists'
import { useState } from 'react'

export type THArrToggleRes<T> = [
  T[],
  (item: T, status?: boolean) => any,
  (items: T[]) => any,
]

export const useArrToggle = <T = any>(initial?: T[]) => {
  const [items, setItems] = useState<T[]>(initial || ([] as T[]))

  const onToggleItems = useInline((item: T, status?: boolean) => {
    if (!item) return

    const hasItem = items.includes(item)
    if (exists(status))
      return !status
        ? setItems(items.filter((it) => it !== item))
        : !hasItem && setItems([...items, item])

    hasItem ? setItems(items.filter((id) => id !== item)) : setItems([...items, item])
  })

  return [items, onToggleItems, setItems] as THArrToggleRes<T>
}
