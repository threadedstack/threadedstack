import type { ComponentType, ReactNode } from 'react'
import type { TAnyCB } from './helpers.types'

export type TCompCB = (...args: any[]) => ReactNode
export type TTabPanel = TCompCB | ReactNode | ComponentType<any> | TAnyCB
