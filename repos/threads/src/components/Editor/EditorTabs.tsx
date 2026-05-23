import type { TFileCacheEntry } from '@TTH/types'

import { useCallback } from 'react'
import Box from '@mui/material/Box'
import Tooltip from '@mui/material/Tooltip'
import Close from '@mui/icons-material/Close'
import { MonoFont } from '@TTH/constants/values'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import { extColor } from '@TTH/utils/editor/extColor'
import { fileName } from '@TTH/utils/editor/fileName'
import CloseFullscreen from '@mui/icons-material/CloseFullscreen'
import FiberManualRecord from '@mui/icons-material/FiberManualRecord'

export type TEditorTabs = {
  files: string[]
  onCloseAll: () => void
  activeFile: string | null
  onClose: (path: string) => void
  onSelect: (path: string) => void
  contentCache: Map<string, TFileCacheEntry>
}

export const EditorTabs = (props: TEditorTabs) => {
  const { files, onClose, onSelect, onCloseAll, activeFile, contentCache } = props

  const handleClose = useCallback(
    (evt: React.MouseEvent, path: string) => {
      evt.stopPropagation()
      onClose(path)
    },
    [onClose]
  )

  return (
    <Box
      sx={{
        height: 32,
        minHeight: 32,
        display: `flex`,
        borderBottom: 1,
        alignItems: `stretch`,
        borderColor: `divider`,
        bgcolor: `background.default`,
      }}
    >
      <Box
        sx={{
          flex: 1,
          minWidth: 0,
          display: `flex`,
          overflowX: `auto`,
          overflowY: `hidden`,
          alignItems: `stretch`,
          '&::-webkit-scrollbar': { height: 0 },
        }}
      >
        {files.map((path) => {
          const isActive = path === activeFile
          const isDirty = contentCache.get(path)?.status === `dirty`
          return (
            <Box
              key={path}
              onClick={() => onSelect(path)}
              sx={{
                px: 1.5,
                gap: `6px`,
                borderRight: 1,
                display: `flex`,
                cursor: `pointer`,
                alignItems: `center`,
                position: `relative`,
                userSelect: `none`,
                whiteSpace: `nowrap`,
                color: isActive ? `text.primary` : `text.secondary`,
                bgcolor: isActive ? `background.paper` : `transparent`,
                borderColor: `divider`,
                '&:hover': {
                  bgcolor: isActive ? `background.paper` : `action.hover`,
                },
                ...(isActive && {
                  '&::before': {
                    content: `''`,
                    position: `absolute`,
                    top: 0,
                    left: 0,
                    right: 0,
                    height: `2px`,
                    bgcolor: `primary.main`,
                  },
                }),
              }}
            >
              <Box
                sx={{
                  width: 6,
                  height: 6,
                  flexShrink: 0,
                  borderRadius: `50%`,
                  bgcolor: extColor(path),
                }}
              />
              <Typography
                noWrap
                sx={{
                  fontSize: 11.5,
                  fontFamily: MonoFont,
                  fontWeight: isActive ? 600 : 400,
                }}
              >
                {fileName(path)}
              </Typography>
              {isDirty ? (
                <FiberManualRecord
                  sx={{
                    fontSize: 8,
                    flexShrink: 0,
                    color: `warning.main`,
                  }}
                />
              ) : (
                <Box
                  onClick={(evt) => handleClose(evt, path)}
                  sx={{
                    width: 16,
                    height: 16,
                    flexShrink: 0,
                    display: `flex`,
                    borderRadius: `3px`,
                    alignItems: `center`,
                    justifyContent: `center`,
                    opacity: isActive ? 0.7 : 0,
                    '&:hover': { opacity: 1, bgcolor: `action.hover` },
                    '.MuiBox-root:hover > &': { opacity: 0.5 },
                  }}
                >
                  <Close sx={{ fontSize: 12 }} />
                </Box>
              )}
            </Box>
          )
        })}
      </Box>

      {files.length > 0 && (
        <Box
          sx={{
            display: `flex`,
            alignItems: `center`,
            px: 0.75,
            borderLeft: 1,
            borderColor: `divider`,
          }}
        >
          <Tooltip title='Close all'>
            <IconButton
              size='small'
              onClick={onCloseAll}
              sx={{ p: 0.25 }}
            >
              <CloseFullscreen sx={{ fontSize: 14, color: `text.secondary` }} />
            </IconButton>
          </Tooltip>
        </Box>
      )}
    </Box>
  )
}
