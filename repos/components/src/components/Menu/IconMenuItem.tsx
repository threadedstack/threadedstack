import type { SxProps } from '@mui/material'

import Box from '@mui/material/Box'
import { styled } from '@mui/material/styles'
import Typography from '@mui/material/Typography'
import React, { forwardRef, RefObject } from 'react'
import MenuItem, { MenuItemProps } from '@mui/material/MenuItem'

const StyledMenuItem = styled(MenuItem)({
  display: 'flex',
  justifyContent: 'space-between',
  paddingLeft: '4px',
  paddingRight: '4px',
})

const StyledTypography = styled(Typography)({
  paddingLeft: '8px',
  paddingRight: '8px',
  textAlign: 'left',
})

const FlexBox = styled(Box)({
  display: 'flex',
})

type IconMenuItemProps = {
  sx?: SxProps
  label?: string
  className?: string
  disabled?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
  MenuItemProps?: MenuItemProps
  ref?: RefObject<HTMLLIElement>
  renderLabel?: () => React.ReactNode
  onClick?: (event: React.MouseEvent<HTMLElement>) => void
}

export const IconMenuItem = forwardRef<HTMLLIElement, IconMenuItemProps>(
  function IconMenuItem(
    { MenuItemProps, className, label, leftIcon, renderLabel, rightIcon, ...props },
    ref
  ) {
    return (
      <StyledMenuItem
        {...MenuItemProps}
        ref={ref}
        className={className}
        {...props}
      >
        <FlexBox>
          {leftIcon}
          {renderLabel ? renderLabel() : <StyledTypography>{label}</StyledTypography>}
        </FlexBox>
        {rightIcon}
      </StyledMenuItem>
    )
  }
)
