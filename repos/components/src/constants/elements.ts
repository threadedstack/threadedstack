import { ERepeatType } from '@TSC/types'

export const ElRenderMap: Record<string, string> = {
  json: `code`,
  [`application/json`]: `code`,
}

export const DaysOfWeek: string[] = [`Sun`, `Mon`, `Tue`, `Wed`, `Thu`, `Fri`, `Sat`]

export const RepeatOpts = [
  { label: `Minute`, value: ERepeatType.minute },
  { label: `Hourly`, value: ERepeatType.hourly },
  { label: `Daily`, value: ERepeatType.daily },
  { label: `Weekly`, value: ERepeatType.weekly },
  { label: `Monthly`, value: ERepeatType.monthly },
  { label: `Yearly`, value: ERepeatType.yearly },
]
