export const formatUptime = (date?: string | Date): string => {
  if (!date) return `-`
  const d = typeof date === `string` ? new Date(date) : date
  if (Number.isNaN(d.getTime())) return `-`
  const diffMs = Date.now() - d.getTime()
  const totalMin = Math.floor(diffMs / 60_000)
  if (totalMin < 1) return `< 1m`
  if (totalMin < 60) return `${totalMin}m`
  const hrs = Math.floor(totalMin / 60)
  const mins = totalMin % 60
  if (hrs < 24) return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`
  const days = Math.floor(hrs / 24)
  const remHrs = hrs % 24
  return remHrs > 0 ? `${days}d ${remHrs}h` : `${days}d`
}
