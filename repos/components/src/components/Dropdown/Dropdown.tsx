import type { AccordionProps } from '@mui/material'
import type { SxProps, Theme } from '@mui/material'
import type { ReactNode, ComponentType } from 'react'
import type { TIconDirection } from '@TSC/components/Icons/ExpandIcon'

import { useRef, useState, useEffect, useCallback } from 'react'

import { useInline } from '@TSC/hooks'
import { cls } from '@keg-hub/jsutils/cls'
import { exists } from '@keg-hub/jsutils/exists'
import { emptyObj } from '@keg-hub/jsutils/emptyObj'
import { ensureArr } from '@keg-hub/jsutils/ensureArr'
import { delimitString } from '@keg-hub/jsutils/delimitString'
import { HeaderText, Body, Container, Header } from './Dropdown.styled'
import { ExpandIcon as ExpandIconComp } from '@TSC/components/Icons/ExpandIcon'

const defTransProps = {
  timeout: 300,
  unmountOnExit: false,
}

export type TDropdown = Omit<AccordionProps, `children` | `onChange` | `title`> & {
  id: string
  Body?: ReactNode
  Header?: ReactNode
  disabled?: boolean
  noToggle?: boolean
  expanded?: boolean
  actions?: ReactNode
  children?: ReactNode
  headerClass?: string
  headerText?: ReactNode
  bodySx?: SxProps<Theme>
  transformIconOn?: number
  showExpandIcon?: boolean
  headerTextClass?: string
  transformIconOff?: number
  noIconTransform?: boolean
  headerTextSx?: SxProps<Theme>
  headerContentSx?: SxProps<Theme>
  expandIconOpenDir?: TIconDirection
  expandIconClosedDir?: TIconDirection
  onChange?: (expanded: boolean) => void
  headerSx?: SxProps<Theme>
  ExpandIcon?: ComponentType<typeof ExpandIconComp>
  expandIconSx?: SxProps<Theme>
  expandIconContainerSx?: SxProps<Theme>
}

export const Dropdown = (props: TDropdown) => {
  const {
    id,
    bodySx,
    actions,
    headerSx,
    noToggle,
    disabled,
    expanded,
    headerText,
    headerClass,
    headerTextSx,
    expandIconSx,
    Body: BodyComp,
    showExpandIcon,
    headerContentSx,
    headerTextClass,
    transformIconOn,
    transformIconOff,
    children = BodyComp,
    Header: HeaderComp,
    expandIconOpenDir,
    expandIconClosedDir,
    onChange: onChangeCB,
    noIconTransform = true,
    expandIconContainerSx,
    ExpandIcon = ExpandIconComp,
    TransitionProps = defTransProps,
    ...rest
  } = props

  const cleanId = delimitString(id, `-`)
  const inlineCB = useInline<(expanded: boolean) => void>(onChangeCB)
  const outsideExpRef = useRef(expanded)
  const [localExpand, setLocalExpanded] = useState<boolean>(expanded || false)

  const onChange = useCallback(
    (_: any, newExpanded?: boolean) => {
      if (disabled || noToggle) return

      const updated = exists<boolean>(newExpanded) ? newExpanded : !localExpand

      updated !== localExpand && setLocalExpanded(updated)
      updated !== expanded && inlineCB?.(updated)
    },
    [expanded, disabled, noToggle, localExpand]
  )

  useEffect(() => {
    const noExpand =
      !exists(expanded) || outsideExpRef.current === expanded || expanded === localExpand

    if (noExpand) return

    outsideExpRef.current = expanded
    onChange(emptyObj, expanded)
  }, [expanded, localExpand])

  const noExpandIcon = !showExpandIcon || noToggle

  return (
    <Container
      id={`${cleanId}-dropdown-container`}
      elevation={0}
      square={true}
      onChange={onChange}
      expanded={localExpand}
      disableGutters={true}
      slotProps={{
        ...rest?.slotProps,
        heading: {
          component: `div`,
          ...rest?.slotProps?.heading,
        },
      }}
      {...rest}
      className={cls(
        `tdsk-dropdown`,
        localExpand && `expanded`,
        disabled && `disabled`,
        rest.className
      )}
      TransitionProps={{
        unmountOnExit: false,
        ...TransitionProps,
      }}
    >
      <Header
        transformOn={transformIconOn}
        transformOff={transformIconOff}
        id={`${cleanId}-dropdown-header`}
        noIconTransform={noIconTransform}
        aria-controls={`${cleanId}-content`}
        className={cls(
          headerClass,
          `tdsk-dropdown-header`,
          noExpandIcon ? `tdsk-no-expand` : `tdsk-with-expand`
        )}
        sx={
          [
            ...ensureArr(headerSx),
            {
              [`& .MuiAccordionSummary-content`]: headerContentSx,
              [`& .MuiAccordionSummary-expandIconWrapper`]: expandIconContainerSx,
            },
          ] as SxProps<Theme>
        }
        expandIcon={
          noExpandIcon ? (
            <></>
          ) : (
            // @ts-ignore
            <ExpandIcon
              sx={expandIconSx}
              expand={localExpand}
              openDir={expandIconOpenDir}
              transformOn={transformIconOn}
              transformOff={transformIconOff}
              closedDir={expandIconClosedDir}
              noIconTransform={noIconTransform}
              className={cls(`tdsk-dropdown-expand-icon`, localExpand && `expanded`)}
            />
          )
        }
      >
        {HeaderComp ??
          (headerText && (
            <HeaderText
              sx={headerTextSx}
              className={cls(`tdsk-dropdown-header-text`, headerTextClass)}
            >
              {headerText}
            </HeaderText>
          )) ??
          null}

        {actions}
      </Header>
      {(children && (
        <Body
          sx={bodySx}
          className='tdsk-dropdown-body'
        >
          {children}
        </Body>
      )) ||
        null}
    </Container>
  )
}
