import 'split-pane-react/esm/themes/default.css'

import { SplitView } from './SplitView'
import SplitPane from 'split-pane-react'

export type TSplitViews = {
  direction?: `vertical` | `horizontal`
  resize?: boolean
  handleSize?: number
  onDragEnd?: () => void
  onDragStart?: () => void
  sizes?: Array<string | number>
  children: ReturnType<typeof SplitView>[]
  onChange?: (sizes?: Array<string | number>) => void
}

export const SplitViews = (props: TSplitViews) => {
  const {
    sizes,
    onChange,
    children,
    handleSize = 6,
    onDragEnd,
    resize = true,
    onDragStart,
    direction = `vertical`,
  } = props

  return (
    <SplitPane
      sizes={sizes}
      split={direction}
      onChange={onChange}
      allowResize={resize}
      onDragEnd={onDragEnd}
      sashRender={undefined}
      resizerSize={handleSize}
      onDragStart={onDragStart}
    >
      {children}
    </SplitPane>
  )
}
