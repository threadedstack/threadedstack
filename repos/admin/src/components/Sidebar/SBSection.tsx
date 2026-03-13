import type { CSSProperties } from 'react'
import type { TNavItem, TNavCtx } from '@TAF/types'

import { useNavigate } from 'react-router'
import { cls } from '@keg-hub/jsutils/cls'
import { stopEvent } from '@tdsk/components'
import { storage } from '@TAF/services/storage'
import { isFunc } from '@keg-hub/jsutils/isFunc'
import { useState, useCallback, useEffect } from 'react'
import { Box, Collapse, Typography } from '@mui/material'
import { StorageKeyPrefix } from '@TAF/constants/storage'
import { SBNavList } from '@TAF/components/Sidebar/SBNavList'
import { ExpandMore as ExpandIcon, ExpandLess as CollapseIcon } from '@mui/icons-material'

export type TSBSection = {
  id: string
  open?: boolean
  items: TNavItem[]
  context?: TNavCtx
  className?: string
  sx?: CSSProperties
  defaultExpanded?: boolean
  header?: string | ((context: TNavCtx) => string)
  headerTo?: string | ((context: TNavCtx) => string)
}

export const SBSection = (props: TSBSection) => {
  const {
    id,
    sx,
    items,
    header,
    context,
    headerTo,
    className,
    open: sidebarOpen,
    defaultExpanded = true,
  } = props

  const navigate = useNavigate()
  const storageKey = `${StorageKeyPrefix}${id}`

  // Initialize expanded state from localStorage or default
  const [expanded, setExpanded] = useState(() => {
    const stored = storage.get(storageKey)
    if (stored != null) return stored === `true` || stored === true
    return defaultExpanded
  })

  // Persist expanded state to localStorage
  useEffect(() => {
    storage.set(storageKey, String(expanded))
  }, [expanded, storageKey])

  const onToggle = useCallback((evt: React.MouseEvent) => {
    stopEvent(evt)
    setExpanded((prev) => !prev)
  }, [])

  const onHeaderClick = useCallback(
    (evt: React.MouseEvent) => {
      stopEvent(evt)
      const resolvedPath = isFunc(headerTo) ? headerTo(context || {}) : headerTo
      resolvedPath && navigate(resolvedPath)
    },
    [headerTo, context, navigate]
  )

  const resolvedHeader = isFunc(header) ? header(context || {}) : header

  // Don't render section if no items are visible
  const hasVisibleItems = items.some(
    (item) => !item.visible || item.visible(context || {})
  )
  if (!hasVisibleItems) return null

  return (
    <Box
      className={cls('tdsk-sb-section', className, expanded && 'expanded')}
      sx={{
        width: '100%',
        ...sx,
      }}
    >
      {resolvedHeader && sidebarOpen && (
        <Box
          className='tdsk-sb-section-header'
          onClick={onToggle}
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 2,
            py: 1,
            cursor: 'pointer',
            userSelect: 'none',
            transition: 'background-color 0.2s ease',
            '&:hover': {
              bgcolor: 'action.hover',
            },
          }}
        >
          <Typography
            variant='caption'
            onClick={headerTo ? onHeaderClick : undefined}
            sx={{
              fontWeight: 600,
              letterSpacing: 0.5,
              textTransform: 'uppercase',
              color: 'text.secondary',
              fontSize: '11px',
              cursor: headerTo ? 'pointer' : 'default',
              '&:hover': headerTo
                ? {
                    color: 'primary.main',
                  }
                : {},
            }}
          >
            {resolvedHeader}
          </Typography>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              color: 'text.disabled',
              transition: 'transform 0.2s ease',
            }}
          >
            {expanded ? (
              <CollapseIcon sx={{ fontSize: 18 }} />
            ) : (
              <ExpandIcon sx={{ fontSize: 18 }} />
            )}
          </Box>
        </Box>
      )}

      <Collapse
        timeout={200}
        in={expanded || !sidebarOpen}
      >
        <SBNavList
          items={items}
          context={context}
          open={sidebarOpen}
        />
      </Collapse>
    </Box>
  )
}
