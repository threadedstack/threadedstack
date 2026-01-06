import { formatDateForDisplay } from '@TSC/utils/date'
import { useMemo } from 'react'

export type THDisplayDate = {
  time?: boolean
  date: Date | string | number
}

export const useDisplayDate = (props: THDisplayDate) => {
  const { date, time } = props

  return useMemo(() => formatDateForDisplay(date, time), [date, time])
}
