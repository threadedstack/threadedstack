import type { Function as FunctionModel } from '@tdsk/domain'
import { useMemo } from 'react'
import { EntitySelector, EntitySelectorSingle } from './EntitySelector'

export type TFunctionsSelector = {
  loading: boolean
  selectedFunctionIds: string[]
  availableFunctions: FunctionModel[]
  onChange: (functionIds: string[]) => void
}

export type TFunctionSelectorSingle = {
  loading?: boolean
  disabled?: boolean
  functionId: string
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
  const { loading, onChange, selectedFunctionIds, availableFunctions } = props
  const options = useFunctionOptions(availableFunctions)

  return (
    <EntitySelector
      id='agent-functions'
      title='Custom Functions'
      label='Custom Functions'
      loading={loading}
      disabled={availableFunctions.length === 0}
      value={selectedFunctionIds}
      options={options}
      onChange={onChange}
      placeholder='Select functions...'
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
  const { loading, disabled, functionId, availableFunctions, onChange } = props
  const options = useFunctionOptions(availableFunctions)

  return (
    <EntitySelectorSingle
      id='function-select'
      label='Function'
      loading={loading}
      disabled={disabled || availableFunctions.length === 0}
      value={functionId || null}
      options={options}
      onChange={(id) => onChange(id || '')}
      placeholder='Select function...'
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
