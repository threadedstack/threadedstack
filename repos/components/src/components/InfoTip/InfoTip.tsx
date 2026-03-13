import type { TIconButton } from '@TSC/components/Buttons/IconButton'
import type { TTooltip } from '@TSC/components/Tooltip/Tooltip'
import type { ComponentProps, ComponentType, ForwardedRef, ReactNode } from 'react'

import { cls } from '@keg-hub/jsutils/cls'
import { forwardRef, useState } from 'react'
import { isValidFuncComp } from '@TSC/utils/isValidFuncComp'
import { IconButton } from '@TSC/components/Buttons/IconButton'
import ClickAwayListener from '@mui/material/ClickAwayListener'
import HelpOutlineOutlinedIcon from '@mui/icons-material/HelpOutlineOutlined'
import { InfoTipContainer } from '@TSC/components/InfoTip/InfoTip.styles'

type TToolWrap = Omit<TTooltip, `title` | `children` | `onClick`>
type TIconWrap = Omit<TIconButton, `tooltip` | `children` | `onClick`>

export type TInfoTip = TIconWrap &
  TToolWrap & {
    Info?: ReactNode
    iconClass?: string
    children?: ReactNode
    infoProps?: ComponentProps<any>
    Icon?: ComponentType<any> | ReactNode
    onClick?: (evt: any, open?: boolean) => any
  }

export const InfoTip = forwardRef(
  (props: TInfoTip, ref: ForwardedRef<HTMLButtonElement>) => {
    const {
      Info,
      text,
      onOpen,
      variant,
      onClose,
      onClick,
      children,
      disabled,
      infoProps,
      iconProps,
      iconClass,
      className,
      arrow = true,
      open: initialOpen,
      Icon = HelpOutlineOutlinedIcon,
      ...rest
    } = props

    const [open, setOpen] = useState<boolean>(initialOpen || false)

    const onToggleInfo = (evt: any) => {
      const updated = !open
      setOpen(updated)
      updated ? onOpen?.(evt) : onClose?.(evt)
      onClick?.(evt, updated)
    }

    const onCloseCB = (evt: any) => {
      setOpen(false)
      onClose?.(evt)
    }

    return (
      <ClickAwayListener onClickAway={onCloseCB}>
        <InfoTipContainer className={cls(`tdsk-info-tip-container`, className)}>
          <IconButton
            ref={ref}
            text={text}
            Icon={Icon}
            variant={variant}
            disabled={disabled}
            className={iconClass}
            iconProps={iconProps}
            onClick={onToggleInfo}
            tooltip={{
              open,
              arrow,
              onClose: onCloseCB,
              disableFocusListener: true,
              disableHoverListener: true,
              disableTouchListener: true,
              title: Info ? (
                isValidFuncComp(Info) ? (
                  <Info {...infoProps} />
                ) : (
                  Info
                )
              ) : (
                children
              ),
              ...rest,
              PopperProps: {
                disablePortal: true,
                ...rest?.PopperProps,
              },
            }}
          />
        </InfoTipContainer>
      </ClickAwayListener>
    )
  }
)
