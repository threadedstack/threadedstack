# Terminal Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose all ghostty-web terminal configuration options to users via a Settings page section and a quick-access popover, persisted to localStorage.

**Architecture:** A shared `TTerminalSettings` type drives both the Settings page "Terminal" card and a quick-access popover in the Session header. Both UIs render the same atomic field components (sliders, dropdowns, toggles, color pickers). A Jotai atom initialized from localStorage is the single source of truth. `TerminalView` reads the atom and applies settings at construction time and at runtime via `terminal.options.*` proxy setters. Theme presets are named `ITheme` objects that populate all 22 color fields at once.

**Tech Stack:** ghostty-web 0.4.0, Jotai (atomWithReset), MUI 6 (Slider, Select, Switch, Popover, Tabs), localStorage via existing `Storage` service

---

## ghostty-web Configurable Options Reference

All options from `ITerminalOptions` (ghostty-web v0.4.0 `index.d.ts:885`):

| Option | Type | Default | Runtime Update Path |
|--------|------|---------|---------------------|
| `fontSize` | `number` | `15` | `terminal.options.fontSize` → `renderer.setFontSize()` + `remeasureFont()` |
| `fontFamily` | `string` | `'monospace'` | `terminal.options.fontFamily` → `renderer.setFontFamily()` + `remeasureFont()` |
| `cursorStyle` | `'block' \| 'underline' \| 'bar'` | `'block'` | `terminal.options.cursorStyle` → `renderer.setCursorStyle()` |
| `cursorBlink` | `boolean` | `false` | `terminal.options.cursorBlink` → `renderer.setCursorBlink()` |
| `scrollback` | `number` | `10000` | `terminal.options.scrollback` (requires terminal recreation) |
| `theme` | `ITheme` (22 colors) | VS Code dark | `terminal.options.theme` → `renderer.setTheme()` |
| `allowTransparency` | `boolean` | `false` | `terminal.options.allowTransparency` |
| `smoothScrollDuration` | `number` | `100` | `terminal.options.smoothScrollDuration` |

Options NOT exposed to users (internal/niche): `cols`, `rows` (managed by FitAddon), `convertEol`, `disableStdin`, `ghostty` (WASM instance).

**Not supported by ghostty-web** (no constructor option, no renderer method): `fontWeight`, `fontWeightBold`, `lineHeight`, `letterSpacing`, `minimumContrastRatio`, `drawBoldTextInBrightColors`, `bellStyle`/`bellSound`, `macOptionIsMeta`, `scrollSensitivity`, `customGlyphs`.

---

## File Structure

### New Files

| File | Responsibility |
|------|----------------|
| `repos/threads/src/types/terminal.types.ts` | `TTerminalSettings`, `TTerminalThemePreset` types |
| `repos/threads/src/constants/terminal.ts` | Default settings, font options, theme presets (7 named ITheme objects) |
| `repos/threads/src/state/terminal.ts` | `terminalSettingsAtom` (Jotai, initialized from localStorage) |
| `repos/threads/src/components/TerminalSettings/TerminalFontSettings.tsx` | Font family dropdown + font size slider |
| `repos/threads/src/components/TerminalSettings/TerminalCursorSettings.tsx` | Cursor style toggle + cursor blink switch |
| `repos/threads/src/components/TerminalSettings/TerminalScrollSettings.tsx` | Scrollback slider + smooth scroll slider |
| `repos/threads/src/components/TerminalSettings/TerminalThemeSettings.tsx` | Theme preset dropdown + 22 color pickers (collapsible) |
| `repos/threads/src/components/TerminalSettings/TerminalSettingsCard.tsx` | Assembles all 4 sections into a Card for the Settings page |
| `repos/threads/src/components/TerminalSettings/TerminalQuickSettings.tsx` | Popover shell: tabs for Font/Cursor/Scroll/Theme, renders same field components |
| `repos/threads/src/components/TerminalSettings/index.ts` | Barrel export for TerminalSettingsCard and TerminalQuickSettings |

### Modified Files

| File | Changes |
|------|---------|
| `repos/threads/src/constants/storage.ts` | Add `TerminalSettingsStorageKey` |
| `repos/threads/src/state/accessors.ts` | Add `getTerminalSettings`, `setTerminalSettings`, `resetTerminalSettings` |
| `repos/threads/src/state/selectors.ts` | Add `useTerminalSettings()` hook |
| `repos/threads/src/components/TerminalView/TerminalView.tsx` | Read settings from atom, apply at construction + subscribe to runtime changes |
| `repos/threads/src/pages/Settings/Settings.tsx` | Add `<TerminalSettingsCard />` section |
| `repos/threads/src/pages/Session/Session.tsx` | Add `<TerminalQuickSettings />` button in `SessionHeader` |

---

### Task 1: Types and Constants

**Files:**
- Create: `repos/threads/src/types/terminal.types.ts`
- Create: `repos/threads/src/constants/terminal.ts`
- Modify: `repos/threads/src/constants/storage.ts`

- [ ] **Step 1: Create terminal types**

```typescript
// repos/threads/src/types/terminal.types.ts
import type { ITheme } from 'ghostty-web'

export type TTerminalThemePreset =
  | 'threadedstack'
  | 'catppuccin-mocha'
  | 'dracula'
  | 'one-dark'
  | 'solarized-dark'
  | 'solarized-light'
  | 'github-dark'
  | 'nord'
  | 'custom'

export type TTerminalSettings = {
  fontSize: number
  fontFamily: string
  cursorStyle: 'block' | 'underline' | 'bar'
  cursorBlink: boolean
  scrollback: number
  smoothScrollDuration: number
  allowTransparency: boolean
  themePreset: TTerminalThemePreset
  theme: ITheme
}
```

