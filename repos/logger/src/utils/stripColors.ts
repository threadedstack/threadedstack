
export const loggerColorDisabled = () => {
  const noColors = process.env.TDSK_TEST_COLORS === `0`
    || (process.env.TDSK_TEST_COLORS || ``).toLowerCase().startsWith(`f`)

  return noColors
}
 
export const stripColors = (str:string) => {
  return loggerColorDisabled()
    ? str.replace(/\u001b\[.*?m/g, ``).replace(/\x1B\[.*?m/g, ``)
    : str
}
