import { ERepeatType } from '@TSC/types'
import { DaysOfWeek } from '@TSC/constants/elements'

export type TCronToStr = {
  days: string[]
  time: string
  interval: number
  repeat: ERepeatType
}

const FieldRanges: [number, number][] = [
  [0, 59],
  [0, 23],
  [1, 31],
  [1, 12],
  [0, 6],
]

const isValidField = (field: string, [min, max]: [number, number]): boolean => {
  for (const part of field.split(`,`)) {
    const token = part.trim()
    if (token === `*`) continue

    if (token.includes(`/`)) {
      const [range, stepStr] = token.split(`/`)
      const step = Number.parseInt(stepStr, 10)
      if (Number.isNaN(step) || step <= 0) return false
      if (range !== `*`) {
        const val = Number.parseInt(range, 10)
        if (Number.isNaN(val) || val < min || val > max) return false
      }
      continue
    }

    if (token.includes(`-`)) {
      const [startStr, endStr] = token.split(`-`)
      const start = Number.parseInt(startStr, 10)
      const end = Number.parseInt(endStr, 10)
      if (Number.isNaN(start) || Number.isNaN(end)) return false
      if (start < min || end > max || start > end) return false
      continue
    }

    const val = Number.parseInt(token, 10)
    if (Number.isNaN(val) || val < min || val > max) return false
  }

  return true
}

export const isValidCron = (cron: string): boolean => {
  const parts = cron.trim().split(/\s+/)
  if (parts.length !== 5) return false
  return parts.every((part, i) => isValidField(part, FieldRanges[i]))
}

export const parseCron = (cron: string) => {
  const parts = cron.split(` `)
  if (parts.length !== 5 || !isValidCron(cron)) return null

  const minutes = parts[0].includes(`*`) ? `00` : parts[0]
  const hours = parts[1].includes(`*`) ? `00` : parts[1]
  const days =
    parts[4] !== `*`
      ? parts[4].split(`,`).map((d) => DaysOfWeek[Number.parseInt(d, 10)])
      : []

  let interval = 1
  let repeat = ERepeatType.daily

  if (parts[0].startsWith(`*/`)) {
    repeat = ERepeatType.minute
    interval = Number.parseInt(parts[0].slice(2), 10)
  } else if (parts[1].startsWith(`*/`)) {
    repeat = ERepeatType.hourly
    interval = Number.parseInt(parts[1].slice(2), 10)
  } else if (parts[2].startsWith(`*/`)) {
    repeat = ERepeatType.daily
    interval = Number.parseInt(parts[2].slice(2), 10)
  } else if (parts[4] !== `*`) {
    repeat = ERepeatType.weekly
  } else if (parts[3].startsWith(`*/`)) {
    repeat = ERepeatType.monthly
    interval = Number.parseInt(parts[3].slice(2), 10)
  } else if (parts[3] === `1` && parts[2] === `1`) {
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
  let cron = `${minutes} ${hours} * * *`

  switch (repeat) {
    case ERepeatType.minute:
      cron = `*/${interval} * * * *`
      break
    case ERepeatType.hourly:
      cron = `${minutes} */${interval} * * *`
      break
    case ERepeatType.daily:
      cron = `${minutes} ${hours} */${interval} * *`
      break
    case ERepeatType.weekly:
      const sdays =
        days.length > 0 ? days.map((day) => DaysOfWeek.indexOf(day)).join(`,`) : `*`
      cron = `${minutes} ${hours} * * ${sdays}`
      break
    case ERepeatType.monthly:
      cron = `${minutes} ${hours} 1 */${interval} *`
      break
    case ERepeatType.yearly:
      cron = `${minutes} ${hours} 1 1 *`
      break
  }

  return cron
}
