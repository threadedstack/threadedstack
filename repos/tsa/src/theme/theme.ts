import type { TThemeType, TThemeColors } from '@TSA/types'

import { EThemeType } from '@TSA/types'
import { colors } from '@TSA/theme/colors'

export class Theme {
  current: TThemeColors = colors.dark

  get = (type: TThemeType): TThemeColors => {
    if (type === EThemeType.light) return colors.light
    return colors.dark
  }

  set = (type: TThemeType): void => {
    this.current = this.get(type)
  }

  themed = (color: keyof TThemeColors, text: string): string => {
    if (process.env.NO_COLOR) return text
    return this.current[color](text)
  }
}
