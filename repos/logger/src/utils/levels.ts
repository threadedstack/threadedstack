import type { TLogMethods, TLogLevels, TCLILogger } from '../types'

import { config } from 'winston'
import {isNum, isStr, exists} from "./helpers"

export const npmLevels = config.npm.levels

export const levelMap = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  verbose: 4,
  debug: 5,
  silly: 6,
}

const resolveLevel = (level:string|number) => {
  if(isStr(level)) return resolveLevel(levelMap[level])
  if(isNum(level)){
    if(level > 6) return 6
    if(level < 0) return 0
    return level
  }
}

export const compare = (level1:string|number, level2:string|number) => {
  const lvl1 = resolveLevel(level1)
  const lvl2 = resolveLevel(level2)

  if(!exists(lvl1)) return false
  if(!exists(lvl2)) return true

  return lvl1 >= lvl2
}

export const levels:TLogLevels = Object.entries(levelMap)
  .reduce((acc, [level, num]) => {
    acc.levels[level] = num
    acc.levels[num] = level
    acc.check[level] = (lvl:string|number) => compare(lvl, num)

    return acc
  }, {
    compare,
    check: {},
    levels: {},
  } as TLogLevels)


export const getLevelMethods = (Logger:TCLILogger, logMethod:(...args:any[])=>void) => {
  return Object.entries(levelMap)
    .reduce((acc, [level, num]) => {
      acc[level] = (...args:any[]) => levels.check[level](Logger.level) && logMethod?.(...args)

      return acc
    }, {} as TLogMethods)
}
