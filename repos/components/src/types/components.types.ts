import type { ReactNode } from 'react'

export type TAvatarSize = `sm` | `md` | `lg` | `xl`

export type TAvatar = {
  name: string
  src?: string
  square?: boolean
  size?: TAvatarSize
  identifier?: string
}

export type TChipSize = `sm` | `md`
export type TChipVariant = `tint` | `solid` | `outlined`
export type TChipTone = `success` | `warning` | `info` | `error` | `neutral` | `primary`

export type TChip = {
  label: string
  pulse?: boolean
  icon?: ReactNode
  tone?: TChipTone
  size?: TChipSize
  variant?: TChipVariant
}
