const Sec = 1000
const Min = 60 * Sec
const Hour = 60 * Min
const Day = 24 * Hour

/**
 * A compact, human relative time ("just now", "3m ago", "2h ago", "5d ago"),
 * falling back to an absolute short date past a week. `now` is injectable so the
 * feed's timestamps are deterministic in tests.
 *
 * Anything unparseable returns an empty string rather than "Invalid Date", so a
 * malformed row can never render garbage.
 */
export const relativeTime = (iso?: string, now: number = Date.now()): string => {
  if (!iso) return ``
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return ``

  const diff = now - t
  if (diff < 45 * Sec) return `just now`
  if (diff < Hour) return `${Math.max(1, Math.round(diff / Min))}m ago`
  if (diff < Day) return `${Math.round(diff / Hour)}h ago`
  if (diff < 7 * Day) return `${Math.round(diff / Day)}d ago`
  return new Date(t).toLocaleDateString(undefined, { month: `short`, day: `numeric` })
}

/** The full timestamp, for a tooltip on the relative time. */
export const absoluteTime = (iso?: string): string => {
  if (!iso) return ``
  const t = Date.parse(iso)
  return Number.isNaN(t) ? `` : new Date(t).toLocaleString()
}
