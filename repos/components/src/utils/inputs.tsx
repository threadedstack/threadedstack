import type { TFormInputType } from '@TSC/components/Inputs/FormInput'

import { EInputDepOutcome, TDepOutcome } from '@TSC/types'
import { ensureArr } from '@keg-hub/jsutils/ensureArr'
import { exists } from '@keg-hub/jsutils/exists'

export type TResolveDepends = {
  input: TFormInputType
  inputs: TFormInputType[]
  data: Record<string, any>
}

export const resolveDepends = (props: TResolveDepends) => {
  const { input, inputs, data } = props

  if (!inputs?.length || !input?.depends) return

  const outcomes = ensureArr(input?.depends)
    .map((depends) => {
      const depIn = inputs?.find((input) => input.id === depends?.id)
      if (!depIn) return false

      const depId = depends?.id
      const value = data?.values?.[depId] ?? data?.[depId]

      if (!exists(value)) return false

      const isCheck = `is` in depends
      const notCheck = `not` in depends
      if (!isCheck && !notCheck) return false

      const outcome = isCheck
        ? ensureArr(depends?.is).includes(value)
          ? depends?.outcome || EInputDepOutcome.disabled
          : false
        : !ensureArr(depends?.not).includes(value)
          ? depends?.outcome || EInputDepOutcome.disabled
          : false

      if (!outcome) return false

      return !outcome
        ? false
        : outcome === EInputDepOutcome.hidden
          ? { hidden: true }
          : {
              hidden: false,
              disabled: true,
              hasError: true,
              description:
                depends?.error ||
                `${input.label || input.name} depends on the value of ${depIn?.label || depId}`,
            }
    })
    .filter((outcome) => Boolean(outcome)) as TDepOutcome[]

  return (
    (outcomes?.length && outcomes?.find((out) => out?.hidden)) ||
    outcomes?.[outcomes?.length - 1]
  )
}
