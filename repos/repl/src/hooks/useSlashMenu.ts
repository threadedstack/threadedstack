import type { TSlashCommand } from '@TRL/types'

import { useState, useMemo, useCallback, useRef } from 'react'
import { getAvailableCommands } from '@TRL/commands'

/**
 * Filter commands by prefix, matching on name or aliases.
 * Name matches sort before alias-only matches.
 */
export function filterCommands(
  commands: TSlashCommand[],
  prefix: string
): TSlashCommand[] {
  if (!prefix) return commands

  const lower = prefix.toLowerCase()
  const nameMatches: TSlashCommand[] = []
  const aliasMatches: TSlashCommand[] = []

  for (const cmd of commands) {
    if (cmd.name.toLowerCase().startsWith(lower)) {
      nameMatches.push(cmd)
    } else if (cmd.aliases.some((a) => a.toLowerCase().startsWith(lower))) {
      aliasMatches.push(cmd)
    }
  }

  return [...nameMatches, ...aliasMatches]
}

/**
 * Parse input value to determine menu visibility and prefix.
 * Returns null when the menu should be hidden.
 */
export function parseSlashInput(value: string): string | null {
  if (!value.startsWith(`/`)) return null
  if (value.includes(`\n`)) return null
  const afterSlash = value.slice(1)
  if (afterSlash.indexOf(` `) !== -1) return null
  return afterSlash
}

type TSlashMenuReturn = {
  menuVisible: boolean
  selectedIndex: number
  filteredCommands: TSlashCommand[]
  selectedCommand: TSlashCommand | null
  onTextChange: (value: string) => void
  moveUp: () => void
  moveDown: () => void
  accept: () => string | null
  close: () => void
}

export function useSlashMenu(isPreAuth: boolean): TSlashMenuReturn {
  const [menuVisible, setMenuVisible] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [prefix, setPrefix] = useState(``)

  const availableCommands = useMemo(() => getAvailableCommands(isPreAuth), [isPreAuth])

  const filteredCommands = useMemo(
    () => (menuVisible ? filterCommands(availableCommands, prefix) : []),
    [menuVisible, prefix, availableCommands]
  )

  const prevFilterLenRef = useRef(filteredCommands.length)
  if (prevFilterLenRef.current !== filteredCommands.length) {
    prevFilterLenRef.current = filteredCommands.length
  }

  const selectedCommand = filteredCommands[selectedIndex] ?? null

  const onTextChange = useCallback((value: string) => {
    if (!value.startsWith(`/`) || value.includes(`\n`)) {
      setMenuVisible(false)
      setPrefix(``)
      setSelectedIndex(0)
      return
    }

    const afterSlash = value.slice(1)
    const spaceIdx = afterSlash.indexOf(` `)

    if (spaceIdx !== -1) {
      setMenuVisible(false)
      setPrefix(``)
      setSelectedIndex(0)
      return
    }

    setMenuVisible(true)
    setPrefix(afterSlash)
    setSelectedIndex(0)
  }, [])

  const moveUp = useCallback(() => {
    setSelectedIndex((prev) =>
      prev <= 0 ? Math.max(filteredCommands.length - 1, 0) : prev - 1
    )
  }, [filteredCommands.length])

  const moveDown = useCallback(() => {
    setSelectedIndex((prev) => (prev >= filteredCommands.length - 1 ? 0 : prev + 1))
  }, [filteredCommands.length])

  const accept = useCallback((): string | null => {
    if (!selectedCommand) return null
    return `/${selectedCommand.name} `
  }, [selectedCommand])

  const close = useCallback(() => {
    setMenuVisible(false)
    setPrefix(``)
    setSelectedIndex(0)
  }, [])

  return {
    menuVisible,
    selectedIndex,
    filteredCommands,
    selectedCommand,
    onTextChange,
    moveUp,
    moveDown,
    accept,
    close,
  }
}
