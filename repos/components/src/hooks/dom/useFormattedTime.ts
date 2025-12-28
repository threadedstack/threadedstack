import { emptyObj } from '@keg-hub/jsutils/emptyObj'
import { useMemo } from 'react'

export type THFormattedTime = {
  time: string | number
  locals?: Intl.LocalesArgument
  options?: Intl.DateTimeFormatOptions
}

export const useFormattedTime = (props: THFormattedTime) => {
  const { time, locals, options = emptyObj } = props

  return useMemo(() => {
    return new Intl.DateTimeFormat(locals, {
      day: `numeric`,
      month: `numeric`,
      year: `numeric`,
      hour: `numeric`,
      minute: `numeric`,
      ...options,
    }).format(new Date(time))
  }, [time, options, locals])
}
