import type { TSelectItem } from '@TSC/types'

import { cls } from '@keg-hub/jsutils'
import { CodeLanguages } from '@TSC/constants/monaco'
import { SelectInput } from '@TSC/components/Inputs/SelectInput'
import { LangContainer } from '@TSC/components/Monaco/Monaco.styles'

export type TLangSelect = {
  className?: string
  language?: string | number
  onChange?: (item: TSelectItem) => void
}

const styles = {
  wrap: {
    marginBottom: `3px !important`,
  },
  label: {
    fontSize: `10px`,
  },
  select: {
    height: `10px`,
    fontSize: `10px`,
    minHeight: `20px`,
  },
}

export const LangSelect = (props: TLangSelect) => {
  const { language, onChange, className } = props

  const active = CodeLanguages.find((type) => type.label === language)

  const onChangeCB = (evt: any) => {
    const id = evt.target.value
    const found = CodeLanguages.find((type) => type.id === id)
    found && found?.id !== active?.id && onChange?.(found as TSelectItem)
  }

  return (
    <LangContainer className='tdsk-monaco-lang-select-container'>
      <SelectInput
        id='tdsk-lang-select'
        onChange={onChangeCB}
        value={active?.value || ``}
        items={CodeLanguages as TSelectItem[]}
        className={cls(className, `tdsk-monaco-lang-select`)}
      />
    </LangContainer>
  )
}