- [ ] **Step 2: Add storage key**

Add to `repos/threads/src/constants/storage.ts`:

```typescript
export const TerminalSettingsStorageKey = `terminal-settings`
```

- [ ] **Step 3: Create terminal constants with defaults and theme presets**

```typescript
// repos/threads/src/constants/terminal.ts
import type { ITheme } from 'ghostty-web'
import type { TTerminalSettings, TTerminalThemePreset } from '@TTH/types/terminal.types'

export const TerminalFontOptions = [
  { label: `JetBrains Mono`, value: `'JetBrains Mono', monospace` },
  { label: `Fira Code`, value: `'Fira Code', monospace` },
  { label: `Cascadia Code`, value: `'Cascadia Code', monospace` },
  { label: `Source Code Pro`, value: `'Source Code Pro', monospace` },
  { label: `Inconsolata`, value: `'Inconsolata', monospace` },
  { label: `IBM Plex Mono`, value: `'IBM Plex Mono', monospace` },
  { label: `System Monospace`, value: `monospace` },
] as const

export const TerminalFontSizeRange = { min: 8, max: 28, step: 1 } as const
export const TerminalScrollbackRange = { min: 1000, max: 100_000, step: 1000 } as const
export const TerminalSmoothScrollRange = { min: 0, max: 500, step: 10 } as const

export const TerminalCursorStyles = [
  { label: `Block`, value: `block` },
  { label: `Underline`, value: `underline` },
  { label: `Bar`, value: `bar` },
] as const

// --- Theme Presets ---

/**
 * ThreadedStack brand theme — derived from the MUI dark palette in @tdsk/components.
 * Uses the app's background (#1A1D21), foreground (#CECECE), primary (#3370DE),
 * and semantic colors (error, success, warning, info) mapped to ANSI slots.
 */
const threadedStack: ITheme = {
  background: `#1A1D21`,
  foreground: `#CECECE`,
  cursor: `#3370DE`,
  cursorAccent: `#1A1D21`,
  selectionBackground: `#214A92`,
  selectionForeground: `#E6E6E6`,
  black: `#21252B`,
  red: `#EF4444`,
  green: `#2cb67d`,
  yellow: `#F59E0B`,
  blue: `#3370DE`,
  magenta: `#B48EAD`,
  cyan: `#4FC3F7`,
  white: `#CECECE`,
  brightBlack: `#767676`,
  brightRed: `#F87171`,
  brightGreen: `#34D399`,
  brightYellow: `#FBBF24`,
  brightBlue: `#60A5FA`,
  brightMagenta: `#C4A7D7`,
  brightCyan: `#67D9FB`,
  brightWhite: `#E6E6E6`,
}

const catppuccinMocha: ITheme = {
  background: `#1e1e2e`,
  foreground: `#cdd6f4`,
  cursor: `#f5e0dc`,
  cursorAccent: `#1e1e2e`,
  selectionBackground: `#45475a`,
  selectionForeground: `#cdd6f4`,
  black: `#45475a`,
  red: `#f38ba8`,
  green: `#a6e3a1`,
  yellow: `#f9e2af`,
  blue: `#89b4fa`,
  magenta: `#f5c2e7`,
  cyan: `#94e2d5`,
  white: `#bac2de`,
  brightBlack: `#585b70`,
  brightRed: `#f38ba8`,
  brightGreen: `#a6e3a1`,
  brightYellow: `#f9e2af`,
  brightBlue: `#89b4fa`,
  brightMagenta: `#f5c2e7`,
  brightCyan: `#94e2d5`,
  brightWhite: `#a6adc8`,
}

const dracula: ITheme = {
  background: `#282a36`,
  foreground: `#f8f8f2`,
  cursor: `#f8f8f2`,
  cursorAccent: `#282a36`,
  selectionBackground: `#44475a`,
  selectionForeground: `#f8f8f2`,
  black: `#21222c`,
  red: `#ff5555`,
  green: `#50fa7b`,
  yellow: `#f1fa8c`,
  blue: `#bd93f9`,
  magenta: `#ff79c6`,
  cyan: `#8be9fd`,
  white: `#f8f8f2`,
  brightBlack: `#6272a4`,
  brightRed: `#ff6e6e`,
  brightGreen: `#69ff94`,
  brightYellow: `#ffffa5`,
  brightBlue: `#d6acff`,
  brightMagenta: `#ff92df`,
  brightCyan: `#a4ffff`,
  brightWhite: `#ffffff`,
}

const oneDark: ITheme = {
  background: `#282c34`,
  foreground: `#abb2bf`,
  cursor: `#528bff`,
  cursorAccent: `#282c34`,
  selectionBackground: `#3e4451`,
  selectionForeground: `#abb2bf`,
  black: `#5c6370`,
  red: `#e06c75`,
  green: `#98c379`,
  yellow: `#e5c07b`,
  blue: `#61afef`,
  magenta: `#c678dd`,
  cyan: `#56b6c2`,
  white: `#abb2bf`,
  brightBlack: `#4b5263`,
  brightRed: `#be5046`,
  brightGreen: `#98c379`,
  brightYellow: `#d19a66`,
  brightBlue: `#61afef`,
  brightMagenta: `#c678dd`,
  brightCyan: `#56b6c2`,
  brightWhite: `#ffffff`,
}

