import type winston from 'winston'
import type { levels, levelMap } from '../utils/levels'

export type TColorMap = {
  black: string
  red: string
  green: string
  yellow: string
  blue: string
  magenta: string
  cyan: string
  white: string
  gray: string
  crimson: string
  reset: string
  bright: string
  dim: string
  underline: string
  blink: string
  reverse: string
  hidden: string
}

export type TColorTextFunc = (...args: any[]) => string

export type TColorText = {
  red: TColorTextFunc
  blue: TColorTextFunc
  gray: TColorTextFunc
  cyan: TColorTextFunc
  green: TColorTextFunc
  yellow: TColorTextFunc
  magenta: TColorTextFunc
}

export type TColorTextMapFunc = TColorText & {
  white: TColorTextFunc
  brightRed: TColorTextFunc
  brightCyan: TColorTextFunc
  brightBlue: TColorTextFunc
  brightWhite: TColorTextFunc
  brightGreen: TColorTextFunc
  brightYellow: TColorTextFunc
  brightMagenta: TColorTextFunc
}

export type TLogColors = TColorTextMapFunc & {
  colorMap: TColorMap
  underline: Record<keyof TColorMap, (data: any) => any>
}

export type TLogMethod = (...args: any[]) => void

export type TLogMethods = {
  [K in keyof typeof levelMap]: TLogMethod
}

export type TLogLevels = {
  check: (lvl: string | number) => boolean
  levels: Record<string | number, string | number>
  compare: (lvl1: string | number, lvl2: string | number) => boolean
}

export type TLevelLogger = {
  [K: keyof (typeof levels)[`levels`]]: TLogMethod
}

export type TUtilLogger = {
  clear: () => void
  empty: () => void
  log: TLogMethod
  dir: TLogMethod
  text: TLogMethod
  label: TLogMethod
  print: TLogMethod
  table: TLogMethod
  pair: TLogMethod
  data: TLogMethod
  header: TLogMethod
  spaceMsg: TLogMethod
  subHeader: TLogMethod
  spacedMsg: TLogMethod
  highlight: TLogMethod
  stdout: (msg: string) => void
  stderr: (msg: string) => void
}

export type TStateLogger = {
  fail: TLogMethod
  info: TLogMethod
  warn: TLogMethod
  error: TLogMethod
  success: TLogMethod
}

export type TTagLogger = {
  tag: boolean
  removeTag: () => void
  setTag: (tag: string) => void
  toggleTag: (toggle: boolean) => void
}

export type TCLILogger = TLevelLogger &
  TUtilLogger &
  TStateLogger &
  TTagLogger & {} & {
    levels: TLogLevels
    level: string | number

    stdout: (msg: string) => void
    stderr: (msg: string) => void

    colors: TLogColors
    color: (msg: string) => string
    colorMap: Record<string, string>
  }

export type TWinLogger = winston.Logger

export type TLogOpts = winston.LoggerOptions & {
  label: string
}

export type TWLogger = TWinLogger & {}

export type TSetupLogger = Omit<TLogOpts, `label`> & {
  tag?: string
  label?: string
}
