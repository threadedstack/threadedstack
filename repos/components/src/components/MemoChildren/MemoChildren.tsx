import type { ReactNode } from 'react'
import { memo } from 'react'

export type TMemoChildren = {
  children: ReactNode
}

export const MemoChildren = memo((props: TMemoChildren) => <>{props.children}</>)