const solarizedDark: ITheme = {
  background: `#002b36`,
  foreground: `#839496`,
  cursor: `#839496`,
  cursorAccent: `#002b36`,
  selectionBackground: `#073642`,
  selectionForeground: `#93a1a1`,
  black: `#073642`,
  red: `#dc322f`,
  green: `#859900`,
  yellow: `#b58900`,
  blue: `#268bd2`,
  magenta: `#d33682`,
  cyan: `#2aa198`,
  white: `#eee8d5`,
  brightBlack: `#002b36`,
  brightRed: `#cb4b16`,
  brightGreen: `#586e75`,
  brightYellow: `#657b83`,
  brightBlue: `#839496`,
  brightMagenta: `#6c71c4`,
  brightCyan: `#93a1a1`,
  brightWhite: `#fdf6e3`,
}

const solarizedLight: ITheme = {
  background: `#fdf6e3`,
  foreground: `#657b83`,
  cursor: `#657b83`,
  cursorAccent: `#fdf6e3`,
  selectionBackground: `#eee8d5`,
  selectionForeground: `#586e75`,
  black: `#073642`,
  red: `#dc322f`,
  green: `#859900`,
  yellow: `#b58900`,
  blue: `#268bd2`,
  magenta: `#d33682`,
  cyan: `#2aa198`,
  white: `#eee8d5`,
  brightBlack: `#002b36`,
  brightRed: `#cb4b16`,
  brightGreen: `#586e75`,
  brightYellow: `#657b83`,
  brightBlue: `#839496`,
  brightMagenta: `#6c71c4`,
  brightCyan: `#93a1a1`,
  brightWhite: `#fdf6e3`,
}

const githubDark: ITheme = {
  background: `#0d1117`,
  foreground: `#c9d1d9`,
  cursor: `#c9d1d9`,
  cursorAccent: `#0d1117`,
  selectionBackground: `#264f78`,
  selectionForeground: `#ffffff`,
  black: `#484f58`,
  red: `#ff7b72`,
  green: `#3fb950`,
  yellow: `#d29922`,
  blue: `#58a6ff`,
  magenta: `#bc8cff`,
  cyan: `#39c5cf`,
  white: `#b1bac4`,
  brightBlack: `#6e7681`,
  brightRed: `#ffa198`,
  brightGreen: `#56d364`,
  brightYellow: `#e3b341`,
  brightBlue: `#79c0ff`,
  brightMagenta: `#d2a8ff`,
  brightCyan: `#56d4dd`,
  brightWhite: `#f0f6fc`,
}

const nord: ITheme = {
  background: `#2e3440`,
  foreground: `#d8dee9`,
  cursor: `#d8dee9`,
  cursorAccent: `#2e3440`,
  selectionBackground: `#434c5e`,
  selectionForeground: `#eceff4`,
  black: `#3b4252`,
  red: `#bf616a`,
  green: `#a3be8c`,
  yellow: `#ebcb8b`,
  blue: `#81a1c1`,
  magenta: `#b48ead`,
  cyan: `#88c0d0`,
  white: `#e5e9f0`,
  brightBlack: `#4c566a`,
  brightRed: `#bf616a`,
  brightGreen: `#a3be8c`,
  brightYellow: `#ebcb8b`,
  brightBlue: `#81a1c1`,
  brightMagenta: `#b48ead`,
  brightCyan: `#8fbcbb`,
  brightWhite: `#eceff4`,
}

export const TerminalThemePresets: Record<Exclude<TTerminalThemePreset, 'custom'>, ITheme> = {
  'threadedstack': threadedStack,
  'catppuccin-mocha': catppuccinMocha,
  'dracula': dracula,
  'one-dark': oneDark,
  'solarized-dark': solarizedDark,
  'solarized-light': solarizedLight,
  'github-dark': githubDark,
  'nord': nord,
}

export const TerminalThemePresetLabels: Record<TTerminalThemePreset, string> = {
  'threadedstack': `ThreadedStack`,
  'catppuccin-mocha': `Catppuccin Mocha`,
  'dracula': `Dracula`,
  'one-dark': `One Dark`,
  'solarized-dark': `Solarized Dark`,
  'solarized-light': `Solarized Light`,
  'github-dark': `GitHub Dark`,
  'nord': `Nord`,
  'custom': `Custom`,
}

export const DefaultTerminalSettings: TTerminalSettings = {
  fontSize: 14,
  fontFamily: `'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace`,
  cursorStyle: `bar`,
  cursorBlink: true,
  scrollback: 10_000,
  smoothScrollDuration: 100,
  allowTransparency: false,
  themePreset: `threadedstack`,
  theme: threadedStack,
}

/**
 * Color fields in ITheme, in display order for the color picker grid
 */
