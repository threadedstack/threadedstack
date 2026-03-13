const msgBgColors: Record<string, string> = {
  user: `primary.main`,
  assistant: `grey.700`,
  tool: `warning.main`,
  system: `grey.500`,
}

export const msgBgColor = (type: string) => msgBgColors[type] || `grey.600`

export const msgTypeColor = (type: string) => {
  switch (type) {
    case `user`:
      return `primary`
    case `assistant`:
      return `success`
    case `tool`:
      return `warning`
    case `system`:
      return `default`
    case `action`:
      return `info`
    default:
      return `default`
  }
}
