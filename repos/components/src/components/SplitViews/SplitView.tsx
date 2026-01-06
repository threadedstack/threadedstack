import type { ReactNode } from 'react'
import { Pane } from 'split-pane-react'

export type TSplitView = {
  className?: string
  children: ReactNode
  min?: string | number
  max?: string | number
}

export const SplitView = (props: TSplitView) => {
  return (
    <Pane
      minSize={props.min}
      maxSize={props.max}
      className={props.className}
    >
      {props.children}
    </Pane>
  )
}
