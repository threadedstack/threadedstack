import type { CSSProperties } from 'react'

import { useMemo } from 'react'
import { styled } from '@mui/material/styles'
import { exists } from '@keg-hub/jsutils/exists'
import { emptyObj } from '@keg-hub/jsutils/emptyObj'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'

const ExpMoreIcon = styled(ExpandMoreIcon)`
  transition: transform 300ms;
`

export type TIconDirection = `up` | `left` | `right` | `down`

export type TExpandIcon = {
  expand?: boolean
  className?: string
  transformOn?: number
  transformOff?: number
  openDir?: TIconDirection
  closedDir?: TIconDirection
  noIconTransform?: boolean
  sx?: CSSProperties | CSSProperties[]
}

const iconDirMap = {
  up: `rotate(-180deg) !important`,
  down: `rotate(0deg) !important`,
  right: `rotate(90deg) !important`,
  left: `rotate(-90deg) !important`,
}

export const ExpandIcon = (props: TExpandIcon) => {
  const {
    sx,
    expand,
    className,
    transformOn,
    transformOff,
    openDir = `right`,
    closedDir = `down`,
    noIconTransform,
  } = props

  const style = useMemo(() => {
    if (noIconTransform) return emptyObj

    const isExpanded = expand || className?.split(' ').includes(`expanded`)

    return exists(transformOn) || exists(transformOff)
      ? { transform: `rotate(${isExpanded ? transformOn : transformOff}deg);` }
      : { transform: iconDirMap[isExpanded ? openDir : closedDir] }
  }, [expand, openDir, closedDir, className, transformOn, transformOff, noIconTransform])

  return (
    <ExpMoreIcon
      sx={[sx, style]}
      className={className}
    />
  )
}
