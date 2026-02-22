import type { TEditorAction } from '@TRL/hooks/useEditorState'
import type { TConnectionStatus, TSelectItem } from '@TRL/types'

import { Box, useInput } from 'ink'
import { useSlashMenu } from '@TRL/hooks/useSlashMenu'
import { Editor } from '@TRL/components/Prompt/Editor'
import { SubMenu } from '@TRL/components/Prompt/SubMenu'
import { useInputBuffer } from '@TRL/hooks/useInputBuffer'
import { memo, useCallback, useRef, useEffect } from 'react'
import { SlashMenu } from '@TRL/components/Prompt/SlashMenu'
import { MetadataBar } from '@TRL/components/Prompt/MetadataBar'
import { useEditorState, editorReducer } from '@TRL/hooks/useEditorState'

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

type TShadowState = { text: string; cursor: number; desiredCol: number }
const initialShadow: TShadowState = { text: ``, cursor: 0, desiredCol: 0 }

export const Prompt = memo((props: TPrompt) => {
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

  // Shadow ref tracks the "true" editor state synchronously — always current
  // even before React processes buffered dispatches. Used by Enter to read text.
  const shadowRef = useRef<TShadowState>(initialShadow)

  // Keep shadow in sync after React state updates (covers direct dispatches)
  useEffect(() => {
    shadowRef.current = { text: editor.text, cursor: editor.cursor, desiredCol: 0 }
  }, [editor.text, editor.cursor])

  // Sync slash menu when editor text changes (fires after React render)
  useEffect(() => {
    menu.onTextChange(editor.text)
  }, [editor.text, menu.onTextChange])

  const buffer = useInputBuffer(editor.dispatch)

  // Buffer an action and update shadow state synchronously
  const bufferAction = useCallback(
    (action: TEditorAction) => {
      shadowRef.current = editorReducer(shadowRef.current, action)
      buffer(action)
    },
    [buffer]
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
          const typed = shadowRef.current.text.trim().slice(1).toLowerCase()
          const selected = menu.selectedCommand.name.toLowerCase()
          if (typed !== selected) {
            const filled = menu.accept()
            if (filled) {
              // Synchronous — need immediate visual feedback
              editor.setText(filled)
              shadowRef.current = editorReducer(shadowRef.current, {
                type: 'SET_TEXT',
                text: filled,
              })
              return
            }
          }
        }

        // Read from shadow ref — always has latest text even if buffer hasn't flushed
        const val = shadowRef.current.text.trim()
        if (!val) return
        onSubmitCB?.(val)
        // Synchronous clear
        editor.clear()
        menu.close()
        shadowRef.current = initialShadow
        return
      }

      // Newline: Shift+Enter
      if (key.return && key.shift) {
        bufferAction({ type: 'INSERT', chars: `\n` })
        return
      }

      // Tab: menu accept or no-op (synchronous — immediate feedback)
      if (key.tab) {
        if (menu.menuVisible) {
          const filled = menu.accept()
          if (filled) {
            editor.setText(filled)
            shadowRef.current = editorReducer(shadowRef.current, {
              type: 'SET_TEXT',
              text: filled,
            })
          }
        }
        return
      }

      // Escape: close menu or no-op (synchronous)
      if (key.escape) {
        if (menu.menuVisible) {
          menu.close()
          editor.clear()
          shadowRef.current = initialShadow
        }
        return
      }

      // Up/Down: menu nav (synchronous) or editor nav (buffered)
      if (key.upArrow) {
        if (menu.menuVisible) {
          menu.moveUp()
        } else {
          bufferAction({ type: 'MOVE_UP' })
        }
        return
      }

      if (key.downArrow) {
        if (menu.menuVisible) {
          menu.moveDown()
        } else {
          bufferAction({ type: 'MOVE_DOWN' })
        }
        return
      }

      // Left/Right with ctrl/meta: word navigation
      if (key.leftArrow) {
        bufferAction(
          key.ctrl || key.meta ? { type: 'MOVE_WORD_LEFT' } : { type: 'MOVE_LEFT' }
        )
        return
      }

      if (key.rightArrow) {
        bufferAction(
          key.ctrl || key.meta ? { type: 'MOVE_WORD_RIGHT' } : { type: 'MOVE_RIGHT' }
        )
        return
      }

      // Home / End
      if (key.home) {
        bufferAction({ type: 'MOVE_TO_LINE_START' })
        return
      }

      if (key.end) {
        bufferAction({ type: 'MOVE_TO_LINE_END' })
        return
      }

      // Backspace
      if (key.backspace) {
        bufferAction({ type: 'DELETE_BACKWARD' })
        return
      }

      // Delete
      if (key.delete) {
        bufferAction({ type: 'DELETE_FORWARD' })
        return
      }

      // Ctrl shortcuts
      if (key.ctrl) {
        if (input === `a`) {
          bufferAction({ type: 'MOVE_TO_LINE_START' })
          return
        }
        if (input === `e`) {
          bufferAction({ type: 'MOVE_TO_LINE_END' })
          return
        }
        if (input === `k`) {
          bufferAction({ type: 'KILL_TO_END' })
          return
        }
        if (input === `u`) {
          bufferAction({ type: 'KILL_TO_START' })
          return
        }
        if (input === `w`) {
          bufferAction({ type: 'DELETE_WORD_BACKWARD' })
          return
        }
        // Don't insert ctrl chars
        return
      }

      // Regular character input — buffered for performance
      if (input && !key.ctrl && !key.meta) {
        bufferAction({ type: 'INSERT', chars: input })
      }
    },
    { isActive: !disabled }
  )

  return (
    <Box flexDirection="column">
      {subMenuVisible ? (
        <SubMenu
          items={subMenu!.items}
          prompt={subMenu!.prompt}
          visible={subMenu!.visible}
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
          connection={metadata.connection}
          threadName={metadata.threadName}
          projectName={metadata.projectName}
        />
      )}
    </Box>
  )
})
