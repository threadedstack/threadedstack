import type { CSSProperties, ComponentType, ReactNode, ComponentProps } from 'react'

import MuiTab from '@mui/material/Tab'
import MuiTabs from '@mui/material/Tabs'
import { cls } from '@keg-hub/jsutils/cls'
import { inherit } from '@TSC/theme/helpers'
import { isArr } from '@keg-hub/jsutils/isArr'
import { isStr } from '@keg-hub/jsutils/isStr'
import { exists } from '@keg-hub/jsutils/exists'
import { isValidFuncComp } from '@TSC/utils/isValidFuncComp'
import { TabBadge, TabsContainer } from '@TSC/components/Tabs/Tabs.styles'

export type TTRef = string | number

export type TTab = {
  id?: string
  label: ReactNode
  icon?: ReactNode
  sx?: CSSProperties
  className?: string
  disabled?: boolean
  content?: ReactNode
  badgeCount?: number
  value?: string | number
  Icon?: ComponentType<any>
  Component?: ComponentType<any>
  iconProps?: ComponentProps<any>
  iconPosition?: `start` | `end` | `top` | `bottom`
}

export type TTabs = {
  label?: string
  active?: TTRef
  sx?: CSSProperties
  className?: string
  tabsClass?: string
  centered?: boolean
  tabsSx?: CSSProperties
  disabled?: boolean | string[]
  scrollButtons?: boolean | `auto`
  allowScrollButtonsMobile?: boolean
  onChange?: (evt: any, tab: TTRef) => void
  tabs: Array<ReturnType<typeof MuiTab> | TTab>
  variant?: `standard` | `scrollable` | `fullWidth`
}

export const Tabs = (props: TTabs) => {
  const {
    sx,
    label,
    tabs,
    tabsSx,
    active,
    variant,
    centered,
    disabled,
    onChange,
    tabsClass,
    className,
    scrollButtons,
    allowScrollButtonsMobile,
  } = props

  return (
    <TabsContainer
      sx={sx}
      className={cls(className, `tdsk-tabs-container`)}
    >
      <MuiTabs
        sx={tabsSx}
        value={active}
        variant={variant}
        aria-label={label}
        centered={centered}
        onChange={onChange}
        indicatorColor='primary'
        scrollButtons={scrollButtons}
        className={cls(tabsClass, `tdsk-tabs`)}
        allowScrollButtonsMobile={allowScrollButtonsMobile}
      >
        {tabs?.map((tab, idx) => {
          if (!(tab as TTab)?.label) return tab as ReturnType<typeof MuiTab>

          const {
            label,
            Icon,
            icon,
            content,
            iconProps,
            Component,
            badgeCount,
            iconPosition = `start`,
            ...rest
          } = tab as TTab

          const isDisabled = exists(rest.disabled)
            ? rest.disabled
            : isArr(disabled)
              ? isStr(label)
                ? disabled.includes(label)
                : isStr(rest.id)
                  ? disabled.includes(rest.id)
                  : false
              : disabled

          return (
            <MuiTab
              id={rest.id}
              sx={rest.sx}
              value={rest.value}
              disabled={isDisabled}
              className={rest.className}
              iconPosition={iconPosition}
              key={
                rest.id || (isStr(label) && label) || (isStr(content) && content) || idx
              }
              icon={
                Icon ? (
                  isValidFuncComp(Icon) ? (
                    <Icon
                      {...iconProps}
                      sx={[inherit, iconProps?.sx]}
                    />
                  ) : (
                    Icon
                  )
                ) : (
                  (icon as any)
                )
              }
              label={
                badgeCount ? (
                  <TabBadge
                    color='primary'
                    badgeContent={badgeCount}
                  >
                    {label}
                    {content}
                  </TabBadge>
                ) : (
                  <>
                    {label} {content}
                  </>
                )
              }
            />
          )
        })}
      </MuiTabs>
    </TabsContainer>
  )
}

export { MuiTab as Tab }
