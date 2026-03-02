import type { Function as FunctionModel } from '@tdsk/domain'
import { useMemo } from 'react'
import { EntitySelector, EntitySelectorSingle } from './EntitySelector'

export type TFunctionsSelector = {
  loading: boolean
  required?: boolean
  selectedFunctionIds: string[]
  availableFunctions: FunctionModel[]
  onChange: (functionIds: string[]) => void
}

export type TFunctionSelectorSingle = {
  loading?: boolean
  disabled?: boolean
  functionId: string
  required?: boolean
  availableFunctions: FunctionModel[]
  onChange: (functionId: string) => void
}

const useFunctionOptions = (fns: FunctionModel[]) =>
  useMemo(
    () =>
      fns.map((f) => ({
        id: f.id,
        label: f.name || f.id,
        secondary: f.description,
      })),
    [fns]
  )

export const FunctionsSelector = (props: TFunctionsSelector) => {
  const { loading, onChange, required, selectedFunctionIds, availableFunctions } = props
  const options = useFunctionOptions(availableFunctions)

  return (
    <EntitySelector
      options={options}
      loading={loading}
      required={required}
      onChange={onChange}
      id='agent-functions'
      title='Custom Functions'
      label='Custom Functions'
      value={selectedFunctionIds}
      placeholder='Select functions...'
      disabled={availableFunctions.length === 0}
      description={
        loading
          ? `Loading functions...`
          : availableFunctions.length === 0
            ? `No functions available. Create a function first.`
            : `Select functions to attach as tools for this agent`
      }
    />
  )
}

export const FunctionSelectorSingle = (props: TFunctionSelectorSingle) => {
  const { loading, disabled, functionId, required, availableFunctions, onChange } = props
  const options = useFunctionOptions(availableFunctions)

  return (
    <EntitySelectorSingle
      label='Function'
      options={options}
      loading={loading}
      required={required}
      id='function-select'
      value={functionId || null}
      placeholder='Select function...'
      onChange={(id) => onChange(id || '')}
      disabled={disabled || availableFunctions.length === 0}
      description={
        loading
          ? `Loading functions...`
          : availableFunctions.length === 0
            ? `No functions available. Create a function first.`
            : `Select a function to execute`
      }
    />
  )
}
