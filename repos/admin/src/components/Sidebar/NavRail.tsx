import type { TNavCtx, TNavItem, TRailSection, TRailSectionId } from '@TAF/types'

import Box from '@mui/material/Box'
import { isFunc } from '@keg-hub/jsutils/isFunc'
import { useNavigate, useLocation } from 'react-router'
import { NavRailExpandedWidth } from '@TAF/constants/values'
import { NavRail as BaseNavRail, NavRailItem } from '@tdsk/components'

type TRailNavItem = {
  item: TNavItem
  context: TNavCtx
}

export type TNavRail = {
  context: TNavCtx
  sections: TRailSection[]
  bottomItems: TNavItem[]
  activeSection: TRailSectionId | null
  onSectionClick: (id: TRailSectionId) => void
}

const RailNavItem = (props: TRailNavItem) => {
  const { item, context } = props

  const location = useLocation()
  const navigate = useNavigate()

  if (item.visible && !item.visible(context)) return null

  const resolvedPath = isFunc(item.to) ? item.to(context) : item.to
  const isActive = resolvedPath ? location.pathname === resolvedPath : false

  return (
    <NavRailItem
      icon={item.Icon}
      active={isActive}
      label={item.text as string}
      onClick={() => resolvedPath && navigate(resolvedPath)}
    />
  )
}

export const NavRail = (props: TNavRail) => {
  const { context, sections, bottomItems, activeSection, onSectionClick } = props

  return (
    <BaseNavRail expandedWidth={NavRailExpandedWidth}>
      <Box sx={{ width: `100%`, flex: 1 }}>
        {sections.map((section) => {
          if (section.visible && !section.visible(context)) return null

          return (
            <NavRailItem
              key={section.id}
              icon={section.Icon}
              label={section.label}
              active={activeSection === section.id}
              onClick={() => onSectionClick(section.id)}
            />
          )
        })}
      </Box>

      <Box sx={{ width: `100%` }}>
        {bottomItems.map((item) => (
          <RailNavItem
            key={isFunc(item.to) ? String(item.text) : (item.to as string)}
            item={item}
            context={context}
          />
        ))}
      </Box>
    </BaseNavRail>
  )
}
