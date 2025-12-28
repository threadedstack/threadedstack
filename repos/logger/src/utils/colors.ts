const colorMap = {
  black: `\x1b[30m`,
  red: `\x1b[31m`,
  green: `\x1b[32m`,
  yellow: `\x1b[33m`,
  blue: `\x1b[34m`,
  magenta: `\x1b[35m`,
  cyan: `\x1b[36m`,
  white: `\x1b[37m`,
  gray: `\x1b[90m`,
  crimson: `\x1b[38m`,
  reset: `\x1b[0m`,
  bright: `\x1b[1m`,
  dim: `\x1b[2m`,
  underline: `\x1b[4m`,
  blink: `\x1b[5m`,
  reverse: `\x1b[7m`,
  hidden: `\x1b[8m`,
}

const addColor = (...args:string[]) => `${args.join(``)}${colorMap.reset}`

const colorsFuncs = {
  colorMap,
  red: (log:string) => addColor(colorMap.red, log),
  blue: (log:string) => addColor(colorMap.blue, log),
  gray: (log:string) => addColor(colorMap.gray, log),
  cyan: (log:string) => addColor(colorMap.cyan, log),
  green: (log:string) => addColor(colorMap.green, log),
  white: (log:string) => addColor(colorMap.white, log),
  yellow: (log:string) => addColor(colorMap.yellow, log),
  magenta: (log:string) => addColor(colorMap.magenta, log),
  brightRed: (log:string) => addColor(colorMap.bright, colorMap.red, log),
  brightBlue: (log:string) => addColor(colorMap.bright, colorMap.blue, log),
  brightGray: (log:string) => addColor(colorMap.bright, colorMap.gray, log),
  brightCyan: (log:string) => addColor(colorMap.bright, colorMap.cyan, log),
  brightWhite: (log:string) => addColor(colorMap.bright, colorMap.white, log),
  brightGreen: (log:string) => addColor(colorMap.bright, colorMap.green, log),
  brightYellow: (log:string) => addColor(colorMap.bright, colorMap.yellow, log),
  brightMagenta: (log:string) => addColor(colorMap.bright, colorMap.magenta, log),
}

export const colors = {
  ...colorsFuncs,
  addColor,
  underline: Object.keys(colorsFuncs).reduce((acc, key) => {
    acc[key] = (log:any) => addColor(colorMap.underline, colorsFuncs[key](log))

    return acc
  }, {}),

  dim: Object.keys(colorsFuncs).reduce((acc, key) => {
    acc[key] = (log:any) => addColor(colorMap.dim, colorsFuncs[key](log))

    return acc
  }, {})
}