export const TerminalThemeColorFields = [
  { key: `foreground`, label: `Foreground` },
  { key: `background`, label: `Background` },
  { key: `cursor`, label: `Cursor` },
  { key: `cursorAccent`, label: `Cursor Accent` },
  { key: `selectionBackground`, label: `Selection BG` },
  { key: `selectionForeground`, label: `Selection FG` },
  { key: `black`, label: `Black` },
  { key: `red`, label: `Red` },
  { key: `green`, label: `Green` },
  { key: `yellow`, label: `Yellow` },
  { key: `blue`, label: `Blue` },
  { key: `magenta`, label: `Magenta` },
  { key: `cyan`, label: `Cyan` },
  { key: `white`, label: `White` },
  { key: `brightBlack`, label: `Bright Black` },
  { key: `brightRed`, label: `Bright Red` },
  { key: `brightGreen`, label: `Bright Green` },
  { key: `brightYellow`, label: `Bright Yellow` },
  { key: `brightBlue`, label: `Bright Blue` },
  { key: `brightMagenta`, label: `Bright Magenta` },
  { key: `brightCyan`, label: `Bright Cyan` },
  { key: `brightWhite`, label: `Bright White` },
] as const
```

- [ ] **Step 4: Add type export to barrel**

Add `export type * from './terminal.types'` to `repos/threads/src/types/index.ts` (or wherever types are re-exported).

- [ ] **Step 5: Verify build**

Run: `cd repos/threads && pnpm types`
Expected: No type errors

- [ ] **Step 6: Commit**

```
feat(threads): add terminal settings types, constants, and theme presets
```

---

### Task 2: Jotai State — Atom, Accessors, Selector

**Files:**
- Create: `repos/threads/src/state/terminal.ts`
- Modify: `repos/threads/src/state/accessors.ts`
- Modify: `repos/threads/src/state/selectors.ts`

- [ ] **Step 1: Create terminal settings atom**

```typescript
// repos/threads/src/state/terminal.ts
import type { TTerminalSettings } from '@TTH/types/terminal.types'

import { atomWithReset } from 'jotai/utils'
import { storage } from '@TTH/services/storage'
import { DefaultTerminalSettings } from '@TTH/constants/terminal'
import { TerminalSettingsStorageKey } from '@TTH/constants/storage'

const loadTerminalSettings = (): TTerminalSettings => {
  const saved = storage.get<Partial<TTerminalSettings>>(TerminalSettingsStorageKey)
  return saved ? { ...DefaultTerminalSettings, ...saved } : DefaultTerminalSettings
}

export const terminalSettingsAtom = atomWithReset<TTerminalSettings>(loadTerminalSettings())
```

- [ ] **Step 2: Add accessors**

Add to `repos/threads/src/state/accessors.ts`:

```typescript
import { terminalSettingsAtom } from '@TTH/state/terminal'
import { storage } from '@TTH/services/storage'
import { TerminalSettingsStorageKey } from '@TTH/constants/storage'
import type { TTerminalSettings } from '@TTH/types/terminal.types'

export const getTerminalSettings = () => store.get(terminalSettingsAtom)
export const resetTerminalSettings = () => {
  store.set(terminalSettingsAtom, DefaultTerminalSettings)
  storage.remove(TerminalSettingsStorageKey)
}
export const setTerminalSettings = (settings: TTerminalSettings) => {
  store.set(terminalSettingsAtom, settings)
  storage.set<TTerminalSettings>(TerminalSettingsStorageKey, settings)
}
export const updateTerminalSettings = (patch: Partial<TTerminalSettings>) => {
  const current = store.get(terminalSettingsAtom)
  const updated = { ...current, ...patch }
  setTerminalSettings(updated)
}
```

- [ ] **Step 3: Add selector hook**

Add to `repos/threads/src/state/selectors.ts`:

```typescript
import { terminalSettingsAtom } from '@TTH/state/terminal'

export const useTerminalSettings = () => useAtomValue(terminalSettingsAtom)
```

- [ ] **Step 4: Export from state index**

Add the terminal state module to `repos/threads/src/state/index.ts` if needed for the barrel export.

- [ ] **Step 5: Verify build**

Run: `cd repos/threads && pnpm types`
Expected: No type errors

- [ ] **Step 6: Commit**

```
feat(threads): add terminal settings Jotai atom with localStorage persistence
```

---

### Task 3: TerminalView — Read Settings from Atom + Runtime Updates

**Files:**
- Modify: `repos/threads/src/components/TerminalView/TerminalView.tsx`

- [ ] **Step 1: Refactor TerminalView to read settings from atom**

Replace the hardcoded Terminal constructor options with values from `useTerminalSettings()`. Subscribe to atom changes and apply runtime updates without recreating the terminal.

```typescript
// repos/threads/src/components/TerminalView/TerminalView.tsx
import { useRef, useEffect, useCallback } from 'react'
import { Terminal, FitAddon } from 'ghostty-web'
import { Box } from '@mui/material'
import { useTerminalSettings } from '@TTH/state/selectors'
import {
  sendInput,
  sendControl,
  getRawBuffer,
  subscribeTerminalData,
} from '@TTH/actions/sessions'

export type TTerminalView = {
  sessionId: string
  active: boolean
}

