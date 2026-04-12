import { AnsiRegEx } from '@TDM/constants/parser'

export const stripAnsi = (str: string): string => str.replace(AnsiRegEx, '')
