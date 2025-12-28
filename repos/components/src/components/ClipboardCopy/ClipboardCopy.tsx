import type { IconButtonProps } from '@mui/material/IconButton'

import { gutter } from '@TSC/theme'
import Tooltip from '@mui/material/Tooltip'
import IconButton from '@mui/material/IconButton'
import ContentPasteIcon from '@mui/icons-material/ContentPaste'
import { useCopyToClipboard } from '@TSC/hooks/dom/useCopyToClipboard'

export type TClipboardCopy = {
  value: string
  disabled?: boolean
  theme?: 'dark' | 'light'
  edge?: IconButtonProps['edge']
}

export const ClipboardCopy = (props: TClipboardCopy) => {
  const { value, edge, disabled } = props

  const { isCopied, onCopiedOff, onCopyToClipBoard } = useCopyToClipboard()

  return (
    <Tooltip
      sx={{ zIndex: 2 }}
      onClose={onCopiedOff}
      title={isCopied ? 'Copied to clipboard!' : 'Copy'}
    >
      <span>
        <IconButton
          edge={edge}
          color='inherit'
          disabled={disabled}
          onClick={() => onCopyToClipBoard(value)}
        >
          <ContentPasteIcon sx={{ height: gutter.px, width: gutter.px }} />
        </IconButton>
      </span>
    </Tooltip>
  )
}