export const TerminalView = (props: TTerminalView) => {
  const { sessionId, active } = props
  const containerRef = useRef<HTMLDivElement>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const settings = useTerminalSettings()
  const settingsRef = useRef(settings)
  settingsRef.current = settings

  const handleData = useCallback(
    (data: string) => sendInput(sessionId, data),
    [sessionId]
  )

  const handleResize = useCallback(
    (dims: { cols: number; rows: number }) =>
      sendControl(sessionId, { type: `resize`, cols: dims.cols, rows: dims.rows }),
    [sessionId]
  )

  // Create terminal once on mount with current settings
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const s = settingsRef.current

    const term = new Terminal({
      cursorBlink: s.cursorBlink,
      cursorStyle: s.cursorStyle,
      fontSize: s.fontSize,
      fontFamily: s.fontFamily,
      scrollback: s.scrollback,
      smoothScrollDuration: s.smoothScrollDuration,
      allowTransparency: s.allowTransparency,
      theme: s.theme,
    })

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.open(container)
    fitAddon.fit()
    fitAddon.observeResize()

    termRef.current = term
    fitAddonRef.current = fitAddon

    const buffer = getRawBuffer(sessionId)
    for (const chunk of buffer) {
      term.write(chunk)
    }

    const dataDisposable = term.onData(handleData)
    const resizeDisposable = term.onResize(handleResize)

    const unsubscribe = subscribeTerminalData(sessionId, (data: string) => {
      term.write(data)
    })

    return () => {
      dataDisposable.dispose()
      resizeDisposable.dispose()
      unsubscribe()
      fitAddon.dispose()
      term.dispose()
      termRef.current = null
      fitAddonRef.current = null
    }
  }, [sessionId, handleData, handleResize])

  // Apply runtime setting changes to existing terminal
  useEffect(() => {
    const term = termRef.current
    if (!term) return

    term.options.fontSize = settings.fontSize
    term.options.fontFamily = settings.fontFamily
    term.options.cursorStyle = settings.cursorStyle
    term.options.cursorBlink = settings.cursorBlink
    term.options.smoothScrollDuration = settings.smoothScrollDuration
    term.options.allowTransparency = settings.allowTransparency
    term.options.theme = settings.theme

    // Font changes require re-fit
    fitAddonRef.current?.fit()
  }, [settings])

  // Re-fit when visibility changes
  useEffect(() => {
    if (active && fitAddonRef.current) {
      fitAddonRef.current.fit()
    }
  }, [active])

  return (
    <Box
      ref={containerRef}
      sx={{
        width: `100%`,
        height: `100%`,
        display: active ? `block` : `none`,
        '& canvas': {
          outline: `none`,
        },
      }}
    />
  )
}
```

Note: `scrollback` is NOT applied at runtime because changing it requires terminal recreation. It only takes effect on the next terminal mount (new session or page reload). This is acceptable — scrollback changes are rare. A small info hint in the UI will note this.

- [ ] **Step 2: Verify build**

Run: `cd repos/threads && pnpm types`
Expected: No type errors

- [ ] **Step 3: Commit**

```
feat(threads): wire TerminalView to terminal settings atom with runtime updates
```

---

### Task 4: Shared Setting Field Components

**Files:**
- Create: `repos/threads/src/components/TerminalSettings/TerminalFontSettings.tsx`
- Create: `repos/threads/src/components/TerminalSettings/TerminalCursorSettings.tsx`
- Create: `repos/threads/src/components/TerminalSettings/TerminalScrollSettings.tsx`
- Create: `repos/threads/src/components/TerminalSettings/TerminalThemeSettings.tsx`

These are the shared field components rendered by both the Settings page card and the quick-access popover. They read state via `useTerminalSettings()` and write via `updateTerminalSettings()`.

- [ ] **Step 1: Create TerminalFontSettings**

```typescript
// repos/threads/src/components/TerminalSettings/TerminalFontSettings.tsx
import {
  Box,
  Slider,
  Select,
  MenuItem,
  Typography,
  FormControl,
  InputLabel,
} from '@mui/material'
import { useTerminalSettings } from '@TTH/state/selectors'
import { updateTerminalSettings } from '@TTH/state/accessors'
import {
  TerminalFontOptions,
  TerminalFontSizeRange,
} from '@TTH/constants/terminal'

