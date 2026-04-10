export const hasArg = (inputs: string[], name: string, alias: string[]) => {
  const prefixed = `--${name}`
  const short = alias.map((al) => `-${al}`)
  return inputs.some((input) => input === prefixed || short.includes(input))
}
