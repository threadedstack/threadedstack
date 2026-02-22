import type { TSelectItem } from '@TRL/types'

import { useState, useCallback, useRef } from 'react'

type TSubMenuOptions = {
  onAction?: (item: TSelectItem) => void
}

type TSubMenuReturn = {
  visible: boolean
  prompt: string
  items: TSelectItem[]
  selectedIndex: number
  show: (
    prompt: string,
    items: TSelectItem[],
    onSelect: (item: TSelectItem) => void,
    options?: TSubMenuOptions
  ) => void
  close: () => void
  moveUp: () => void
  moveDown: () => void
  select: () => void
  action: () => void
}

export function useSubMenu(): TSubMenuReturn {
  const [visible, setVisible] = useState(false)
  const [prompt, setPrompt] = useState(``)
  const [items, setItems] = useState<TSelectItem[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)

  const onSelectRef = useRef<((item: TSelectItem) => void) | null>(null)
  const onActionRef = useRef<((item: TSelectItem) => void) | null>(null)

  const show = useCallback(
    (
      newPrompt: string,
      newItems: TSelectItem[],
      onSelect: (item: TSelectItem) => void,
      options?: TSubMenuOptions
    ) => {
      setPrompt(newPrompt)
      setItems(newItems)
      setSelectedIndex(0)
      onSelectRef.current = onSelect
      onActionRef.current = options?.onAction ?? null
      setVisible(true)
    },
    []
  )

  const close = useCallback(() => {
    setVisible(false)
    setItems([])
    setPrompt(``)
    setSelectedIndex(0)
    onSelectRef.current = null
    onActionRef.current = null
  }, [])

  const moveUp = useCallback(() => {
    setSelectedIndex((prev) => (prev <= 0 ? Math.max(items.length - 1, 0) : prev - 1))
  }, [items.length])

  const moveDown = useCallback(() => {
    setSelectedIndex((prev) => (prev >= items.length - 1 ? 0 : prev + 1))
  }, [items.length])

  const select = useCallback(() => {
    const item = items[selectedIndex]
    if (!item || !onSelectRef.current) return
    const cb = onSelectRef.current
    close()
    cb(item)
  }, [items, selectedIndex, close])

  const action = useCallback(() => {
    const item = items[selectedIndex]
    if (!item || !onActionRef.current) return
    onActionRef.current(item)
  }, [items, selectedIndex])

  return {
    show,
    close,
    items,
    moveUp,
    select,
    action,
    prompt,
    visible,
    moveDown,
    selectedIndex,
  }
}
