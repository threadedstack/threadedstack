import type { TConnectionStatus, TSelectItem } from '@TRL/types'

import { Box, useInput } from 'ink'
import { useCallback } from 'react'
import { Editor } from '@TRL/components/Prompt/Editor'
import { SubMenu } from '@TRL/components/Prompt/SubMenu'
import { SlashMenu } from '@TRL/components/Prompt/SlashMenu'
import { MetadataBar } from '@TRL/components/Prompt/MetadataBar'
import { useSlashMenu } from '@TRL/hooks/useSlashMenu'
import { useEditorState } from '@TRL/hooks/useEditorState'

type TSubMenuProps = {
  visible: boolean
  prompt: string
  items: TSelectItem[]
  selectedIndex: number
}

type TMetadata = {
  orgName?: string
  agentName?: string
  threadName?: string
  projectName?: string
  connection: TConnectionStatus
}

type TPrompt = {
  disabled: boolean
  onSubmit: (text: string) => void
  isPreAuth?: boolean
  subMenu?: TSubMenuProps
  onSubMenuUp?: () => void
  onSubMenuDown?: () => void
  onSubMenuSelect?: () => void
  onSubMenuAction?: () => void
  onSubMenuClose?: () => void
  metadata?: TMetadata
}

export const Prompt = (props: TPrompt) => {
  const {
    onSubmit: onSubmitCB,
    disabled,
    isPreAuth = false,
    subMenu,
    onSubMenuUp,
    onSubMenuDown,
    onSubMenuSelect,
    onSubMenuAction,
    onSubMenuClose,
    metadata,
  } = props

  const editor = useEditorState()
  const menu = useSlashMenu(isPreAuth)

  const syncMenu = useCallback(
    (value: string) => {
      menu.onTextChange(value)
    },
    [menu.onTextChange]
  )

  const subMenuVisible = subMenu?.visible ?? false

  useInput(
    (input, key) => {
      // Sub-menu takes priority when visible
      if (subMenuVisible) {
        if (key.upArrow) {
          onSubMenuUp?.()
          return
        }
        if (key.downArrow) {
          onSubMenuDown?.()
          return
        }
        if (key.return) {
          onSubMenuSelect?.()
          return
        }
        if (key.escape) {
          onSubMenuClose?.()
          return
        }
        // Ctrl+D: action (e.g., delete)
        if (key.ctrl && input === `d`) {
          onSubMenuAction?.()
          return
        }
        // Number keys for direct selection
        if (input && !key.ctrl && !key.meta) {
          const num = Number.parseInt(input, 10)
          if (num >= 1 && num <= (subMenu?.items.length ?? 0)) {
            onSubMenuSelect?.()
            return
          }
        }
        // All other keys are no-ops during sub-menu
        return
      }

      // Submit: Enter without Shift
      if (key.return && !key.shift) {
        // If menu visible and user navigated to a different command, fill it
        if (menu.menuVisible && menu.selectedCommand) {
          const typed = editor.text.trim().slice(1).toLowerCase()
          const selected = menu.selectedCommand.name.toLowerCase()
          if (typed !== selected) {
            const filled = menu.accept()
            if (filled) {
              editor.setText(filled)
              syncMenu(filled)
              return
            }
          }
        }

        const val = editor.text.trim()
        if (!val) return
        onSubmitCB?.(val)
        editor.clear()
        menu.close()
        return
      }

      // Newline: Shift+Enter
      if (key.return && key.shift) {
        editor.insert(`\n`)
        syncMenu(
          editor.text.slice(0, editor.cursor) + `\n` + editor.text.slice(editor.cursor)
        )
        return
      }

      // Tab: menu accept or no-op
      if (key.tab) {
        if (menu.menuVisible) {
          const filled = menu.accept()
          if (filled) {
            editor.setText(filled)
            syncMenu(filled)
          }
        }
        return
      }

      // Escape: close menu or no-op
      if (key.escape) {
        if (menu.menuVisible) {
          menu.close()
          editor.clear()
        }
        return
      }

      // Up/Down: menu nav when visible, editor nav when hidden
      if (key.upArrow) {
        if (menu.menuVisible) {
          menu.moveUp()
        } else {
          editor.moveUp()
        }
        return
      }

      if (key.downArrow) {
        if (menu.menuVisible) {
          menu.moveDown()
        } else {
          editor.moveDown()
        }
        return
      }

      // Left/Right with ctrl/meta: word navigation
      if (key.leftArrow) {
        if (key.ctrl || key.meta) {
          editor.moveWordLeft()
        } else {
          editor.moveLeft()
        }
        return
      }

      if (key.rightArrow) {
        if (key.ctrl || key.meta) {
          editor.moveWordRight()
        } else {
          editor.moveRight()
        }
        return
      }

      // Home / End
      if (key.home) {
        editor.moveToLineStart()
        return
      }

      if (key.end) {
        editor.moveToLineEnd()
        return
      }

      // Backspace
      if (key.backspace) {
        editor.deleteBackward()
        // Compute new text after deletion for menu sync
        const c = editor.cursor
        const newText = editor.text.slice(0, Math.max(0, c - 1)) + editor.text.slice(c)
        syncMenu(newText)
        return
      }

      // Delete
      if (key.delete) {
        editor.deleteForward()
        const c = editor.cursor
        const newText = editor.text.slice(0, Math.max(0, c - 1)) + editor.text.slice(c)
        syncMenu(newText)
        return
      }

      // Ctrl shortcuts
      if (key.ctrl) {
        if (input === `a`) {
          editor.moveToLineStart()
          return
        }
        if (input === `e`) {
          editor.moveToLineEnd()
          return
        }
        if (input === `k`) {
          editor.killToEnd()
          return
        }
        if (input === `u`) {
          editor.killToStart()
          return
        }
        if (input === `w`) {
          editor.deleteWordBackward()
          return
        }
        // Don't insert ctrl chars
        return
      }

      // Regular character input
      if (input && !key.ctrl && !key.meta) {
        editor.insert(input)
        const newText =
          editor.text.slice(0, editor.cursor) + input + editor.text.slice(editor.cursor)
        syncMenu(newText)
      }
    },
    { isActive: !disabled }
  )

  return (
    <Box flexDirection="column">
      {subMenuVisible ? (
        <SubMenu
          visible={subMenu!.visible}
          prompt={subMenu!.prompt}
          items={subMenu!.items}
          selectedIndex={subMenu!.selectedIndex}
        />
      ) : (
        <SlashMenu
          commands={menu.filteredCommands}
          selectedIndex={menu.selectedIndex}
          visible={menu.menuVisible && !disabled}
        />
      )}
      <Box
        borderStyle="round"
        borderColor={disabled || subMenuVisible ? `gray` : `cyan`}
        paddingX={1}
      >
        <Editor
          lines={editor.lines}
          cursorRow={editor.cursorRow}
          cursorCol={editor.cursorCol}
          disabled={disabled || subMenuVisible}
        />
      </Box>
      {metadata && (
        <MetadataBar
          orgName={metadata.orgName}
          agentName={metadata.agentName}
          threadName={metadata.threadName}
          projectName={metadata.projectName}
          connection={metadata.connection}
        />
      )}
    </Box>
  )
}
