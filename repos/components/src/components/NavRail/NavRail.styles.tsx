import Box from '@mui/material/Box'
import { dims } from '@TSC/theme/dims'
import { cmx } from '@TSC/theme/helpers'
import { colors } from '@TSC/theme/colors'
import { styled } from '@mui/material/styles'
import ListItemButton from '@mui/material/ListItemButton'

const railW = dims.navRail.width
const expandedW = dims.navRail.expandedWidth

export const RailWrapper = styled(Box)({
  width: railW,
  flexShrink: 0,
  minWidth: railW,
  position: `relative`,
})

export const RailBox = styled(Box, {
  shouldForwardProp: (prop) => prop !== `expandedWidth`,
})<{ expandedWidth?: number }>(({ theme, expandedWidth }) => ({
  position: `absolute`,
  top: 0,
  left: 0,
  bottom: 0,
  width: railW,
  display: `flex`,
  overflowY: `auto`,
  overflowX: `hidden`,
  flexDirection: `column`,
  alignItems: `flex-start`,
  zIndex: theme.zIndex.drawer,
  borderRight: `1px solid ${theme.palette.divider}`,
  backgroundColor: theme.palette.background.header,
  transition: theme.transitions.create([`width`], {
    easing: theme.transitions.easing.easeInOut,
    duration: 500,
  }),
  [`&:hover`]: {
    width: expandedWidth ?? expandedW,
    [`& .tdsk-rail-item-text`]: {
      opacity: 1,
      width: `auto`,
      visibility: `visible`,
    },
    [`& .tdsk-rail-section-label`]: {
      opacity: 1,
      visibility: `visible`,
    },
    [`& .tdsk-rail-child-items`]: {
      opacity: 1,
      maxHeight: 2000,
      overflow: `visible`,
    },
  },
  [`& .tdsk-rail-item-text`]: {
    opacity: 0,
    visibility: `hidden`,
    whiteSpace: `nowrap`,
    transition: `opacity 0.35s ease 0.15s`,
  },
  [`& .tdsk-rail-section-label`]: {
    opacity: 0,
    visibility: `hidden`,
    transition: `opacity 0.35s ease 0.18s`,
  },
  [`& .tdsk-rail-child-items`]: {
    opacity: 0,
    maxHeight: 0,
    overflow: `hidden`,
    transition: `max-height 0.35s ease 0.1s, opacity 0.35s ease 0.15s`,
  },
}))

export const RailItemButton = styled(ListItemButton, {
  shouldForwardProp: (prop) => prop !== `active` && prop !== `depth`,
})<{ active?: boolean; depth?: number }>(({ theme, active, depth = 0 }) => ({
  py: 1,
  gap: 8,
  borderRadius: 0,
  paddingRight: 12,
  justifyContent: `flex-start`,
  paddingTop: depth > 0 ? 4 : 8,
  minHeight: depth > 0 ? 32 : 40,
  marginBottom: depth > 0 ? 0 : 4,
  paddingBottom: depth > 0 ? 4 : 8,
  paddingLeft: depth > 0 ? 12 + depth * 12 : 12,
  borderLeft: `3px solid transparent`,
  color: active ? colors.primary.main : theme.palette.text.secondary,
  backgroundColor: active ? cmx(colors.grey[500], 5) : `transparent`,
  transition: theme.transitions.create([`background-color`, `border-color`, `color`], {
    duration: 150,
  }),
  '&:hover': {
    backgroundColor: cmx(colors.grey[500], 5),
  },
}))
