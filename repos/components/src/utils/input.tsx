import type {
  MutableRefObject,
} from 'react'

import type {
  HtmlInEl,
  TInRangeEl,
  TInAutoSelectAll,
}  from '@TSC/types'

const getElType = (el:TInRangeEl) => el?.nodeName?.toLowerCase?.()

const isInput = (el?:TInRangeEl, type?:string) => {
  type = type ?? getElType(el)
  return type === `input` || type === `textarea`
}

export const updateValue = <HtmlElement extends HtmlInEl>(
  inputRef:MutableRefObject<HtmlElement>,
  text:string|number=``,
) => {
  if(!inputRef?.current) return {}

  const elType = getElType(inputRef?.current)

  if(!isInput(inputRef?.current, elType))
    inputRef.current.textContent = `${text}`
  else (inputRef.current as HTMLInputElement).value = `${text}`

  return { elType }
}

export const getValue = <HtmlElement extends HtmlInEl>(
  inputRef?:MutableRefObject<HtmlElement>,
  element?:HtmlElement
) => {
  const elType = element
    ? element?.nodeName?.toLowerCase?.()
    : inputRef?.current?.nodeName?.toLowerCase?.()

  return !elType
    ? undefined
    : elType !== `input` && elType !== `textarea`
      ? inputRef.current?.textContent
      : inputRef.current?.value || inputRef.current?.textContent
}


export const autoSelectAll = (props:TInAutoSelectAll) => {
  const {
    rangeEl,
    selectLength,
  } = props

  if(isInput(rangeEl))
    return (rangeEl as HTMLInputElement)?.select?.()

  const firstChild = rangeEl?.childNodes[0] || rangeEl
  const rangeEnd = selectLength ?? `${(getValue(undefined, rangeEl as HtmlInEl) || ``)}`.length
  const selection = window.getSelection()

  const range = document.createRange()
  range.setStart(firstChild, 0)
  range.collapse(true)
  range.setEnd(firstChild, rangeEnd)
  selection?.removeAllRanges()
  selection?.addRange(range)
}

export const setInitialValue = <HtmlElement extends HtmlInEl>(
  inputRef:MutableRefObject<HtmlElement>,
  text:string|number=``,
  autoFocus?:boolean,
  autoSelect?:boolean,
) => {

  const { elType } = updateValue(inputRef, text)
  if(!elType) return

  let rangeEl:TInRangeEl

  if(!isInput(inputRef.current, elType)){
    let firstChild = inputRef?.current?.firstChild

    if(!firstChild){
      const textNode = document.createTextNode(``)
      inputRef?.current?.appendChild(textNode)
      firstChild = textNode
    }
    rangeEl = firstChild
  }
  else rangeEl = inputRef.current

  autoFocus && inputRef?.current?.focus?.()

  rangeEl
    && autoSelect
    && autoSelectAll({
        rangeEl,
        selectLength: `${text}`.length
      })

}
