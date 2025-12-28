import type { MouseEvent, MutableRefObject } from 'react'

export type TListItemToggle = {
  open: boolean
  onOpen: (evt: MouseEvent) => any
}

export type TListItemToggleGrp = Record<string, TListItemToggle>
export type TListItemToggleRef = MutableRefObject<TListItemToggleGrp>
