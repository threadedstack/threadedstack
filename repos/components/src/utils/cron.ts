import { ERepeatType } from '@TSC/types'
import { DaysOfWeek } from '@TSC/constants/elements'

export type TCronToStr = {
  days: string[]
  time: string
  interval: number
  repeat: ERepeatType
}

export const parseCron = (cron: string) => {
  const parts = cron.split(` `)
  if (parts.length !== 6) return null

  const hours = parts[2]
  const minutes = parts[1]
  const days =
    parts[5] !== `*`
      ? parts[5].split(`,`).map((d) => DaysOfWeek[Number.parseInt(d, 10)])
      : []

  let interval = 1
  let repeat = ERepeatType.daily

  if (parts[1].startsWith(`*/`)) {
    repeat = ERepeatType.minute
    interval = Number.parseInt(parts[1].slice(2), 10)
  } else if (parts[2].startsWith(`*/`)) {
    repeat = ERepeatType.hourly
    interval = Number.parseInt(parts[2].slice(2), 10)
  } else if (parts[3].startsWith(`*/`)) {
    repeat = ERepeatType.daily
    interval = Number.parseInt(parts[3].slice(2), 10)
  } else if (parts[5] !== `*`) {
    repeat = ERepeatType.weekly
  } else if (parts[4].startsWith(`*/`)) {
    repeat = ERepeatType.monthly
    interval = Number.parseInt(parts[4].slice(2), 10)
  } else if (parts[4] === `1` && parts[3] === `1`) {
    repeat = ERepeatType.yearly
  }

  return {
    days,
    repeat,
    interval,
    time: `${hours.padStart(2, `0`)}:${minutes.padStart(2, `0`)}`,
  }
}

export const cronToString = (props: TCronToStr): string => {
  const { days, time, repeat, interval } = props

  const [hours, minutes] = time.split(`:`)
  let cron = `0 ${minutes} ${hours} * * *`

  switch (repeat) {
    case ERepeatType.minute:
      cron = `*/${interval} * * * * *`
      break
    case ERepeatType.hourly:
      cron = `0 */${interval} * * * *`
      break
    case ERepeatType.daily:
      cron = `0 ${minutes} ${hours} */${interval} * *`
      break
    case ERepeatType.weekly:
      const sdays =
        days.length > 0 ? days.map((day) => DaysOfWeek.indexOf(day)).join(`,`) : `*`
      cron = `0 ${minutes} ${hours} * * ${sdays}`
      break
    case ERepeatType.monthly:
      cron = `0 ${minutes} ${hours} 1 */${interval} *`
      break
    case ERepeatType.yearly:
      cron = `0 ${minutes} ${hours} 1 1 */${interval}`
      break
  }

  return cron
}