export const TerminalFontSettings = () => {
  const settings = useTerminalSettings()

  return (
    <Box sx={{ display: `flex`, flexDirection: `column`, gap: 2.5 }}>
      <FormControl size='small' fullWidth>
        <InputLabel>Font Family</InputLabel>
        <Select
          value={settings.fontFamily}
          label='Font Family'
          onChange={(e) => updateTerminalSettings({ fontFamily: e.target.value })}
        >
          {TerminalFontOptions.map((opt) => (
            <MenuItem key={opt.value} value={opt.value} sx={{ fontFamily: opt.value }}>
              {opt.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <Box>
        <Typography variant='body2' gutterBottom>
          Font Size: {settings.fontSize}px
        </Typography>
        <Slider
          value={settings.fontSize}
          min={TerminalFontSizeRange.min}
          max={TerminalFontSizeRange.max}
          step={TerminalFontSizeRange.step}
          onChange={(_, val) => updateTerminalSettings({ fontSize: val as number })}
          valueLabelDisplay='auto'
        />
      </Box>
    </Box>
  )
}
```

- [ ] **Step 2: Create TerminalCursorSettings**

```typescript
// repos/threads/src/components/TerminalSettings/TerminalCursorSettings.tsx
import {
  Box,
  Switch,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  FormControlLabel,
} from '@mui/material'
import { useTerminalSettings } from '@TTH/state/selectors'
import { updateTerminalSettings } from '@TTH/state/accessors'
import { TerminalCursorStyles } from '@TTH/constants/terminal'

export const TerminalCursorSettings = () => {
  const settings = useTerminalSettings()

  return (
    <Box sx={{ display: `flex`, flexDirection: `column`, gap: 2 }}>
      <Box>
        <Typography variant='body2' gutterBottom>
          Cursor Style
        </Typography>
        <ToggleButtonGroup
          value={settings.cursorStyle}
          exclusive
          onChange={(_, val) => {
            if (val) updateTerminalSettings({ cursorStyle: val })
          }}
          size='small'
        >
          {TerminalCursorStyles.map((opt) => (
            <ToggleButton key={opt.value} value={opt.value}>
              {opt.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Box>

      <FormControlLabel
        label='Cursor Blink'
        control={
          <Switch
            checked={settings.cursorBlink}
            onChange={(e) => updateTerminalSettings({ cursorBlink: e.target.checked })}
          />
        }
      />
    </Box>
  )
}
```

- [ ] **Step 3: Create TerminalScrollSettings**

```typescript
// repos/threads/src/components/TerminalSettings/TerminalScrollSettings.tsx
import { Box, Slider, Typography } from '@mui/material'
import { useTerminalSettings } from '@TTH/state/selectors'
import { updateTerminalSettings } from '@TTH/state/accessors'
import {
  TerminalScrollbackRange,
  TerminalSmoothScrollRange,
} from '@TTH/constants/terminal'

export const TerminalScrollSettings = () => {
  const settings = useTerminalSettings()

  return (
    <Box sx={{ display: `flex`, flexDirection: `column`, gap: 2.5 }}>
      <Box>
        <Typography variant='body2' gutterBottom>
          Scrollback Lines: {settings.scrollback.toLocaleString()}
        </Typography>
        <Slider
          value={settings.scrollback}
          min={TerminalScrollbackRange.min}
          max={TerminalScrollbackRange.max}
          step={TerminalScrollbackRange.step}
          onChange={(_, val) => updateTerminalSettings({ scrollback: val as number })}
          valueLabelDisplay='auto'
          valueLabelFormat={(v) => `${(v / 1000).toFixed(0)}k`}
        />
        <Typography variant='caption' color='text.secondary'>
          Takes effect on next session start
        </Typography>
      </Box>

      <Box>
        <Typography variant='body2' gutterBottom>
          Smooth Scroll: {settings.smoothScrollDuration}ms
        </Typography>
        <Slider
          value={settings.smoothScrollDuration}
          min={TerminalSmoothScrollRange.min}
          max={TerminalSmoothScrollRange.max}
          step={TerminalSmoothScrollRange.step}
          onChange={(_, val) =>
            updateTerminalSettings({ smoothScrollDuration: val as number })
          }
          valueLabelDisplay='auto'
          valueLabelFormat={(v) => (v === 0 ? `Off` : `${v}ms`)}
        />
      </Box>
    </Box>
  )
}
```

- [ ] **Step 4: Create TerminalThemeSettings**

```typescript
// repos/threads/src/components/TerminalSettings/TerminalThemeSettings.tsx
import { useState, useCallback } from 'react'
import type { ITheme } from 'ghostty-web'
import type { TTerminalThemePreset } from '@TTH/types/terminal.types'
import {
  Box,
  Select,
  MenuItem,
  Collapse,
  Typography,
  IconButton,
  FormControl,
  InputLabel,
} from '@mui/material'
import { ExpandMore, ExpandLess } from '@mui/icons-material'
import { useTerminalSettings } from '@TTH/state/selectors'
import { updateTerminalSettings } from '@TTH/state/accessors'
import {
  TerminalThemePresets,
  TerminalThemePresetLabels,
  TerminalThemeColorFields,
} from '@TTH/constants/terminal'

const ColorSwatch = ({
  color,
  label,
  onChange,
}: {
  color: string
  label: string
  onChange: (color: string) => void
}) => (
  <Box sx={{ display: `flex`, alignItems: `center`, gap: 1, minWidth: 160 }}>
    <Box
      component='input'
      type='color'
      value={color}
      onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
      sx={{
        width: 28,
        height: 28,
        padding: 0,
        border: `1px solid`,
        borderColor: `divider`,
        borderRadius: 0.5,
        cursor: `pointer`,
        '&::-webkit-color-swatch-wrapper': { padding: 0 },
        '&::-webkit-color-swatch': { border: `none`, borderRadius: 0.5 },
      }}
    />
    <Typography variant='caption' noWrap>
      {label}
    </Typography>
  </Box>
)

export const TerminalThemeSettings = () => {
  const settings = useTerminalSettings()
  const [colorsExpanded, setColorsExpanded] = useState(false)

  const handlePresetChange = useCallback((preset: TTerminalThemePreset) => {
    if (preset === `custom`) {
      updateTerminalSettings({ themePreset: `custom` })
      return
    }
    const theme = TerminalThemePresets[preset]
    updateTerminalSettings({ themePreset: preset, theme })
  }, [])

  const handleColorChange = useCallback(
    (key: string, color: string) => {
      const updatedTheme: ITheme = { ...settings.theme, [key]: color }
      updateTerminalSettings({ themePreset: `custom`, theme: updatedTheme })
    },
    [settings.theme]
  )

  return (
    <Box sx={{ display: `flex`, flexDirection: `column`, gap: 2 }}>
      <FormControl size='small' fullWidth>
        <InputLabel>Theme Preset</InputLabel>
        <Select
          value={settings.themePreset}
          label='Theme Preset'
          onChange={(e) => handlePresetChange(e.target.value as TTerminalThemePreset)}
        >
          {Object.entries(TerminalThemePresetLabels).map(([value, label]) => (
            <MenuItem key={value} value={value}>
              <Box sx={{ display: `flex`, alignItems: `center`, gap: 1 }}>
                {value !== `custom` && (
                  <Box
                    sx={{
                      width: 16,
                      height: 16,
                      borderRadius: 0.5,
                      bgcolor: TerminalThemePresets[value as keyof typeof TerminalThemePresets]?.background,
                      border: `1px solid`,
                      borderColor: `divider`,
                    }}
                  />
                )}
                {label}
              </Box>
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* Preview strip */}
      <Box
        sx={{
          display: `flex`,
          gap: 0.25,
          p: 0.5,
          borderRadius: 1,
          bgcolor: settings.theme.background,
          border: `1px solid`,
          borderColor: `divider`,
        }}
      >
        {[
          `black`, `red`, `green`, `yellow`, `blue`, `magenta`, `cyan`, `white`,
        ].map((key) => (
          <Box
            key={key}
            sx={{
              flex: 1,
              height: 12,
              borderRadius: 0.25,
              bgcolor: settings.theme[key as keyof ITheme],
            }}
          />
        ))}
      </Box>

      {/* Expandable individual color pickers */}
      <Box
        sx={{ display: `flex`, alignItems: `center`, cursor: `pointer` }}
        onClick={() => setColorsExpanded((v) => !v)}
      >
        <Typography variant='body2' sx={{ flex: 1 }}>
          Individual Colors
        </Typography>
        <IconButton size='small'>
          {colorsExpanded ? <ExpandLess /> : <ExpandMore />}
        </IconButton>
      </Box>

      <Collapse in={colorsExpanded}>
        <Box
          sx={{
            display: `grid`,
            gridTemplateColumns: `repeat(auto-fill, minmax(180px, 1fr))`,
            gap: 1.5,
            pt: 1,
          }}
        >
          {TerminalThemeColorFields.map(({ key, label }) => (
            <ColorSwatch
              key={key}
              color={(settings.theme[key as keyof ITheme] as string) || `#000000`}
              label={label}
              onChange={(color) => handleColorChange(key, color)}
            />
          ))}
        </Box>
      </Collapse>
    </Box>
  )
}
```

- [ ] **Step 5: Verify build**

Run: `cd repos/threads && pnpm types`
Expected: No type errors

- [ ] **Step 6: Commit**

```
feat(threads): add shared terminal setting field components
```

---

### Task 5: TerminalSettingsCard — Settings Page Integration

**Files:**
- Create: `repos/threads/src/components/TerminalSettings/TerminalSettingsCard.tsx`
- Create: `repos/threads/src/components/TerminalSettings/index.ts`
- Modify: `repos/threads/src/pages/Settings/Settings.tsx`

- [ ] **Step 1: Create TerminalSettingsCard**

```typescript
// repos/threads/src/components/TerminalSettings/TerminalSettingsCard.tsx
import { useCallback } from 'react'
import { Box, Card, Button, Divider, Typography, CardContent } from '@mui/material'
import { resetTerminalSettings } from '@TTH/state/accessors'
import { TerminalFontSettings } from './TerminalFontSettings'
import { TerminalCursorSettings } from './TerminalCursorSettings'
import { TerminalScrollSettings } from './TerminalScrollSettings'
import { TerminalThemeSettings } from './TerminalThemeSettings'

export const TerminalSettingsCard = () => {
  const handleReset = useCallback(() => {
    resetTerminalSettings()
  }, [])

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Box sx={{ display: `flex`, alignItems: `center`, mb: 1 }}>
          <Typography variant='h6' sx={{ flex: 1 }}>
            Terminal
          </Typography>
          <Button size='small' onClick={handleReset} color='secondary'>
            Reset to Defaults
          </Button>
        </Box>

        <Divider sx={{ my: 2 }} />
        <Typography variant='subtitle2' sx={{ mb: 1.5 }}>
          Font
        </Typography>
        <TerminalFontSettings />

        <Divider sx={{ my: 2 }} />
        <Typography variant='subtitle2' sx={{ mb: 1.5 }}>
          Cursor
        </Typography>
        <TerminalCursorSettings />

        <Divider sx={{ my: 2 }} />
        <Typography variant='subtitle2' sx={{ mb: 1.5 }}>
          Scrollback & Scroll
        </Typography>
        <TerminalScrollSettings />

        <Divider sx={{ my: 2 }} />
        <Typography variant='subtitle2' sx={{ mb: 1.5 }}>
          Theme
        </Typography>
        <TerminalThemeSettings />
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Create barrel export**

```typescript
// repos/threads/src/components/TerminalSettings/index.ts
export { TerminalSettingsCard } from './TerminalSettingsCard'
export { TerminalQuickSettings } from './TerminalQuickSettings'
```

Note: `TerminalQuickSettings` will be created in Task 6. Until then this export will cause a type error — if building between tasks, temporarily comment it out.

- [ ] **Step 3: Add TerminalSettingsCard to Settings page**

In `repos/threads/src/pages/Settings/Settings.tsx`, add the terminal card after the Appearance card:

```typescript
import { TerminalSettingsCard } from '@TTH/components/TerminalSettings/TerminalSettingsCard'
```

Then in the JSX, after the Appearance `<Card>` block (after line 90's closing `</Card>`):

```tsx
<TerminalSettingsCard />
```

- [ ] **Step 4: Verify build**

Run: `cd repos/threads && pnpm types`
Expected: No type errors

- [ ] **Step 5: Manual test**

Run: `cd repos/threads && pnpm start`
Navigate to `/settings`. Verify:
- Terminal card appears with Font, Cursor, Scrollback, and Theme sections
- Changing font size slider updates value label
- Selecting a theme preset shows the color preview strip
- Expanding "Individual Colors" shows 22 color pickers
- "Reset to Defaults" restores all settings
- Refresh the page — settings persist

- [ ] **Step 6: Commit**

```
feat(threads): add terminal settings card to Settings page
```

---

### Task 6: TerminalQuickSettings — Session Header Popover

**Files:**
- Create: `repos/threads/src/components/TerminalSettings/TerminalQuickSettings.tsx`
- Modify: `repos/threads/src/pages/Session/Session.tsx`

- [ ] **Step 1: Create TerminalQuickSettings popover**

This component renders a popover with tabs (Font, Cursor, Scroll, Theme) reusing the same field components from Task 4. It includes a gear icon button that opens the popover and a link to the full Settings page.

```typescript
// repos/threads/src/components/TerminalSettings/TerminalQuickSettings.tsx
import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router'
import {
  Box,
  Tab,
  Tabs,
  Button,
  Divider,
  Popover,
  IconButton,
  Typography,
} from '@mui/material'
import { Settings as SettingsIcon } from '@mui/icons-material'
import { TerminalFontSettings } from './TerminalFontSettings'
import { TerminalCursorSettings } from './TerminalCursorSettings'
import { TerminalScrollSettings } from './TerminalScrollSettings'
import { TerminalThemeSettings } from './TerminalThemeSettings'
import { resetTerminalSettings } from '@TTH/state/accessors'

const TabPanels = [
  { label: `Font`, Component: TerminalFontSettings },
  { label: `Cursor`, Component: TerminalCursorSettings },
  { label: `Scroll`, Component: TerminalScrollSettings },
  { label: `Theme`, Component: TerminalThemeSettings },
] as const

export const TerminalQuickSettings = () => {
  const navigate = useNavigate()
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null)
  const [tabIndex, setTabIndex] = useState(0)

  const handleOpen = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(e.currentTarget)
  }, [])

  const handleClose = useCallback(() => {
    setAnchorEl(null)
  }, [])

  const ActivePanel = TabPanels[tabIndex].Component

  return (
    <>
      <IconButton
        size='small'
        onClick={handleOpen}
        title='Terminal Settings'
      >
        <SettingsIcon fontSize='small' />
      </IconButton>
      <Popover
        open={!!anchorEl}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: `bottom`, horizontal: `right` }}
        transformOrigin={{ vertical: `top`, horizontal: `right` }}
        slotProps={{
          paper: {
            sx: { width: 360, maxHeight: `80vh`, overflow: `hidden`, display: `flex`, flexDirection: `column` },
          },
        }}
      >
        <Box sx={{ px: 2, pt: 1.5, pb: 0.5, display: `flex`, alignItems: `center` }}>
          <Typography variant='subtitle1' sx={{ flex: 1, fontWeight: 600 }}>
            Terminal Settings
          </Typography>
          <Button
            size='small'
            onClick={() => resetTerminalSettings()}
            color='secondary'
          >
            Reset
          </Button>
        </Box>
        <Tabs
          value={tabIndex}
          onChange={(_, v) => setTabIndex(v)}
          variant='fullWidth'
          sx={{ minHeight: 36, '& .MuiTab-root': { minHeight: 36, py: 0.5 } }}
        >
          {TabPanels.map(({ label }) => (
            <Tab key={label} label={label} />
          ))}
        </Tabs>
        <Divider />
        <Box sx={{ p: 2, overflow: `auto`, flex: 1 }}>
          <ActivePanel />
        </Box>
        <Divider />
        <Box sx={{ p: 1, display: `flex`, justifyContent: `center` }}>
          <Button
            size='small'
            onClick={() => {
              handleClose()
              navigate(`/settings`)
            }}
          >
            All Settings
          </Button>
        </Box>
      </Popover>
    </>
  )
}
```

- [ ] **Step 2: Add TerminalQuickSettings to Session header**

In `repos/threads/src/pages/Session/Session.tsx`, import and add the popover button in the `SessionHeader`:

```typescript
import { TerminalQuickSettings } from '@TTH/components/TerminalSettings/TerminalQuickSettings'
```

In the JSX, add it inside the `SessionHeader` — after the `ViewToggle` (or after `SessionCommands` if the GUI feature flag is off). Place it just before the closing `</SessionHeader>`:

```tsx
{hasSession && <TerminalQuickSettings />}
```

- [ ] **Step 3: Uncomment barrel export**

If you temporarily commented out the `TerminalQuickSettings` export in Task 5 Step 2, uncomment it now.

- [ ] **Step 4: Verify build**

Run: `cd repos/threads && pnpm types`
Expected: No type errors

- [ ] **Step 5: Manual test**

Run: `cd repos/threads && pnpm start`
Connect to a session. Verify:
- Gear icon appears in the session header
- Clicking it opens a popover with 4 tabs
- Each tab shows the same controls as the Settings page
- Changing font size immediately updates the terminal
- Changing theme preset immediately updates terminal colors
- Changing cursor style immediately changes the cursor
- "All Settings" link navigates to `/settings`
- "Reset" restores defaults
- Close popover — settings persist
- Open a second session tab — both terminals reflect the same settings

- [ ] **Step 6: Commit**

```
feat(threads): add terminal quick-settings popover to session header
```

---

### Task 7: Final Verification

- [ ] **Step 1: Full type check**

Run: `cd repos/threads && pnpm types`
Expected: Clean pass

- [ ] **Step 2: Build check**

Run: `cd repos/threads && pnpm build`
Expected: Clean build

- [ ] **Step 3: Unit tests**

Run: `cd repos/threads && pnpm test`
Expected: Existing tests still pass

- [ ] **Step 4: End-to-end manual test**

1. Open threads app, navigate to Settings → Terminal section
2. Change font to Fira Code, size 18, cursor block, theme Dracula
3. Navigate to a sandbox session — terminal should reflect all changes
4. Open quick-settings gear icon — settings should match what was set in Settings page
5. Change theme to Nord via quick-settings — terminal updates immediately
6. Navigate to Settings page — theme shows Nord
7. Click "Reset to Defaults" — terminal reverts to ThreadedStack theme, 14px, bar cursor
8. Close browser tab, reopen — defaults are restored (reset cleared localStorage)
9. Set custom preferences, close tab, reopen — custom preferences persist

- [ ] **Step 5: Commit**

```
feat(threads): terminal settings — types, state, settings page, quick-access popover
```
