/**
 * Simple cron parser for 5-field cron expressions.
 * Supports: *, specific numbers, step values (x/N), comma-separated values, ranges (x-y)
 * Fields: minute hour dayOfMonth month dayOfWeek
 *
 * Shared home for cron evaluation: the backend scheduler (nextRunAt) and the
 * resident runtime's agenda both compute next-fire times through it.
 */

type TCronFields = {
  minutes: number[]
  hours: number[]
  daysOfMonth: number[]
  months: number[]
  daysOfWeek: number[]
}

const FIELD_RANGES: [number, number][] = [
  [0, 59], // minute
  [0, 23], // hour
  [1, 31], // day of month
  [1, 12], // month
  [0, 6], // day of week (0 = Sunday)
]

const DAY_NAMES: Record<string, number> = {
  SUN: 0,
  MON: 1,
  TUE: 2,
  WED: 3,
  THU: 4,
  FRI: 5,
  SAT: 6,
}

const MONTH_NAMES: Record<string, number> = {
  JAN: 1,
  FEB: 2,
  MAR: 3,
  APR: 4,
  MAY: 5,
  JUN: 6,
  JUL: 7,
  AUG: 8,
  SEP: 9,
  OCT: 10,
  NOV: 11,
  DEC: 12,
}

/**
 * Parse a single cron field into an array of matching values.
 */
function parseField(
  field: string,
  [min, max]: [number, number],
  names?: Record<string, number>
): number[] {
  const values = new Set<number>()

  for (const part of field.split(`,`)) {
    let token = part.trim().toUpperCase()

    // Replace named values (MON, JAN, etc.)
    if (names) {
      for (const [name, val] of Object.entries(names)) {
        token = token.replace(name, String(val))
      }
    }

    if (token === `*`) {
      for (let i = min; i <= max; i++) values.add(i)
    } else if (token.includes(`/`)) {
      const [rangeStr, stepStr] = token.split(`/`)
      const step = Number.parseInt(stepStr, 10)
      if (Number.isNaN(step) || step <= 0) continue

      let start = min
      let end = max
      if (rangeStr && rangeStr !== `*`) {
        if (rangeStr.includes(`-`)) {
          const [rs, re] = rangeStr.split(`-`)
          start = Number.parseInt(rs, 10)
          end = Number.parseInt(re, 10)
        } else {
          start = Number.parseInt(rangeStr, 10)
        }
      }

      for (let i = start; i <= end; i += step) values.add(i)
    } else if (token.includes(`-`)) {
      const [startStr, endStr] = token.split(`-`)
      const start = Number.parseInt(startStr, 10)
      const end = Number.parseInt(endStr, 10)
      if (!Number.isNaN(start) && !Number.isNaN(end)) {
        for (let i = start; i <= end; i++) values.add(i)
      }
    } else {
      const val = Number.parseInt(token, 10)
      if (!Number.isNaN(val) && val >= min && val <= max) values.add(val)
    }
  }

  return [...values].sort((a, b) => a - b)
}

/**
 * Parse a 5-field cron expression into arrays of valid values per field.
 */
function parseCron(expression: string): TCronFields {
  const parts = expression.trim().split(/\s+/)
  if (parts.length !== 5) throw new Error(`Cron expression must have exactly 5 fields`)

  return {
    minutes: parseField(parts[0], FIELD_RANGES[0]),
    hours: parseField(parts[1], FIELD_RANGES[1]),
    daysOfMonth: parseField(parts[2], FIELD_RANGES[2]),
    months: parseField(parts[3], FIELD_RANGES[3], MONTH_NAMES),
    daysOfWeek: parseField(parts[4], FIELD_RANGES[4], DAY_NAMES),
  }
}

/**
 * Validate that a cron expression is valid 5-field format.
 */
export function isValidCron(expression: string): boolean {
  try {
    const fields = parseCron(expression)
    return (
      fields.minutes.length > 0 &&
      fields.hours.length > 0 &&
      fields.daysOfMonth.length > 0 &&
      fields.months.length > 0 &&
      fields.daysOfWeek.length > 0
    )
  } catch {
    return false
  }
}

/**
 * Calculate the next run time from a cron expression.
 * Iterates forward from the given date (default: now) up to ~2 years to find the next match.
 */
export function parseNextRun(cronExpression: string, from?: Date): Date {
  const fields = parseCron(cronExpression)
  const date = from ? new Date(from) : new Date()

  // Standard cron: when both dayOfMonth and dayOfWeek are explicit (not *),
  // the match is OR (fire if either matches). When one is *, use AND.
  const parts = cronExpression.trim().split(/\s+/)
  const domExplicit = parts[2] !== `*`
  const dowExplicit = parts[4] !== `*`
  const useDayOr = domExplicit && dowExplicit

  // Start from the next minute
  date.setSeconds(0, 0)
  date.setMinutes(date.getMinutes() + 1)

  // Search up to ~2 years ahead (enough for any valid cron)
  const maxIterations = 366 * 24 * 60 * 2
  for (let i = 0; i < maxIterations; i++) {
    const month = date.getMonth() + 1 // 1-based
    const dayOfMonth = date.getDate()
    const dayOfWeek = date.getDay()
    const hour = date.getHours()
    const minute = date.getMinutes()

    const dayMatch = useDayOr
      ? fields.daysOfMonth.includes(dayOfMonth) || fields.daysOfWeek.includes(dayOfWeek)
      : fields.daysOfMonth.includes(dayOfMonth) && fields.daysOfWeek.includes(dayOfWeek)

    if (
      fields.months.includes(month) &&
      dayMatch &&
      fields.hours.includes(hour) &&
      fields.minutes.includes(minute)
    ) {
      return date
    }

    // Advance by 1 minute
    date.setMinutes(date.getMinutes() + 1)
  }

  throw new Error(
    `Cron expression "${cronExpression}" produced no match within 2 years from ${(from || new Date()).toISOString()}`
  )
}
