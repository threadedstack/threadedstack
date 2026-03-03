import type { NotificationCountProps } from './notification.types'
import type { ReactNode, FocusEvent, ChangeEvent, JSX, KeyboardEvent } from 'react'

type TFocusOpts = {
  element?: HtmlInEl
  text: string | number
}

export type TOnKeyDown = (evt: KeyboardEvent<any>) => void
export type HtmlInEl = HTMLInputElement | (HTMLElement & { value: string | number })
export type TInRangeEl = HtmlInEl | ChildNode
export type TOnChange = (evt: ChangeEvent<any>) => void
export type TOnBlur = (evt: FocusEvent<any>, opts: TFocusOpts) => void
export type TOnFocus = (evt: FocusEvent<any>, opts: TFocusOpts) => void

export type TInAutoSelectAll = {
  selectLength?: number
  rangeEl: TInRangeEl
}

export enum EInputDepOutcome {
  hidden = `hidden`,
  disabled = `disabled`,
}

export type TInputDependObj = {
  id?: string
  is?: string | boolean
  not?: string | boolean
  outcome?: EInputDepOutcome
}

export type TInputDepend = TInputDependObj[] | TInputDependObj

export type TDepOutcome = {
  hidden: boolean
  disabled?: boolean
  hasError?: boolean
  description?: string
}

export interface IInput {
  sx?: any
  id: string
  group?: string
  ignore?: boolean
  tooltip?: string
  label?: ReactNode
  hidden?: boolean
  disabled?: boolean
  hasError?: boolean
  className?: string
  required?: boolean
  description?: string
  helperText?: string
  depends?: TInputDepend
  size?: `small` | `medium`
  notificationsProps?: NotificationCountProps
}

export type TSelectItem = {
  label: string
  prefix?: string
  postfix?: string
  icon?: JSX.Element
  disabled?: boolean
  value: string | number
  notificationCount?: number
}
