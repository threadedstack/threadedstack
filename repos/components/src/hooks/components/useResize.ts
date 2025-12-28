import { throttle } from '@keg-hub/jsutils/throttle'
import { useCallback, useEffect, useRef, useState } from 'react'

export type THUseResize = {
  minWidth: number
  maxWidth: number
  initialWidth: number
  direction?: `left` | `right`
}

export type TResizeDims = {
  width?: number
  wdelta?: number
}

export const useResize = (props: THUseResize) => {
  const {
    minWidth = 0,
    direction = `left`,
    initialWidth = minWidth,
    maxWidth = window.innerWidth,
  } = props

  const elRef = useRef<HTMLDivElement>()
  const [width, setWidth] = useState(initialWidth)
  const [resizing, setResizing] = useState(false)
  const onResize = useCallback(
    (evt: any) => {
      evt?.preventDefault?.()
      setResizing(true)
    },
    [setResizing]
  )

  const disableResize = useCallback(() => setResizing(false), [setResizing])

  const resize = useCallback(
    (evt: MouseEvent, dims?: TResizeDims) => {
      if (!resizing && !dims) return

      evt?.preventDefault?.()

      const windowWidth = window.innerWidth
      let width = dims?.width || windowWidth - evt.clientX

      if (width <= minWidth) return setWidth(minWidth)
      if (maxWidth && maxWidth < width) return setWidth(minWidth)
      if (direction === `left`) return setWidth(width)

      if (!elRef?.current) return setWidth(width)

      /**
       * Don't allow resize off screen
       * If right coord is beyond the window width
       * And the element is resized to be larger, set to remaining size left in viewport
       */
      const remaining = windowWidth - elRef?.current?.offsetLeft
      const rightOffset = elRef?.current.offsetLeft + elRef?.current.offsetWidth
      rightOffset > windowWidth && width >= elRef?.current.offsetWidth
        ? setWidth(remaining)
        : setWidth(width)
    },
    [minWidth, resizing, setWidth]
  )

  useEffect(() => {
    const throttled = throttle(resize, 20)
    document.addEventListener(`mousemove`, throttled)
    document.addEventListener(`mouseup`, disableResize)

    return () => {
      document.removeEventListener(`mousemove`, throttled)
      document.removeEventListener(`mouseup`, disableResize)
    }
  }, [disableResize, resize])

  return {
    width,
    elRef,
    resize,
    setWidth,
    onResize,
    resizing,
  }
}
