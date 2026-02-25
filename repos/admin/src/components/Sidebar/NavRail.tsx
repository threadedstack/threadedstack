import type { ReactNode } from 'react'
import type { TNavCtx, TNavItem, TRailSection, TRailSectionId } from '@TAF/types'

import { styled } from '@mui/material'
import { cls } from '@keg-hub/jsutils/cls'
import { colors, cmx } from '@tdsk/components'
import { isFunc } from '@keg-hub/jsutils/isFunc'
import { useNavigate, useLocation } from 'react-router'
import { NavRailWidth, NavRailExpandedWidth } from '@TAF/constants/values'
import { Box, Tooltip, Typography, ListItemIcon, ListItemButton } from '@mui/material'

type TRailItem = {
  label: string
  Icon: ReactNode
  active?: boolean
  onClick: () => void
}

type TRailNavItem = {
  item: TNavItem
  context: TNavCtx
}

export type TNavRail = {
  context: TNavCtx
  sections: TRailSection[]
  bottomItems: TNavItem[]
  activeSection: TRailSectionId | null
  onSectionClick: (id: TRailSectionId) => void
}

const IconRailWrapper = styled(Box)({
  width: NavRailWidth,
  minWidth: NavRailWidth,
  flexShrink: 0,
  position: `relative`,
})

const IconRailBox = styled(Box)(({ theme }) => ({
  position: `absolute`,
  top: 0,
  left: 0,
  bottom: 0,
  display: `flex`,
  overflowY: `auto`,
  overflowX: `hidden`,
  width: NavRailWidth,
  flexDirection: `column`,
  alignItems: `flex-start`,
  borderRight: `1px solid ${theme.palette.divider}`,
  backgroundColor: theme.palette.background.header,
  zIndex: theme.zIndex.drawer,
  transition: theme.transitions.create([`width`], {
    easing: theme.transitions.easing.easeInOut,
    duration: 500,
  }),
  [`&:hover`]: {
    width: NavRailExpandedWidth,
    [`& .tdsk-rail-item-text`]: {
      opacity: 1,
      width: `auto`,
      visibility: `visible`,
    },
    [`& .tdsk-logo-text`]: {
      opacity: 1,
      width: `auto`,
      visibility: `visible`,
    },
  },
  [`& .tdsk-rail-item`]: {
    paddingLeft: theme.gutter.rpx,
  },
  [`& .tdsk-rail-item-text`]: {
    opacity: 0,
    visibility: `hidden`,
    whiteSpace: `nowrap`,
    transition: `opacity 0.35s ease 0.15s`,
  },
  [`& .tdsk-logo-text`]: {
    opacity: 0,
    visibility: `hidden`,
    transition: `opacity 0.35s ease 0.15s`,
  },
}))

const RailItem = (props: TRailItem) => {
  const { Icon, label, active, onClick } = props

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
      <ListItemButton
        onClick={onClick}
        className={cls(`tdsk-rail-item`, active && `active`)}
        sx={{
          py: 1,
          gap: 1,
          px: 1.5,
          mb: 1,
          minHeight: 40,
          borderRadius: 0,
          justifyContent: `flex-start`,
          color: active ? colors.primary.main : `text.secondary`,
          backgroundColor: active ? cmx(colors.grey[500], 5) : `transparent`,
          '&:hover': {
            backgroundColor: cmx(colors.grey[500], 5),
          },
        }}
      >
        <ListItemIcon
          className='tdsk-rail-item-icon'
          sx={{
            minWidth: 0,
            color: `inherit`,
            '& svg': { fontSize: 20 },
          }}
        >
          {Icon}
        </ListItemIcon>
        <Typography
          noWrap
          variant='body2'
          className='tdsk-rail-item-text'
          sx={{ fontSize: 13, color: `inherit` }}
        >
          {label}
        </Typography>
      </ListItemButton>
    </Tooltip>
  )
}

const RailNavItem = (props: TRailNavItem) => {
  const { item, context } = props

  const location = useLocation()
  const navigate = useNavigate()

  if (item.visible && !item.visible(context)) return null

  const resolvedPath = isFunc(item.to) ? item.to(context) : item.to
  const isActive = resolvedPath ? location.pathname === resolvedPath : false

  return (
    <RailItem
      Icon={item.Icon}
      active={isActive}
      label={item.text as string}
      onClick={() => resolvedPath && navigate(resolvedPath)}
    />
  )
}

export const NavRail = (props: TNavRail) => {
  const { context, sections, bottomItems, activeSection, onSectionClick } = props

  return (
    <IconRailWrapper>
      <IconRailBox
        className='tdsk-icon-rail'
        sx={{
          '&:hover': {
            '--rail-tooltip-display': `none`,
          },
        }}
      >
        <Box sx={{ width: `100%`, flex: 1 }}>
          {sections.map((section) => {
            if (section.visible && !section.visible(context)) return null

            return (
              <RailItem
                key={section.id}
                Icon={section.Icon}
                label={section.label}
                active={activeSection === section.id}
                onClick={() => onSectionClick(section.id)}
              />
            )
          })}
        </Box>

        <Box flex={1} />

        <Box sx={{ width: `100%` }}>
          {bottomItems.map((item) => (
            <RailNavItem
              key={isFunc(item.to) ? String(item.text) : (item.to as string)}
              item={item}
              context={context}
            />
          ))}
        </Box>
      </IconRailBox>
    </IconRailWrapper>
  )
}
