import type { DialogProps as MDialogProps } from '@mui/material/Dialog'
import type { DialogActionsProps } from '@mui/material/DialogActions'
import type { DialogContentProps } from '@mui/material/DialogContent'
import type { DialogTitleProps } from '@mui/material/DialogTitle'
import type { PaperProps } from '@mui/material/Paper'
import type { MutableRefObject, ReactNode } from 'react'

import {
  DialogActions,
  DialogContent,
  DialogTitle,
} from '@TSC/components/Dialog/Dialog.styles'
import {
  DDCloseIcon,
  DDDragBox,
  DDDragIcon,
  DDHeader,
  DDPaper,
  DDTitle,
  DDTitleClose,
  DDialog,
} from '@TSC/components/Dialog/DraggableDialog.styles'
import { dims } from '@TSC/theme/dims'
import { stopEvent } from '@TSC/utils/helpers'
import { cls } from '@keg-hub/jsutils'
import { useCallback, useEffect, useRef, useState } from 'react'

type TXYPos = {
  x: number
  y: number
}

type TDialogPaper = PaperProps & {
  position: TXYPos
  paperRef: MutableRefObject<HTMLDivElement>
}

type DialogContainer = {
  TitleIcon?: any
  title?: ReactNode
  children?: ReactNode
  actions?: ReactNode
  titleClose?: boolean
  onMouseDown: (evt: any) => any
  titleProps?: DialogTitleProps
  actionProps?: DialogActionsProps
  contentProps?: DialogContentProps
  onToggle?: (status?: boolean, reason?: string, evt?: any) => any
}

export type TDraggableDialog = Omit<DialogContainer, `onMouseDown`> &
  Omit<MDialogProps, `content` | `title`> & {
    open: boolean
    dialogRef?: MutableRefObject<HTMLDivElement>
    onToggle?: (status?: boolean, reason?: string, evt?: any) => any
  }

const DefPos: TXYPos = { x: 0, y: 0 }

const useDragEvents = (props: TDraggableDialog) => {
  const { open } = props

  const startPos = useRef<TXYPos>(DefPos)
  const [dragging, setDragging] = useState(false)
  const paperRef = useRef<HTMLDivElement | null>(null)
  const [position, setPosition] = useState<TXYPos>(DefPos)

  const onMouseMove = useCallback(
    (evt: MouseEvent) => {
      stopEvent(evt)
      if (!dragging) return

      const x = evt.clientX - startPos.current.x
      const y =
        evt.clientY <= dims.modal.header.height ? false : evt.clientY - startPos.current.y

      setPosition((current) => (y ? { x, y } : { ...current, x }))
    },
    [dragging]
  )

  const onMouseUp = () => setDragging(false)

  // Function to handle the start of a drag event
  const onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation()
    setDragging(true)
    startPos.current = { x: e.clientX - position.x, y: e.clientY - position.y }
  }

  useEffect(() => {
    window.addEventListener(`mouseup`, onMouseUp)
    window.addEventListener(`mousemove`, onMouseMove)
    return () => {
      window.removeEventListener(`mouseup`, onMouseUp)
      window.removeEventListener(`mousemove`, onMouseMove)
    }
  }, [onMouseMove])

  useEffect(() => {
    !open && setPosition(DefPos)
  }, [open])

  useEffect(() => {
    if (!paperRef?.current) return

    const resizeObs = new ResizeObserver((entries) => {
      entries.forEach((entry) => {
        const element = entry.target as HTMLDivElement
        const rect = element.getBoundingClientRect()
        if (rect.top < 0) setPosition((prev) => ({ ...prev, y: 0 }))
      })
    })

    resizeObs.observe(paperRef?.current)

    return () => {
      resizeObs.disconnect()
    }
  })

  return {
    paperRef,
    position,
    onMouseDown,
  }
}

const DialogContainer = (props: DialogContainer) => {
  const {
    title,
    actions,
    children,
    onToggle,
    TitleIcon,
    titleClose,
    titleProps,
    actionProps,
    onMouseDown,
    contentProps,
  } = props

  return (
    <>
      <DDHeader
        className='tdsk-drag-dialog-header'
        onMouseDown={onMouseDown}
      >
        <DDDragBox>
          <DDDragIcon />
        </DDDragBox>
        {title ? (
          <DDTitle
            {...titleProps}
            className={cls(`tdsk-drag-dialog-title`, titleProps?.className)}
          >
            {TitleIcon}
            {title}
          </DDTitle>
        ) : null}
        {titleClose && (
          <DDTitleClose
            color='error'
            Icon={DDCloseIcon}
            onClick={(evt) => onToggle(false, `title close`, evt)}
          />
        )}
      </DDHeader>

      {children ? <DialogContent {...contentProps}>{children}</DialogContent> : null}

      {actions ? <DialogActions {...actionProps}>{actions}</DialogActions> : null}
    </>
  )
}

const DialogPaper = (props: TDialogPaper) => {
  const { sx, children, paperRef, position, className, ...rest } = props

  return (
    <DDPaper
      {...rest}
      ref={paperRef}
      onClick={(evt) => stopEvent(evt)}
      className={cls(`tdsk-drag-dialog-container`, className)}
      sx={{ ...sx, transform: `translate(${position.x}px, ${position.y}px)` }}
    >
      {children}
    </DDPaper>
  )
}

export const DraggableDialog = (props: TDraggableDialog) => {
  const {
    sx,
    open,
    slots,
    scroll,
    onToggle,
    className,
    dialogRef,
    fullWidth,
    slotProps,
    fullScreen,
    PaperProps,
    keepMounted,
    maxWidth = `md`,
    disablePortal,
    TransitionProps,
    disableAutoFocus,
    hideBackdrop = true,
    disableScrollLock,
    onTransitionEnter,
    transitionDuration,
    onTransitionExited,
    disableEnforceFocus,
    TransitionComponent,
    disableRestoreFocus,
    disableEscapeKeyDown,
    ...rest
  } = props

  const { paperRef, position, onMouseDown } = useDragEvents(props)

  return (
    <DDialog
      open={open}
      slots={slots}
      ref={dialogRef}
      maxWidth={maxWidth}
      slotProps={slotProps}
      fullWidth={fullWidth}
      fullScreen={fullScreen}
      keepMounted={keepMounted}
      scroll={scroll || 'paper'}
      hideBackdrop={hideBackdrop}
      disablePortal={disablePortal}
      TransitionProps={TransitionProps}
      disableAutoFocus={disableAutoFocus}
      onTransitionEnter={onTransitionEnter}
      disableScrollLock={disableScrollLock}
      onTransitionExited={onTransitionExited}
      transitionDuration={transitionDuration}
      disableEnforceFocus={disableEnforceFocus}
      disableRestoreFocus={disableRestoreFocus}
      TransitionComponent={TransitionComponent}
      disableEscapeKeyDown={disableEscapeKeyDown}
      className={cls(`tdsk-draggable-dialog`, className)}
      onClose={(evt, reason) => onToggle(true, reason, evt)}
      sx={{
        ...sx,
        pointerEvents: `none`,
      }}
      PaperComponent={DialogPaper}
      PaperProps={{
        ...PaperProps,
        position,
        paperRef,
      }}
    >
      <DialogContainer
        {...rest}
        onToggle={onToggle}
        onMouseDown={onMouseDown}
      />
    </DDialog>
  )
}
