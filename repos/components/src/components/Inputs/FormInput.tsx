import type { IInput } from '@TSC/types'
import type { TInlineSelect } from './InlineSelect'
import type { TSelectInput } from './SelectInput'
import type { SliderInputProps } from './SliderInput'
import type { SwitchInputProps } from './SwitchInput'
import type { TagsInputProps } from './TagsInput'
import type { TTextInput } from './TextInput'

import { InlineSelect } from './InlineSelect'
import { SelectInput } from './SelectInput'
import { SliderInput } from './SliderInput'
import { SwitchInput } from './SwitchInput'
import { TagsInput } from './TagsInput'
import { TextInput } from './TextInput'

import { omitKeys } from '@keg-hub/jsutils/omitKeys'

export type TFormInputValue = string | number | boolean | string[] | undefined

export interface IFormInput<T, V extends TFormInputValue> extends IInput {
  type: T
  value?: V
  initial?: V
  inline?: boolean
  setField?(field: string, value: V, shouldValidate?: boolean): void
}

export type TFormInputType =
  | (Omit<TSelectInput, 'value'> & IFormInput<'select', string>)
  | (Omit<TagsInputProps, 'value'> & IFormInput<'tags', string[]>)
  | (Omit<TInlineSelect, 'value'> & IFormInput<'select', string[]>)
  | (Omit<SliderInputProps, 'value'> & IFormInput<'slider', number>)
  | (Omit<TTextInput, 'value'> & IFormInput<'textinput', string>)
  | (Omit<SwitchInputProps, 'checked'> & IFormInput<'switch', boolean>)
  | (Omit<TTextInput, 'value'> & IFormInput<'numberinput', number>)

export type TFormInput = { element: TFormInputType; hidden?: boolean }

const omitProps = [
  `setField`,
  `itemMap`,
  `ignore`,
  `depends`,
  `group`,
  `hidden`,
  `inline`,
]

export const FormInput = (props: TFormInput) => {
  if (props?.hidden) return null

  const { element } = props

  switch (element?.type) {
    case 'select':
      return element?.inline ? (
        <InlineSelect
          {...omitKeys(element, omitProps)}
          itemMap={element.itemMap}
          setField={element?.setField as any}
          value={element.value ?? ('' as any)}
        />
      ) : (
        <SelectInput
          {...omitKeys(element, omitProps)}
          itemMap={element.itemMap}
          value={element.value ?? ('' as any)}
        />
      )
    case 'slider':
      return (
        <SliderInput
          {...element}
          value={element.value ?? 0}
        />
      )
    case 'tags':
      return (
        <TagsInput
          {...omitKeys(element, omitProps)}
          itemMap={element.itemMap}
          setField={element?.setField}
          value={element.value ?? []}
        />
      )
    case 'switch':
      return (
        <SwitchInput
          {...omitKeys(element, omitProps)}
          checked={!!element.value}
          inputProps={{
            id: element.id,
            name: element.id,
          }}
        />
      )
    case 'textinput':
      return (
        <TextInput
          {...omitKeys(element, omitProps)}
          value={element.value ?? ''}
        />
      )
    case 'numberinput':
      return (
        <TextInput
          {...omitKeys(element, omitProps)}
          type='number'
          value={element.value?.toString() ?? '0'}
        />
      )
    default:
      // If the element type is not recognized, we indicate an unimplemented type.
      // This code path should not normally occur and serves as a fallback.
      element satisfies never
      return <></>
  }
}
