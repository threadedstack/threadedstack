export const loggerColorDisabled = () => {
  return (
    process.env.TDSK_TEST_COLORS === `0` ||
    (process.env.TDSK_TEST_COLORS || ``).toLowerCase().startsWith(`f`)
  )
}

export const stripColors = (str: string) => {
  return loggerColorDisabled() ? str.replace(/\x1b\[.*?m/g, ``) : str
}
