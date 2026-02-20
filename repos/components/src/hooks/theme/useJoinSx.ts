import type { SxProps, Theme } from '@mui/material'

import { emptyArr, ensureArr } from '@keg-hub/jsutils'
import { useMemo } from 'react'

export const useJoinSx = (...styles: (undefined | null | SxProps<Theme>)[]) => {
  return useMemo(
    () =>
      styles.reduce(
        (joined, style) => [
          ...ensureArr(joined),
          ...(style ? ensureArr(style) : emptyArr),
        ],
        [] as SxProps<Theme>[]
      ),
    styles
  )
}
