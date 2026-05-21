import type { ReactNode, MouseEvent } from 'react'

import Box from '@mui/material/Box'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import ListItemIcon from '@mui/material/ListItemIcon'
import ChevronRight from '@mui/icons-material/ChevronRight'
import { RailItemButton } from '@TSC/components/NavRail/NavRail.styles'

export type TNavRailItem = {
  label: string
  depth?: number
  open?: boolean
  icon: ReactNode
  active?: boolean
  trail?: ReactNode
  className?: string
  onClick?: () => void
  hasChildren?: boolean
  onToggle?: (evt: MouseEvent) => void
}

export const NavRailItem = (props: TNavRailItem) => {
  const {
    icon,
    label,
    open,
    trail,
    active,
    onClick,
    onToggle,
    depth = 0,
    className,
    hasChildren,
  } = props

  const iconSize = depth > 0 ? 16 : 20
  const fontSize = depth > 0 ? `12px` : `13px`

  const item = (
    <RailItemButton
      depth={depth}
      active={active}
      onClick={onClick}
      className={`tdsk-rail-item ${className ?? ``} ${active ? `active` : ``}`}
    >
      <ListItemIcon
        className='tdsk-rail-item-icon'
        sx={{
          minWidth: 0,
          color: `inherit`,
          '& svg': { fontSize: iconSize },
        }}
      >
        {icon}
      </ListItemIcon>
      <Typography
        noWrap
        variant='body2'
        className='tdsk-rail-item-text'
        sx={{
          flex: 1,
          fontSize,
          color: `inherit`,
          fontWeight: depth > 0 ? 400 : 500,
        }}
      >
        {label}
      </Typography>
      {trail}
      {hasChildren && (
        <Box
          className='tdsk-rail-item-text'
          onClick={(evt: MouseEvent) => {
            evt.stopPropagation()
            onToggle?.(evt)
          }}
          sx={{
            width: 20,
            height: 20,
            flexShrink: 0,
            display: `flex`,
            cursor: `pointer`,
            borderRadius: `4px`,
            alignItems: `center`,
            justifyContent: `center`,
            transition: `background-color 0.15s ease`,
            '&:hover': {
              backgroundColor: `action.hover`,
            },
          }}
        >
          <ChevronRight
            sx={{
              fontSize: depth > 0 ? 14 : 16,
              color: `text.disabled`,
              transition: `transform 0.2s ease`,
              transform: open ? `rotate(90deg)` : `rotate(0deg)`,
            }}
          />
        </Box>
      )}
    </RailItemButton>
  )

  if (depth > 0) return item

  return (
    <Tooltip
      title={label}
      placement='right'
      enterDelay={600}
      slotProps={{
        popper: {
          sx: {
            [`& .MuiTooltip-tooltip`]: {
              display: `var(--rail-tooltip-display, block)`,
            },
          },
        },
      }}
    >
      {item}
    </Tooltip>
  )
}
