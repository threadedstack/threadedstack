import type { THKeyDown } from '@TSC/hooks/dom/useKeyDown'
import type { MutableRefObject, FocusEventHandler } from 'react'
import type { HtmlInEl, TOnBlur, TOnFocus, TOnChange } from '@TSC/types'

import { useEffect, useRef } from 'react'
import { exists } from '@keg-hub/jsutils'
import { stopEvent } from '@TSC/utils/helpers'

import { useKeyDown } from '@TSC/hooks/dom/useKeyDown'
import { useInline } from '@TSC/hooks/components/useInline'
import { useEnsureRef } from '@TSC/hooks/components/useEnsureRef'
import { useEffectOnce } from '@TSC/hooks/components/useEffectOnce'
import { getValue, updateValue, autoSelectAll, setInitialValue } from '@TSC/utils/input'

export type THInput<HtmlElement extends HtmlInEl = HtmlInEl> = THKeyDown & {
  text?: string
  onBlur?: TOnBlur
  onFocus?: TOnFocus
  autoFocus?: boolean
  autoSelect?: boolean
  setInitial?: boolean
  defaultValue?: string
  value?: string | number
  onChange?: TOnChange
  inputRef?: MutableRefObject<HtmlElement>
}

const useInputCallbacks = <HtmlElement extends HtmlInEl = HtmlInEl>(
  props: THInput<HtmlElement>,
  inputRef?: MutableRefObject<HtmlElement>
) => {
  const {
    onBlur,
    onFocus,
    onKeyDown,
    onEscDown,
    autoSelect,
    setInitial,
    onEnterDown,
    blurOnEnter,
    stopEvt = true,
  } = props

  const { onKeyDown: onKeyDownCB } = useKeyDown({
    stopEvt,
    onKeyDown,
    onEscDown,
    onEnterDown,
    blurOnEnter,
  })

  const onBlurCB = useInline<FocusEventHandler<any>>((evt) => {
    stopEvt && stopEvent(evt)
    onBlur?.(evt, { element: inputRef.current, text: getValue(inputRef) })
  })

  const onFocusCB = useInline<FocusEventHandler<any>>((evt) => {
    stopEvt && stopEvent(evt)

    inputRef.current &&
      autoSelect &&
      !setInitial &&
      autoSelectAll({
        rangeEl: inputRef.current,
        selectLength: `${getValue(inputRef) || ``}`.length,
      })

    onFocus?.(evt, { element: inputRef.current, text: getValue(inputRef) })
  })

  return {
    onBlur: onBlurCB,
    onFocus: onFocusCB,
    onKeyDown: onKeyDownCB,
  }
}

export const useInput = <HtmlElement extends HtmlInEl>(props: THInput<HtmlElement>) => {
  const {
    onChange,
    autoSelect,
    defaultValue,
    setInitial = true,
    autoFocus = false,
    value = defaultValue,
    text = value,
  } = props

  const initValRef = useRef<string | number>(text)
  const inputRef = useEnsureRef<HtmlElement, MutableRefObject<HtmlElement>>(
    props.inputRef
  )

  const { onBlur, onFocus, onKeyDown } = useInputCallbacks(props, inputRef)

  useEffectOnce(() => {
    setInitial && setInitialValue(inputRef, text, autoFocus, autoSelect)
  })

  useEffect(() => {
    if (!inputRef?.current || !exists(initValRef.current) || !exists(text)) return

    const curVal = getValue(inputRef)
    text !== curVal && updateValue(inputRef, text)
  }, [text, inputRef.current, initValRef.current, getValue(inputRef)])

  return {
    onBlur,
    onFocus,
    onChange,
    onKeyDown,
    ref: inputRef,
  }
}
