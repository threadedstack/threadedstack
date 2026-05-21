import Box from '@mui/material/Box'
import { styled } from '@mui/material/styles'
import InputBase from '@mui/material/InputBase'
import { FileTreeWidth, MonoFont } from '@TTH/constants/values'

export const FileTreeContainer = styled(Box, {
  shouldForwardProp: (prop) => prop !== `hidden`,
})<{ hidden?: boolean }>(({ theme, hidden }) => ({
  flexShrink: 0,
  height: `100%`,
  display: `flex`,
  overflow: `hidden`,
  flexDirection: `column`,
  opacity: hidden ? 0 : 1,
  width: hidden ? 0 : FileTreeWidth,
  pointerEvents: hidden ? `none` : `auto`,
  backgroundColor: theme.palette.background.paper,
  borderRight: hidden ? `none` : `1px solid ${theme.palette.divider}`,
  transition: [
    theme.transitions.create(`width`, {
      duration: 320,
      easing: `cubic-bezier(0.4, 0, 0.2, 1)`,
    }),
    theme.transitions.create(`opacity`, {
      duration: 240,
      easing: `cubic-bezier(0.4, 0, 0.2, 1)`,
    }),
  ].join(`, `),
}))

export const FileTreeHeader = styled(Box)(({ theme }) => ({
  height: 50,
  flexShrink: 0,
  display: `flex`,
  paddingLeft: 14,
  paddingRight: 8,
  alignItems: `center`,
  borderBottom: `1px solid ${theme.palette.divider}`,
}))

export const FileTreeHeaderLabel = styled(Box)(({ theme }) => ({
  flex: 1,
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: `0.08em`,
  textTransform: `uppercase` as const,
  color: theme.palette.text.secondary,
  userSelect: `none` as const,
}))

export const FileTreeSearch = styled(InputBase)(({ theme }) => ({
  fontSize: 12,
  borderRadius: 6,
  margin: `4px 8px`,
  padding: `4px 10px`,
  fontFamily: MonoFont,
  backgroundColor: theme.palette.action.hover,
  [`& .MuiInputBase-input`]: {
    padding: 0,
    height: 24,
  },
}))

export const FileTreeList = styled(Box)({
  flex: 1,
  padding: `4px 0`,
  overflowY: `auto`,
  overflowX: `hidden`,
})

export const FileTreeRow = styled(Box, {
  shouldForwardProp: (prop) => prop !== `active` && prop !== `depth`,
})<{ active?: boolean; depth?: number }>(({ theme, active, depth = 0 }) => ({
  display: `flex`,
  alignItems: `center`,
  gap: 6,
  paddingTop: 4,
  paddingBottom: 4,
  paddingRight: 8,
  paddingLeft: 6 + (depth ?? 0) * 14,
  borderRadius: 4,
  marginLeft: 4,
  marginRight: 4,
  cursor: `pointer`,
  userSelect: `none` as const,
  backgroundColor: active ? theme.palette.action.selected : `transparent`,
  [`&:hover`]: {
    backgroundColor: active ? theme.palette.action.selected : theme.palette.action.hover,
  },
}))

export const FileTreeFileName = styled(Box)({
  flex: 1,
  fontSize: 12,
  fontFamily: MonoFont,
  whiteSpace: `nowrap` as const,
  overflow: `hidden`,
  textOverflow: `ellipsis`,
  lineHeight: 1.5,
})

export const OpenFileDot = styled(Box)(({ theme }) => ({
  width: 6,
  height: 6,
  flexShrink: 0,
  borderRadius: `50%`,
  backgroundColor: theme.palette.primary.main,
}))
