import type { TCronInput } from '@TSC/components/Inputs/CronInput'

import { useState, useEffect } from "react"
import { stopEvent } from "@TSC/utils/helpers"
import { ERepeatType, EChangeType } from '@TSC/types'
import { parseCron, cronToString } from '@TSC/utils/cron'
import { useInline } from '@TSC/hooks/components/useInline'

export const useCron = (props:TCronInput) => {
  const {
    value,
    onChange,
  } = props

  const [interval, setInter] = useState<number>(1)
  const [time, setTime] = useState<string>(`00:00`)
  const [endDate, setEndDate] = useState<string>(``)
  const [startDate, setStartDate] = useState<string>(``)
  const [days, setDays] = useState<string[]>([`Sat`])
  const [repeat, setRepeat] = useState<ERepeatType>(ERepeatType.weekly)

  useEffect(() => {
    const parsed = parseCron(value)
    if(!parsed) return

    setTime(parsed.time)
    setDays(parsed.days)
    setRepeat(parsed.repeat)
    setInter(parsed.interval)

  }, [value])

  const onChangeVal = useInline((evt:any, value:any, type:EChangeType) => {
    stopEvent(evt)
    let next = value

    switch(type){
      case EChangeType.start:{
        setStartDate(value)
        break
      }
      case EChangeType.end:{
        setEndDate(value)
        break
      }
      case EChangeType.time:{
        setTime(value)
        next = cronToString({ days, time:value, repeat, interval})
        break
      }
      case EChangeType.interval:{
        next = cronToString({ days, time, repeat, interval:value})
        setInter(value)
        break
      }
      case EChangeType.days:{

        if(value?.length){
          next = cronToString({ days:value, time, repeat, interval})
          setDays(value)
        }

        break
      }
      case EChangeType.repeat:{
        next = cronToString({ days, time, repeat:value, interval})
        setRepeat(value as ERepeatType)
        break
      }
    }

    onChange?.(evt, {
      days,
      time,
      repeat,
      interval,
      value:next,
      end:endDate,
      start:startDate,
    })

  })

  return {
    days,
    time,
    repeat,
    endDate,
    interval,
    startDate,
    onChangeVal,
  }

}