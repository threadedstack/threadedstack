import type React from 'react'

/**
 * Maps MUI dark theme tokens to the CSS custom properties that
 * @earendil-works/mini-lit (and by extension pi-web-ui) reads.
 *
 * mini-lit themes define variables like --background, --foreground, --primary,
 * --border, etc. on :root / .dark. By setting these on a container element
 * we scope the overrides so they only affect pi-web-ui components.
 *
 * The values below match our MUI dark theme palette:
 *   Primary:    #3370DE
 *   Background: #1A1D21
 *   Paper:      #21252B
 *   Foreground: #cecece
 *   Muted:      #464646
 *   Border:     #2D3139
 *   Font:       Ubuntu, sans-serif
 */

const themeBridgeVars: Record<string, string> = {
  // Core backgrounds
  '--background': `#1A1D21`,
  '--foreground': `#cecece`,
  '--card': `#21252B`,
  '--card-foreground': `#cecece`,
  '--popover': `#21252B`,
  '--popover-foreground': `#cecece`,

  // Primary / accent
  '--primary': `#3370DE`,
  '--primary-foreground': `#ffffff`,
  '--secondary': `#21252B`,
  '--secondary-foreground': `#cecece`,
  '--accent': `#21252B`,
  '--accent-foreground': `#cecece`,

  // Muted
  '--muted': `#464646`,
  '--muted-foreground': `#9e9e9e`,

  // Destructive
  '--destructive': `#f44336`,
  '--destructive-foreground': `#ffffff`,

  // Border / input / ring
  '--border': `#2D3139`,
  '--input': `#2D3139`,
  '--ring': `#3370DE`,

  // Sidebar (mirror card)
  '--sidebar': `#21252B`,
  '--sidebar-foreground': `#cecece`,
  '--sidebar-primary': `#3370DE`,
  '--sidebar-primary-foreground': `#ffffff`,
  '--sidebar-accent': `#21252B`,
  '--sidebar-accent-foreground': `#cecece`,
  '--sidebar-border': `#2D3139`,
  '--sidebar-ring': `#3370DE`,

  // Typography
  '--font-sans': `'Ubuntu', sans-serif`,
  '--font-mono': `'JetBrains Mono', 'Fira Code', 'SF Mono', Consolas, 'Courier New', monospace`,

  // Border radius
  '--radius': `0.5rem`,
}

/**
 * Returns a React CSSProperties object with CSS custom property overrides.
 * Spread this onto the `style` prop of the container wrapping pi-web-ui components.
 *
 * @example
 * ```tsx
 * <Box style={getThemeBridgeStyles()}>
 *   <message-list ref={listRef} />
 * </Box>
 * ```
 */
export const getThemeBridgeStyles = (): React.CSSProperties => {
  return { ...themeBridgeVars } as React.CSSProperties
}

/**
 * Imperatively applies theme bridge CSS custom properties to a DOM element.
 * Useful when you need to set properties after mount or on a ref.
 *
 * @example
 * ```ts
 * useEffect(() => {
 *   if (containerRef.current) applyThemeBridge(containerRef.current)
 * }, [])
 * ```
 */
export const applyThemeBridge = (element: HTMLElement): void => {
  for (const [key, value] of Object.entries(themeBridgeVars)) {
    element.style.setProperty(key, value)
  }
}
