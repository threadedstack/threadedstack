import type { TAvatarSize } from '@TSC/types'
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

export const SizeMap: Record<TAvatarSize, number> = {
  sm: 20,
  md: 32,
  lg: 40,
  xl: 48,
}

export const FontSizeMap: Record<TAvatarSize, number> = {
  sm: 9,
  md: 12,
  lg: 14,
  xl: 16,
}

export const SkeletonWidths = [`60%`, `40%`, `75%`, `50%`, `45%`, `70%`, `35%`, `55%`]
