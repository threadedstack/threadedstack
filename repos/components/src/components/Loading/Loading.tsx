import type { SxProps, Theme } from '@mui/material'
import type { ComponentProps, ReactNode } from 'react'

import { Text } from '@TSC/components/Text'
import { gutter } from '@TSC/theme'
import { cls } from '@keg-hub/jsutils/cls'
import { emptyObj } from '@keg-hub/jsutils/emptyObj'
import Box from '@mui/material/Box'
import CircularProgress from '@mui/material/CircularProgress'

export type TLoading = ComponentProps<typeof CircularProgress> & {
  message?: ReactNode
  full?: boolean
  fixed?: boolean
  centered?: boolean
  hideSpinner?: boolean
  messageSx?: SxProps | SxProps[]
  containerSx?: SxProps | SxProps[]
  textVariant?: `h1` | `h2` | `h3` | `h4` | `h5` | `h6` | `body1` | `body2`
  pos?: `before` | `after`
}

const styles = {
  full: {
    width: `100%`,
    height: `100%`,
    display: `flex`,
    alignItems: `center`,
    justifyContent: `center`,
  },
  fullNoFix: {
    flexDirection: `column`,
  },
  fixed: {
    top: `0`,
    left: `0`,
    right: `0`,
    bottom: `0`,
    position: `fixed`,
  },
  container: {
    width: `100%`,
    height: `100%`,
    textAlign: `center`,
  },
  message: {
    width: `100%`,
    fontSize: `18px`,
    marginTop: gutter.px,
  },
}

export const Loading = (props: TLoading) => {
  const {
    full,
    fixed,
    message,
    messageSx,
    hideSpinner,
    containerSx,
    pos = `after`,
    textVariant = `h6`,
    ...progProps
  } = props

  return (
    <Box
      className={cls(`tdsk-loading-container`, full && `full`, fixed && `fixed`)}
      sx={
        [
          styles.container,
          containerSx,
          full ? styles.full : emptyObj,
          fixed ? styles.fixed : full ? styles.fullNoFix : emptyObj,
        ] as SxProps<Theme>
      }
    >
      {message && pos !== `after` && (
        <Text
          variant={textVariant}
          className='tdsk-loading-text before'
          sx={[styles.message, messageSx] as SxProps<Theme>}
        >
          {message}
        </Text>
      )}
      {!hideSpinner && <CircularProgress {...progProps} />}
      {message && pos === `after` && (
        <Text
          variant={textVariant}
          className='tdsk-loading-text after'
          sx={[styles.message, messageSx] as SxProps<Theme>}
        >
          {message}
        </Text>
      )}
    </Box>
  )
}
