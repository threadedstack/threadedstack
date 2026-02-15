import type { ReactNode } from 'react'
import type { SxProps } from '@mui/material'
import type { DrawerProps as MuiDrawerProps } from '@mui/material/Drawer'

import { cls } from '@keg-hub/jsutils'
import MuiBox from '@mui/material/Box'
import MuiDrawer from '@mui/material/Drawer'
import { styled } from '@mui/material/styles'
import MuiIconButton from '@mui/material/IconButton'
import { Close as CloseIcon } from '@mui/icons-material'

const StyledDrawer = styled(MuiDrawer)(({ theme }) => ({
  [`& .MuiDrawer-paper`]: {
    width: `100%`,
    padding: 0,
    [`--Paper-overlay`]: `none !important`,
    backgroundColor: theme.palette.background.paper,
    [theme.breakpoints.up(`sm`)]: {
      width: `90%`,
    },
    [theme.breakpoints.up(`md`)]: {
      width: `800px`,
      maxWidth: `75%`,
    },
    [theme.breakpoints.up(`lg`)]: {
      width: `1000px`,
    },
  },
}))

const DrawerHeader = styled(MuiBox)(({ theme }) => ({
  display: `flex`,
  minHeight: `64px`,
  alignItems: `center`,
  justifyContent: `space-between`,
  padding: `${theme.gutter.px} ${theme.gutter.mpx}`,
  backgroundColor: theme.palette.background.header,
  borderBottom: `1px solid ${theme.palette.divider}`,
}))

const DrawerTitle = styled(MuiBox)(({ theme }) => ({
  display: `flex`,
  fontWeight: 600,
  fontSize: `1.25rem`,
  alignItems: `center`,
  gap: theme.spacing(1.5),
  color: theme.palette.text.primary,
}))

const DrawerContent = styled(MuiBox)(({ theme }) => ({
  flex: 1,
  overflowY: `auto`,
  padding: theme.gutter.mpx,
}))

const CloseButton = styled(MuiIconButton)(({ theme }) => ({
  color: theme.palette.text.secondary,
  [`&:hover`]: {
    backgroundColor: theme.palette.action.hover,
  },
}))

export type TDrawer = Omit<MuiDrawerProps, 'title' | 'anchor'> & {
  open: boolean
  title?: ReactNode
  titleSx?: SxProps
  headerSx?: SxProps
  contentSx?: SxProps
  actions?: ReactNode
  children?: ReactNode
  onClose?: () => void
  titleIcon?: ReactNode
  showCloseButton?: boolean
  className?: string | string[]
}

export const Drawer = (props: TDrawer) => {
  const {
    open,
    title,
    actions,
    onClose,
    titleSx,
    children,
    titleIcon,
    contentSx,
    headerSx,
    className,
    showCloseButton = true,
    ...drawerProps
  } = props

  return (
    <StyledDrawer
      closeAfterTransition={false}
      {...drawerProps}
      open={open}
      anchor='right'
      onClose={onClose}
      className={cls('tdsk-drawer', className)}
    >
      {(title || showCloseButton) && (
        <DrawerHeader
          className='tdsk-drawer-header'
          sx={headerSx}
        >
          {title && (
            <DrawerTitle
              className='tdsk-drawer-title'
              sx={titleSx}
            >
              {titleIcon}
              {title}
            </DrawerTitle>
          )}
          {showCloseButton && (
            <CloseButton
              onClick={onClose}
              className='tdsk-drawer-close'
              aria-label='Close drawer'
            >
              <CloseIcon />
            </CloseButton>
          )}
        </DrawerHeader>
      )}

      {children && (
        <DrawerContent
          className='tdsk-drawer-content'
          sx={contentSx}
        >
          {children}
        </DrawerContent>
      )}

      {actions}
    </StyledDrawer>
  )
}
