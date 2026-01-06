import type { TButton } from '@TSC/components/Buttons/Button'
import type { ReactNode } from 'react'

export type TAccordionAction = Omit<TButton, `color` | `variant`> & {
  color?: string
  variant?: string
  info?: ReactNode
  hidden?: boolean
  loading?: boolean
  editing?: boolean
  inactive?: boolean
  content?: ReactNode
  separatorAfter?: boolean
  separatorBefore?: boolean
  data?: Record<string, any>
  onChange?: (evt: any, ...args: any[]) => any
  onClick?: (evt: any, ...args: any[]) => any
  onOpenInfo?: (evt: any, ...args: any[]) => any
  onCloseInfo?: (evt: any, ...args: any[]) => any
}

export type TSectionAction = TAccordionAction
