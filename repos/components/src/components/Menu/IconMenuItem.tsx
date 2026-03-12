import type { SxProps } from '@mui/material'
import type { ReactNode, MouseEvent } from 'react'

import Box from '@mui/material/Box'
import { forwardRef } from 'react'
import { styled } from '@mui/material/styles'
import Typography from '@mui/material/Typography'
import MenuItem, { MenuItemProps } from '@mui/material/MenuItem'

const StyledMenuItem = styled(MenuItem)({
  display: 'flex',
  paddingLeft: '4px',
  paddingRight: '4px',
  justifyContent: 'space-between',
})

const StyledTypography = styled(Typography)({
  textAlign: 'left',
  paddingLeft: '8px',
  paddingRight: '8px',
})

const FlexBox = styled(Box)({
  display: 'flex',
})

type IconMenuItemProps = {
  sx?: SxProps
  label?: string
  className?: string
  disabled?: boolean
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  MenuItemProps?: MenuItemProps
  renderLabel?: () => ReactNode
  onClick?: (event: MouseEvent<HTMLElement>) => void
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
