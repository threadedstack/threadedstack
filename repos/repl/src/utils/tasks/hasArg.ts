export const hasArg = (inputs: string[], name: string, alias: string[]) => {
  const prefixed = `--${name}`
  const short = alias.map((al) => `-${al}`)
  return Boolean(
    inputs.find((input) => input === prefixed || short.find((sh) => input === sh))
  )
}
