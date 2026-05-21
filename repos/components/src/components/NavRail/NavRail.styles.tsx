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
  minWidth: railW,
  flexShrink: 0,
  position: `relative`,
})

export const RailBox = styled(Box)(({ theme }) => ({
  position: `absolute`,
  top: 0,
  left: 0,
  bottom: 0,
  display: `flex`,
  overflowY: `auto`,
  overflowX: `hidden`,
  width: railW,
  flexDirection: `column`,
  alignItems: `flex-start`,
  borderRight: `1px solid ${theme.palette.divider}`,
  backgroundColor: theme.palette.background.header,
  zIndex: theme.zIndex.drawer,
  transition: theme.transitions.create([`width`, `box-shadow`], {
    easing: theme.transitions.easing.easeInOut,
    duration: 500,
  }),
  [`&:hover`]: {
    width: expandedW,
    boxShadow: theme.shadows[4],
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
      maxHeight: 2000,
      opacity: 1,
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
    maxHeight: 0,
    opacity: 0,
    overflow: `hidden`,
    transition: `max-height 0.35s ease 0.1s, opacity 0.35s ease 0.15s`,
  },
}))

export const RailItemButton = styled(ListItemButton, {
  shouldForwardProp: (prop) => prop !== `active` && prop !== `depth`,
})<{ active?: boolean; depth?: number }>(({ theme, active, depth = 0 }) => ({
  py: 1,
  gap: 8,
  paddingTop: depth > 0 ? 4 : 8,
  paddingBottom: depth > 0 ? 4 : 8,
  paddingLeft: depth > 0 ? 12 + depth * 12 : 12,
  paddingRight: 12,
  marginBottom: depth > 0 ? 0 : 4,
  minHeight: depth > 0 ? 32 : 40,
  borderRadius: 0,
  justifyContent: `flex-start`,
  borderLeft: active ? `3px solid ${colors.primary.main}` : `3px solid transparent`,
  color: active ? colors.primary.main : theme.palette.text.secondary,
  backgroundColor: active ? cmx(colors.primary.main, 8) : `transparent`,
  transition: theme.transitions.create([`background-color`, `border-color`, `color`], {
    duration: 150,
  }),
  '&:hover': {
    backgroundColor: cmx(colors.grey[500], 5),
  },
}))
