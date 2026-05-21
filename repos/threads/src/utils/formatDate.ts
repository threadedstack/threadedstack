export const formatRelativeDate = (date: Date | string | undefined): string => {
  if (!date) return `-`
  const d = typeof date === `string` ? new Date(date) : date
  if (isNaN(d.getTime())) return `-`
  const now = Date.now()
  const diff = now - d.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return `just now`
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return d.toLocaleDateString(`en-US`, {
    month: `short`,
    day: `numeric`,
    year: `numeric`,
  })
}

export const formatDate = (date: Date | string | undefined): string => {
  if (!date) return `-`
  const d = typeof date === `string` ? new Date(date) : date
  if (isNaN(d.getTime())) return `-`
  return d.toLocaleDateString(`en-US`, {
    month: `short`,
    day: `numeric`,
    year: `numeric`,
  })
}

export const formatTimestamp = (date: Date | string | undefined): string => {
  if (!date) return `-`
  const d = typeof date === `string` ? new Date(date) : date
  if (isNaN(d.getTime())) return `-`
  return d.toLocaleString(`en-US`, {
    month: `short`,
    day: `numeric`,
    hour: `numeric`,
    minute: `2-digit`,
  })
}
