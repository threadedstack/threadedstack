import type { TOnKeyDown } from '@TSC/types'
import type { KeyboardEventHandler } from 'react'

import { stopEvent } from '@TSC/utils/helpers'
import { useInline } from '@TSC/hooks/components/useInline'

export type THKeyDown = {
  stopEvt?: boolean
  blurOnEnter?: boolean
  onKeyDown?: TOnKeyDown
  onEscDown?: TOnKeyDown
  onEnterDown?: TOnKeyDown
}

export const useKeyDown = (props: THKeyDown) => {
  const { onKeyDown, onEscDown, onEnterDown, blurOnEnter, stopEvt = true } = props

  const onKeyDownCB = useInline<KeyboardEventHandler<any>>((evt) => {
    /**
     * Pressing Enter key
     */
    if (evt.keyCode === 13 && (blurOnEnter || onEnterDown)) {
      stopEvt && stopEvent(evt)
      blurOnEnter && (evt?.target as HTMLElement)?.blur()
      if (onEnterDown) {
        onEnterDown?.(evt)
        return
      }
    }

    /**
     * Pressing Escape key
     */
    if (evt.keyCode === 27 && onEscDown) {
      stopEvt && stopEvent(evt)
      onEscDown?.(evt)
      return
    }

    if (onKeyDown) {
      stopEvt && stopEvent(evt)
      onKeyDown?.(evt)
    }
  })

  return {
    onKeyDown: onKeyDownCB,
  }
}
