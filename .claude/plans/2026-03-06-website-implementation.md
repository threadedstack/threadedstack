# ThreadedStack Website Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the public-facing ThreadedStack website with landing page, inner pages, and docs shell.

**Architecture:** React + Vite SPA at `repos/website/`, consuming `@tdsk/components` for MUI theme consistency. Dual-mode theming (dark default), hybrid page structure (single-scroll landing + deep-dive pages + docs), MDX-powered documentation with shiki highlighting.

**Tech Stack:** React 18, Vite, MUI 6, Jotai, react-router 7, @mdx-js/rollup, shiki, rehype-pretty-code, pagefind, react-helmet-async

**Reference:** `docs/plans/2026-03-06-website-design.md` for full design spec.

---

## Phase 1: Foundation (Theme, Router, App Shell)

### Task 1: Install New Dependencies

**Files:**
- Modify: `repos/website/package.json`

**Step 1: Install production deps**

Run:
```bash
cd repos/website && pnpm add @mdx-js/rollup @mdx-js/react shiki rehype-pretty-code rehype-slug rehype-autolink-headings github-slugger react-helmet-async remark-gfm
```

**Step 2: Install dev deps**

Run:
```bash
cd repos/website && pnpm add -D pagefind @types/mdx
```

**Step 3: Verify install**

Run: `cd repos/website && pnpm ls @mdx-js/rollup shiki react-helmet-async`
Expected: All three listed with versions.

---

### Task 2: Theme State Atom

**Files:**
- Create: `repos/website/src/state/theme.ts`

**Step 1: Create theme atom with localStorage persistence**

```typescript
import { atomWithStorage } from 'jotai/utils'

export type TThemeType = 'light' | 'dark'

export const themeTypeAtom = atomWithStorage<TThemeType>('tdsk-web-theme', 'dark')
```

**Step 2: Verify file exists**

Run: `cat repos/website/src/state/theme.ts`

---

### Task 3: useMakeTheme Hook

**Files:**
- Create: `repos/website/src/hooks/useMakeTheme.ts`

**Step 1: Create the hook**

```typescript
import { useAtom } from 'jotai'
import { makeTheme } from '@tdsk/components'
import { themeTypeAtom } from '@TAF/state/theme'

export const useMakeTheme = () => {
  const [type] = useAtom(themeTypeAtom)
  return makeTheme({ type })
}
```

---

### Task 4: Global Styles

**Files:**
- Create: `repos/website/src/theme/GlobalStyles.tsx`

**Step 1: Create global CSS (matches admin pattern)**

```tsx
const globalCss = () => `
  :root {
    color-scheme: light dark;
    font-synthesis: none;
    text-rendering: optimizeLegibility;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  body {
    margin: 0;
    padding: 0;
    width: 100%;
    display: flex;
    overflow-x: hidden;
    min-height: 100vh;
    flex-direction: column;
    font-family: 'Ubuntu', sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  body #root {
    width: 100%;
    display: flex;
    flex-direction: column;
    min-height: 100vh;
  }

  :any-link {
    text-decoration: none;
  }

  :any-link:active {
    text-decoration: none;
  }

  code, kbd, pre {
    font-family: 'JetBrains Mono', 'Fira Code', 'SF Mono', Consolas, 'Courier New', monospace;
    font-size: 0.875em;
  }

  *:focus-visible {
    outline: 2px solid #3370DE;
    outline-offset: 2px;
  }

  ::selection {
    background-color: rgba(51, 112, 222, 0.2);
  }

  ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  ::-webkit-scrollbar-track {
    background: transparent;
  }

  ::-webkit-scrollbar-thumb {
    background: rgba(128, 128, 128, 0.3);
    border-radius: 4px;
  }

  ::-webkit-scrollbar-thumb:hover {
    background: rgba(128, 128, 128, 0.5);
  }
`

export const GlobalStyles = () => <style>{globalCss()}</style>
```

---

### Task 5: Router Setup

**Files:**
- Create: `repos/website/src/router.tsx`

**Step 1: Create route definitions**

```tsx
import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate } from 'react-router'

const MarketingLayout = lazy(() => import('@TAF/layouts/MarketingLayout'))
const DocsLayout = lazy(() => import('@TAF/layouts/DocsLayout'))
const Landing = lazy(() => import('@TAF/pages/Landing'))
const Features = lazy(() => import('@TAF/pages/Features'))
const Pricing = lazy(() => import('@TAF/pages/Pricing'))
const UseCases = lazy(() => import('@TAF/pages/UseCases'))
const DocsPage = lazy(() => import('@TAF/pages/docs/DocsPage'))

const S = ({ C }: { C: React.ComponentType }) => (
  <Suspense fallback={<div />}>
    <C />
  </Suspense>
)

export const router = createBrowserRouter([
  {
    path: '/',
    Component: () => <S C={MarketingLayout} />,
    children: [
      { index: true, Component: () => <S C={Landing} /> },
      { path: 'features', Component: () => <S C={Features} /> },
      { path: 'pricing', Component: () => <S C={Pricing} /> },
      { path: 'use-cases', Component: () => <S C={UseCases} /> },
    ],
  },
  {
    path: '/docs',
    Component: () => <S C={DocsLayout} />,
    children: [
      { index: true, Component: () => <Navigate replace to="/docs/getting-started" /> },
      { path: '*', Component: () => <S C={DocsPage} /> },
    ],
  },
  {
    path: '*',
    Component: () => <Navigate replace to="/" />,
  },
])
```

---

### Task 6: Wire App.tsx

**Files:**
- Modify: `repos/website/src/App.tsx`

**Step 1: Update App with theme, router, and global styles**

```tsx
import { router } from '@TAF/router'
import { RouterProvider } from 'react-router/dom'
import { useWindowResize } from '@tdsk/components'
import { GlobalStyles as MGS } from '@mui/material'
import { ThemeProvider } from '@mui/material/styles'
import { CssBaseline } from '@mui/material'
import { GlobalStyles } from '@TAF/theme/GlobalStyles'
import { useMakeTheme } from '@TAF/hooks/useMakeTheme'
import { HelmetProvider } from 'react-helmet-async'

const App = () => {
  useWindowResize()
  const theme = useMakeTheme()

  return (
    <HelmetProvider>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <GlobalStyles />
        <MGS
          styles={{
            body: {
              color: theme.palette.text.primary,
              backgroundColor: theme.palette.background.default,
            },
          }}
        />
        <RouterProvider router={router} />
      </ThemeProvider>
    </HelmetProvider>
  )
}

export default App
```

---

### Task 7: Placeholder Layouts and Pages

**Files:**
- Create: `repos/website/src/layouts/MarketingLayout.tsx`
- Create: `repos/website/src/layouts/DocsLayout.tsx`
- Create: `repos/website/src/pages/Landing.tsx`
- Create: `repos/website/src/pages/Features.tsx`
- Create: `repos/website/src/pages/Pricing.tsx`
- Create: `repos/website/src/pages/UseCases.tsx`
- Create: `repos/website/src/pages/docs/DocsPage.tsx`

**Step 1: Create MarketingLayout**

```tsx
import { Outlet } from 'react-router'
import Box from '@mui/material/Box'

const MarketingLayout = () => (
  <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
    {/* Header will go here */}
    <Box component="main" sx={{ flex: 1 }}>
      <Outlet />
    </Box>
    {/* Footer will go here */}
  </Box>
)

export default MarketingLayout
```

**Step 2: Create DocsLayout**

```tsx
import { Outlet } from 'react-router'
import Box from '@mui/material/Box'

const DocsLayout = () => (
  <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
    {/* Header will go here */}
    <Box sx={{ display: 'flex', flex: 1 }}>
      {/* Sidebar will go here */}
      <Box component="main" sx={{ flex: 1, maxWidth: 800, mx: 'auto', p: 3 }}>
        <Outlet />
      </Box>
      {/* TOC will go here */}
    </Box>
  </Box>
)

export default DocsLayout
```

**Step 3: Create placeholder pages**

Each page (Landing, Features, Pricing, UseCases, DocsPage) follows:

```tsx
// Landing.tsx
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

const Landing = () => (
  <Box sx={{ p: 4 }}>
    <Typography variant="h3">ThreadedStack</Typography>
    <Typography variant="body1" color="text.secondary">Landing page - sections coming soon</Typography>
  </Box>
)

export default Landing
```

Replace title/body per page. DocsPage at `pages/docs/DocsPage.tsx` shows "Docs - coming soon".

**Step 4: Verify dev server**

Run: `cd repos/website && pnpm start`
Expected: Opens at http://localhost:5884/, shows landing placeholder. Navigate to /features, /pricing, /use-cases, /docs — each shows its placeholder.

---

## Phase 2: Shared Components

### Task 8: SectionContainer

**Files:**
- Create: `repos/website/src/components/Shared/SectionContainer.tsx`

```tsx
import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import type { SxProps, Theme } from '@mui/material'

type Props = {
  children: React.ReactNode
  sx?: SxProps<Theme>
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl'
  id?: string
}

const SectionContainer = ({ children, sx, maxWidth = 'lg', id }: Props) => (
  <Box component="section" id={id} sx={{ py: { xs: 6, md: 10 }, ...sx }}>
    <Container maxWidth={maxWidth}>{children}</Container>
  </Box>
)

export default SectionContainer
```

---

### Task 9: SectionHeader

**Files:**
- Create: `repos/website/src/components/Shared/SectionHeader.tsx`

```tsx
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

type Props = {
  overline?: string
  title: string
  subtitle?: string
  align?: 'left' | 'center'
}

const SectionHeader = ({ overline, title, subtitle, align = 'center' }: Props) => (
  <Box sx={{ mb: { xs: 4, md: 6 }, textAlign: align, maxWidth: align === 'center' ? 700 : undefined, mx: align === 'center' ? 'auto' : undefined }}>
    {overline && (
      <Typography variant="overline" color="primary" sx={{ letterSpacing: 2, fontWeight: 600, mb: 1, display: 'block' }}>
        {overline}
      </Typography>
    )}
    <Typography variant="h3" sx={{ mb: 1.5 }}>{title}</Typography>
    {subtitle && (
      <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 560, mx: align === 'center' ? 'auto' : undefined }}>
        {subtitle}
      </Typography>
    )}
  </Box>
)

export default SectionHeader
```

---

### Task 10: FeatureCard

**Files:**
- Create: `repos/website/src/components/Shared/FeatureCard.tsx`

```tsx
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import Typography from '@mui/material/Typography'
import Box from '@mui/material/Box'
import type { SvgIconComponent } from '@mui/icons-material'

type Props = {
  icon: SvgIconComponent
  title: string
  description: string
}

const FeatureCard = ({ icon: Icon, title, description }: Props) => (
  <Card sx={{ height: '100%', transition: 'transform 0.2s, box-shadow 0.2s', '&:hover': { transform: 'translateY(-4px)' } }}>
    <CardContent sx={{ p: 3 }}>
      <Box sx={{ mb: 2, color: 'primary.main', display: 'flex', alignItems: 'center', justifyContent: 'center', width: 48, height: 48, borderRadius: 2, bgcolor: 'primary.main', opacity: 0.1 }}>
        <Icon sx={{ fontSize: 28, color: 'primary.main', opacity: 1, position: 'absolute' }} />
      </Box>
      <Box sx={{ position: 'relative' }}>
        <Box sx={{ position: 'absolute', top: -50, left: 0, color: 'primary.main' }}>
          <Icon sx={{ fontSize: 28 }} />
        </Box>
      </Box>
      <Typography variant="h6" sx={{ mt: 5, mb: 1 }}>{title}</Typography>
      <Typography variant="body2" color="text.secondary">{description}</Typography>
    </CardContent>
  </Card>
)

export default FeatureCard
```

**Note:** The icon positioning above is intentionally split — the tinted bg box and the actual icon are separate layers. During implementation, simplify to a single approach:

```tsx
const FeatureCard = ({ icon: Icon, title, description }: Props) => (
  <Card sx={{ height: '100%', transition: 'transform 0.2s, box-shadow 0.2s', '&:hover': { transform: 'translateY(-4px)' } }}>
    <CardContent sx={{ p: 3 }}>
      <Box sx={{ mb: 2, width: 48, height: 48, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(51,112,222,0.12)' : 'rgba(51,112,222,0.08)' }}>
        <Icon sx={{ fontSize: 28, color: 'primary.main' }} />
      </Box>
      <Typography variant="h6" sx={{ mb: 1 }}>{title}</Typography>
      <Typography variant="body2" color="text.secondary">{description}</Typography>
    </CardContent>
  </Card>
)
```

---

### Task 11: PricingCard

**Files:**
- Create: `repos/website/src/components/Shared/PricingCard.tsx`

```tsx
import Card from '@mui/material/Card'
import CardContent from '@mui/material/CardContent'
import CardActions from '@mui/material/CardActions'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import CheckIcon from '@mui/icons-material/Check'

type Feature = { label: string; included: boolean }

type Props = {
  name: string
  price: string
  description: string
  features: Feature[]
  cta: string
  highlighted?: boolean
  onCtaClick?: () => void
}

const PricingCard = ({ name, price, description, features, cta, highlighted, onCtaClick }: Props) => (
  <Card sx={{
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    ...(highlighted ? { borderColor: 'primary.main', borderWidth: 2 } : {}),
  }}>
    {highlighted && (
      <Chip label="Popular" color="primary" size="small" sx={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)' }} />
    )}
    <CardContent sx={{ p: 3, flex: 1 }}>
      <Typography variant="h6" sx={{ mb: 0.5 }}>{name}</Typography>
      <Typography variant="h4" sx={{ mb: 1 }}>{price}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>{description}</Typography>
      {features.map((f) => (
        <Box key={f.label} sx={{ display: 'flex', alignItems: 'center', mb: 1, opacity: f.included ? 1 : 0.4 }}>
          <CheckIcon sx={{ fontSize: 18, mr: 1, color: f.included ? 'success.main' : 'text.disabled' }} />
          <Typography variant="body2">{f.label}</Typography>
        </Box>
      ))}
    </CardContent>
    <CardActions sx={{ p: 3, pt: 0 }}>
      <Button fullWidth variant={highlighted ? 'contained' : 'outlined'} onClick={onCtaClick}>{cta}</Button>
    </CardActions>
  </Card>
)

export default PricingCard
```

---

### Task 12: StepItem

**Files:**
- Create: `repos/website/src/components/Shared/StepItem.tsx`

```tsx
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'

type Props = {
  number: number
  title: string
  description: string
}

const StepItem = ({ number, title, description }: Props) => (
  <Box sx={{ textAlign: 'center', flex: 1, px: 2 }}>
    <Box sx={{
      width: 48, height: 48, borderRadius: '50%', bgcolor: 'primary.main', color: 'primary.contrastText',
      display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 2,
      fontSize: '1.25rem', fontWeight: 700,
    }}>
      {number}
    </Box>
    <Typography variant="h6" sx={{ mb: 1 }}>{title}</Typography>
    <Typography variant="body2" color="text.secondary">{description}</Typography>
  </Box>
)

export default StepItem
```

---

### Task 13: CodeBlock (ref-based, no dangerouslySetInnerHTML)

**Files:**
- Create: `repos/website/src/components/Shared/CodeBlock.tsx`

**Step 1: Create CodeBlock using ref-based approach**

```tsx
import { useEffect, useRef, useState, useCallback } from 'react'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import CheckIcon from '@mui/icons-material/Check'

type Props = {
  code: string
  language?: string
}

const CodeBlock = ({ code, language = 'typescript' }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let cancelled = false
    const highlight = async () => {
      const { codeToHtml } = await import('shiki')
      const html = await codeToHtml(code, {
        lang: language,
        theme: 'github-dark',
      })
      if (!cancelled && containerRef.current) {
        // Use ref to set content - avoids dangerouslySetInnerHTML
        const el = document.createElement('div')
        el.innerHTML = html
        containerRef.current.replaceChildren(el)
      }
    }
    highlight()
    return () => { cancelled = true }
  }, [code, language])

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [code])

  return (
    <Box sx={{
      position: 'relative', borderRadius: '12px', overflow: 'hidden', bgcolor: '#141414',
      '& pre': { m: 0, p: 2.5, overflow: 'auto', fontSize: '0.875rem', lineHeight: 1.7, fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', Consolas, monospace" },
      '& code': { fontFamily: 'inherit' },
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', fontSize: 11 }}>
          {language}
        </Typography>
        <IconButton size="small" onClick={handleCopy} sx={{ color: 'rgba(255,255,255,0.4)', '&:hover': { color: 'rgba(255,255,255,0.7)' } }}>
          {copied ? <CheckIcon sx={{ fontSize: 16 }} /> : <ContentCopyIcon sx={{ fontSize: 16 }} />}
        </IconButton>
      </Box>
      <Box ref={containerRef} />
    </Box>
  )
}

export default CodeBlock
```

---

### Task 14: CalloutBox

**Files:**
- Create: `repos/website/src/components/Shared/CalloutBox.tsx`

```tsx
import Alert from '@mui/material/Alert'
import type { AlertColor } from '@mui/material/Alert'

type Props = {
  severity?: AlertColor
  children: React.ReactNode
}

const severityMap: Record<string, AlertColor> = {
  note: 'info',
  warning: 'warning',
  tip: 'success',
}

const CalloutBox = ({ severity = 'info', children }: Props) => (
  <Alert severity={severityMap[severity] || severity} sx={{ my: 2, borderRadius: 2 }}>
    {children}
  </Alert>
)

export default CalloutBox
```

---

## Phase 3: Header & Footer

### Task 15: useScrollPosition Hook

**Files:**
- Create: `repos/website/src/hooks/useScrollPosition.ts`

```typescript
import { useState, useEffect } from 'react'

export const useScrollPosition = (threshold = 80) => {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > threshold)
    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll()
    return () => window.removeEventListener('scroll', handleScroll)
  }, [threshold])

  return scrolled
}
```

---

### Task 16: ThemeToggle

**Files:**
- Create: `repos/website/src/components/Header/ThemeToggle.tsx`

```tsx
import { useAtom } from 'jotai'
import IconButton from '@mui/material/IconButton'
import LightModeIcon from '@mui/icons-material/LightMode'
import DarkModeIcon from '@mui/icons-material/DarkMode'
import { themeTypeAtom } from '@TAF/state/theme'

const ThemeToggle = () => {
  const [type, setType] = useAtom(themeTypeAtom)

  return (
    <IconButton
      onClick={() => setType(type === 'dark' ? 'light' : 'dark')}
      sx={{ color: 'text.secondary' }}
      size="small"
    >
      {type === 'dark' ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
    </IconButton>
  )
}

export default ThemeToggle
```

---

### Task 17: Header Component

**Files:**
- Create: `repos/website/src/components/Header/Header.tsx`

```tsx
import { useLocation, Link as RouterLink } from 'react-router'
import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import MenuIcon from '@mui/icons-material/Menu'
import GitHubIcon from '@mui/icons-material/GitHub'
import { useScrollPosition } from '@TAF/hooks/useScrollPosition'
import ThemeToggle from './ThemeToggle'
import { useState } from 'react'
import MobileMenu from './MobileMenu'

const navItems = [
  { label: 'Features', path: '/features' },
  { label: 'Pricing', path: '/pricing' },
  { label: 'Docs', path: '/docs' },
]

const Header = () => {
  const scrolled = useScrollPosition()
  const { pathname } = useLocation()
  const isLanding = pathname === '/'
  const solid = !isLanding || scrolled
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <>
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          height: 64,
          zIndex: 1300,
          bgcolor: solid ? 'background.paper' : 'transparent',
          borderBottom: solid ? 1 : 0,
          borderColor: 'divider',
          backdropFilter: solid ? 'blur(12px)' : 'none',
          transition: 'background-color 0.3s, border-bottom 0.3s, backdrop-filter 0.3s',
        }}
      >
        <Toolbar sx={{ height: 64, justifyContent: 'space-between' }}>
          <Box component={RouterLink} to="/" sx={{ display: 'flex', alignItems: 'center', gap: 1, textDecoration: 'none' }}>
            <Box component="img" src="/logo.svg" alt="ThreadedStack" sx={{ width: 24, height: 24 }} />
            <Typography variant="subtitle1" sx={{
              fontWeight: 700,
              background: (t) => t.palette.mode === 'dark'
                ? `linear-gradient(135deg, ${t.palette.primary.main}, ${t.palette.primary.light})`
                : t.palette.text.primary,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: (t) => t.palette.mode === 'dark' ? 'transparent' : undefined,
            }}>
              ThreadedStack
            </Typography>
          </Box>

          <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', gap: 1 }}>
            {navItems.map((item) => (
              <Button key={item.path} component={RouterLink} to={item.path} color="inherit" size="small"
                sx={{ color: pathname.startsWith(item.path) ? 'primary.main' : 'text.secondary' }}>
                {item.label}
              </Button>
            ))}
            <IconButton size="small" href="https://github.com" target="_blank" sx={{ color: 'text.secondary', ml: 0.5 }}>
              <GitHubIcon fontSize="small" />
            </IconButton>
            <ThemeToggle />
            <Button component={RouterLink} to="/docs/getting-started" variant="contained" size="small" sx={{ ml: 1 }}>
              Get Started
            </Button>
          </Box>

          <Box sx={{ display: { xs: 'flex', md: 'none' }, alignItems: 'center', gap: 0.5 }}>
            <ThemeToggle />
            <IconButton onClick={() => setMobileOpen(true)} sx={{ color: 'text.primary' }}>
              <MenuIcon />
            </IconButton>
          </Box>
        </Toolbar>
      </AppBar>
      <MobileMenu open={mobileOpen} onClose={() => setMobileOpen(false)} navItems={navItems} />
    </>
  )
}

export default Header
```

---

### Task 18: MobileMenu

**Files:**
- Create: `repos/website/src/components/Header/MobileMenu.tsx`

```tsx
import Drawer from '@mui/material/Drawer'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemText from '@mui/material/ListItemText'
import Button from '@mui/material/Button'
import Box from '@mui/material/Box'
import { Link as RouterLink } from 'react-router'

type Props = {
  open: boolean
  onClose: () => void
  navItems: { label: string; path: string }[]
}

const MobileMenu = ({ open, onClose, navItems }: Props) => (
  <Drawer anchor="right" open={open} onClose={onClose} PaperProps={{ sx: { width: 280, pt: 2 } }}>
    <List>
      {navItems.map((item) => (
        <ListItemButton key={item.path} component={RouterLink} to={item.path} onClick={onClose}>
          <ListItemText primary={item.label} />
        </ListItemButton>
      ))}
    </List>
    <Box sx={{ p: 2 }}>
      <Button component={RouterLink} to="/docs/getting-started" variant="contained" fullWidth onClick={onClose}>
        Get Started
      </Button>
    </Box>
  </Drawer>
)

export default MobileMenu
```

---

### Task 19: MarketingFooter

**Files:**
- Create: `repos/website/src/components/Footer/MarketingFooter.tsx`

```tsx
import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'
import Link from '@mui/material/Link'
import Grid from '@mui/material/Grid'
import IconButton from '@mui/material/IconButton'
import GitHubIcon from '@mui/icons-material/GitHub'
import { Link as RouterLink } from 'react-router'
import ThemeToggle from '@TAF/components/Header/ThemeToggle'

const columns = [
  {
    title: 'Product',
    links: [
      { label: 'Features', to: '/features' },
      { label: 'Pricing', to: '/pricing' },
      { label: 'Use Cases', to: '/use-cases' },
    ],
  },
  {
    title: 'Docs',
    links: [
      { label: 'Getting Started', to: '/docs/getting-started' },
      { label: 'API Reference', to: '/docs/api-reference' },
      { label: 'Guides', to: '/docs/guides' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About', to: '#' },
      { label: 'Contact', to: '#' },
    ],
  },
]

const MarketingFooter = () => (
  <Box component="footer" sx={{ bgcolor: (t) => t.palette.mode === 'dark' ? '#1E2228' : '#f2f2f2', borderTop: 1, borderColor: 'divider', mt: 'auto' }}>
    <Container maxWidth="lg" sx={{ py: 6 }}>
      <Grid container spacing={4}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <Box component="img" src="/logo.svg" alt="ThreadedStack" sx={{ width: 20, height: 20 }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>ThreadedStack</Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2, maxWidth: 280 }}>
            The developer platform for building autonomous AI agents without infrastructure headaches.
          </Typography>
          <ThemeToggle />
        </Grid>
        {columns.map((col) => (
          <Grid key={col.title} size={{ xs: 6, md: 2 }}>
            <Typography variant="overline" sx={{ mb: 1.5, display: 'block', letterSpacing: 1.5, fontSize: 11 }}>{col.title}</Typography>
            {col.links.map((link) => (
              <Link key={link.label} component={RouterLink} to={link.to} color="text.secondary" variant="body2" sx={{ display: 'block', mb: 1, '&:hover': { color: 'primary.main' } }}>
                {link.label}
              </Link>
            ))}
          </Grid>
        ))}
      </Grid>
    </Container>
    <Box sx={{ borderTop: 1, borderColor: 'divider', py: 2 }}>
      <Container maxWidth="lg" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="caption" color="text.secondary">
          &copy; {new Date().getFullYear()} ThreadedStack. All rights reserved.
        </Typography>
        <IconButton size="small" href="https://github.com" target="_blank" sx={{ color: 'text.secondary' }}>
          <GitHubIcon fontSize="small" />
        </IconButton>
      </Container>
    </Box>
  </Box>
)

export default MarketingFooter
```

---

### Task 20: DocsFooter

**Files:**
- Create: `repos/website/src/components/Footer/DocsFooter.tsx`

```tsx
import Box from '@mui/material/Box'
import Container from '@mui/material/Container'
import Typography from '@mui/material/Typography'

const DocsFooter = () => (
  <Box component="footer" sx={{ borderTop: 1, borderColor: 'divider', py: 2, mt: 'auto' }}>
    <Container maxWidth="lg">
      <Typography variant="caption" color="text.secondary">
        &copy; {new Date().getFullYear()} ThreadedStack. All rights reserved.
      </Typography>
    </Container>
  </Box>
)

export default DocsFooter
```

---

### Task 21: Wire Header/Footer into Layouts

**Files:**
- Modify: `repos/website/src/layouts/MarketingLayout.tsx`
- Modify: `repos/website/src/layouts/DocsLayout.tsx`

**Step 1: Update MarketingLayout**

```tsx
import { Outlet } from 'react-router'
import Box from '@mui/material/Box'
import Header from '@TAF/components/Header/Header'
import MarketingFooter from '@TAF/components/Footer/MarketingFooter'

const MarketingLayout = () => (
  <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
    <Header />
    <Box component="main" sx={{ flex: 1 }}>
      <Outlet />
    </Box>
    <MarketingFooter />
  </Box>
)

export default MarketingLayout
```

**Step 2: Update DocsLayout**

```tsx
import { Outlet } from 'react-router'
import Box from '@mui/material/Box'
import Header from '@TAF/components/Header/Header'
import DocsFooter from '@TAF/components/Footer/DocsFooter'

const DocsLayout = () => (
  <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
    <Header />
    <Box sx={{ display: 'flex', flex: 1 }}>
      {/* DocsSidebar will go here */}
      <Box component="main" sx={{ flex: 1, maxWidth: 800, mx: 'auto', p: 3 }}>
        <Outlet />
      </Box>
      {/* TOC will go here */}
    </Box>
    <DocsFooter />
  </Box>
)

export default DocsLayout
```

**Step 3: Verify**

Run dev server. Confirm header shows on all pages, transparent on landing, solid on inner pages. Footer visible. Theme toggle works. Mobile menu works at narrow viewport.

---

## Phase 4: Landing Page Sections

### Task 22: Hero + Architecture Diagram

**Files:**
- Create: `repos/website/src/components/Landing/Hero.tsx`
- Create: `repos/website/src/components/Landing/ArchitectureDiagram.tsx`

**Hero.tsx** — Full viewport section with:
- Left column: overline ("THE DEVELOPER PLATFORM FOR AI AGENTS", primary color, letter-spaced), headline (h1, gradient text via `background: linear-gradient(135deg, primary.main, primary[300])` dark / `primary.main, primary[700]` light + `WebkitBackgroundClip: text` + `WebkitTextFillColor: transparent`), subheadline (body1, muted), primary CTA button ("Get Started Free"), secondary CTA ("Request a Demo", outlined), helper text below CTAs
- Right column: `<ArchitectureDiagram />`
- Background: dark mode `#1A1D21` + soft radial glow (primary at 5%) + `@keyframes float` animated blobs. Light mode `#FAFBFC` + subtle gradients

**ArchitectureDiagram.tsx** — Pure SVG with CSS animations:
- Nodes: Client, Caddy, Auth Proxy, Backend, AI Agents, FaaS, Secrets, Sandbox
- Rounded rect nodes with text labels
- Dashed animated connection lines (`stroke-dasharray` + `stroke-dashoffset` animation)
- Glowing dots flowing along paths (`@keyframes flowDot` with `offset-path`)
- All CSS animations (no canvas/WebGL)
- Mobile: hide or show simplified static version

**Implementation notes:**
- Hero min-height: 100vh, display: flex, alignItems: center
- Use Grid container: left 7 cols, right 5 cols (md breakpoint swap to stack)
- SVG viewBox sized to fit, responsive width 100%
- Dot animation: small circles with `animateMotion` SVG element along `path` elements

---

### Task 23: Features Section

**Files:**
- Create: `repos/website/src/components/Landing/Features.tsx`

Uses `SectionContainer`, `SectionHeader`, and a 3-col `Grid` of 6 `FeatureCard` components.

Feature data:
1. Auth Proxy — SecurityIcon — "Enterprise-grade JWT/JWKS authentication gateway..."
2. AI Agent Runtime — SmartToyIcon — "Run autonomous AI agents with built-in tool execution..."
3. Serverless Compute — CloudIcon — "Deploy functions that execute in isolated sandboxes..."
4. Secrets Management — VpnKeyIcon — "AES-256-GCM encrypted secrets, injected server-side..."
5. Threads & Memory — ForumIcon — "Persistent conversation threads with message branching..."
6. Multi-Tenant Design — BusinessIcon — "Organization and project hierarchy with role-based access..."

Grid: `xs={12} sm={6} md={4}` per item.

---

### Task 24: HowItWorks Section

**Files:**
- Create: `repos/website/src/components/Landing/HowItWorks.tsx`

Uses `SectionContainer`, `SectionHeader`, row of 4 `StepItem` components connected by animated SVG line.

Steps:
1. Create an Organization — "Set up your workspace..."
2. Configure an Agent — "Define your AI agent's capabilities..."
3. Connect a Provider — "Link your preferred AI provider..."
4. Start Building — "Deploy and interact via API or dashboard..."

Animated line: SVG positioned behind step items, horizontal line with `stroke-dasharray` animation triggered by IntersectionObserver. On mobile, stack vertically without the line.

---

### Task 25: CodePreview Section

**Files:**
- Create: `repos/website/src/components/Landing/CodePreview.tsx`

Two-column layout. Left: descriptive text about API simplicity. Right: `CodeBlock` component with a curl example:

```bash
# Create an AI agent session
curl -X POST https://api.threadedstack.app/ai/sessions \
  -H "Authorization: Bearer tdsk_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "agent_abc123",
    "orgId": "org_xyz789"
  }'
```

Uses `SectionContainer` and `Grid` (left 5 cols, right 7 cols).

---

### Task 26: Pricing Section

**Files:**
- Create: `repos/website/src/components/Landing/Pricing.tsx`

Uses `SectionContainer`, `SectionHeader`, 4-col `Grid` of `PricingCard` components.

Tier data (from `repos/domain/src/types/payments.types.ts`):
- Free: $0/mo, 1 project, 1 member, 5 endpoints, 10 threads
- Basic: $19/mo, 3 projects, 5 members, 25 endpoints, 100 threads
- Developer: $49/mo (highlighted), 10 projects, 15 members, 100 endpoints, 1000 threads
- Pro: $149/mo, unlimited projects, unlimited members, unlimited endpoints, unlimited threads

"See full comparison" link to `/pricing`.

---

### Task 27: UseCases Section

**Files:**
- Create: `repos/website/src/components/Landing/UseCases.tsx`

Uses `SectionContainer`, `SectionHeader`, 2x2 `Grid` of larger cards.

Use cases:
1. Autonomous AI Agents — SmartToyIcon — description + "Learn more" link to `/use-cases`
2. Secure API Orchestration — ApiIcon — description + link
3. Serverless Functions — FunctionsIcon — description + link
4. Multi-Tenant SaaS Platform — BusinessIcon — description + link

Cards: MUI Card with more padding, icon, title (h5), 2-3 sentence description, "Learn more ->" text button.

---

### Task 28: Testimonials Section

**Files:**
- Create: `repos/website/src/components/Landing/Testimonials.tsx`

Placeholder "social proof" section. Stat row showing:
- "1000+" — Organizations
- "50K+" — API Calls Daily
- "99.9%" — Uptime
- "< 100ms" — Avg Response

Uses `SectionContainer`, 4-column `Grid`, each stat: large h3 number + body2 label, center-aligned.

---

### Task 29: CTABanner

**Files:**
- Create: `repos/website/src/components/Landing/CTABanner.tsx`

Full-width gradient banner section:
- Background: `linear-gradient(135deg, primary[900], primary[700])`
- "Ready to build?" (h4, white)
- Two buttons: "Get Started Free" (contained, white text on primary) + "Read the Docs" (outlined, white)

Uses `SectionContainer` with custom bg, center-aligned text and buttons.

---

### Task 30: Compose Landing Page

**Files:**
- Modify: `repos/website/src/pages/Landing.tsx`

```tsx
import Hero from '@TAF/components/Landing/Hero'
import Features from '@TAF/components/Landing/Features'
import HowItWorks from '@TAF/components/Landing/HowItWorks'
import CodePreview from '@TAF/components/Landing/CodePreview'
import Pricing from '@TAF/components/Landing/Pricing'
import UseCases from '@TAF/components/Landing/UseCases'
import Testimonials from '@TAF/components/Landing/Testimonials'
import CTABanner from '@TAF/components/Landing/CTABanner'

const Landing = () => (
  <>
    <Hero />
    <Features />
    <HowItWorks />
    <CodePreview />
    <Pricing />
    <UseCases />
    <Testimonials />
    <CTABanner />
  </>
)

export default Landing
```

**Verify:** Dev server shows full landing page with all sections. Theme toggle switches correctly. Responsive at mobile widths.

---

## Phase 5: Inner Pages

### Task 31: Features Deep-Dive Page

**Files:**
- Modify: `repos/website/src/pages/Features.tsx`

Mini hero (smaller, no diagram) + 6 feature sections with alternating left/right layout using Grid. Each section: title, 2-3 paragraph description, code snippet or diagram placeholder, "Read the docs" link. Uses `SectionContainer` for each section, alternates `direction="row"` and `direction="row-reverse"` on Grid.

---

### Task 32: Pricing Deep-Dive Page

**Files:**
- Modify: `repos/website/src/pages/Pricing.tsx`

Mini hero + plan cards row (same as landing section) + full comparison MUI Table (12 quota rows x 4 tier columns: projects, members, endpoints, threads, messages, functionCalls, runtime, orgSecrets, projectSecrets, organizations, price, retention) + FAQ MUI Accordion (5-6 common questions) + CTABanner at bottom.

---

### Task 33: Use Cases Deep-Dive Page

**Files:**
- Modify: `repos/website/src/pages/UseCases.tsx`

Mini hero + 4 expanded use case sections. Each: title, extended description, scenario walkthrough, relevant feature callouts, code snippet using `CodeBlock`. Similar alternating layout to Features page.

---

## Phase 6: Docs Infrastructure

### Task 34: MDX Vite Plugin Configuration

**Files:**
- Modify: `repos/website/configs/vite.workspace.ts`

**Step 1: Replace markdown-loader with MDX pipeline**

Replace the `markdown-loader` plugin block with:

```typescript
import mdx from '@mdx-js/rollup'
import remarkGfm from 'remark-gfm'
import rehypeSlug from 'rehype-slug'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'
```

Add to plugins array (before `react()`):

```typescript
mdx({
  remarkPlugins: [remarkGfm],
  rehypePlugins: [
    rehypeSlug,
    [rehypeAutolinkHeadings, { behavior: 'wrap' }],
  ],
}),
```

Remove the old `markdown-loader` plugin object.

**Step 2: Verify**

Run: `cd repos/website && pnpm start`
Expected: No errors. MDX files can be imported as components.

---

### Task 35: MDXComponents Mapping

**Files:**
- Create: `repos/website/src/components/Docs/MDXComponents.tsx`

Maps MDX elements to MUI components:

```tsx
import Typography from '@mui/material/Typography'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Box from '@mui/material/Box'
import Link from '@mui/material/Link'
import Divider from '@mui/material/Divider'
import CodeBlock from '@TAF/components/Shared/CodeBlock'
import CalloutBox from '@TAF/components/Shared/CalloutBox'

export const mdxComponents = {
  h1: (props: any) => <Typography variant="h3" sx={{ mb: 3, mt: 4 }} {...props} />,
  h2: (props: any) => <Typography variant="h4" sx={{ mb: 2, mt: 4 }} {...props} />,
  h3: (props: any) => <Typography variant="h5" sx={{ mb: 1.5, mt: 3 }} {...props} />,
  p: (props: any) => <Typography variant="body1" sx={{ mb: 2, lineHeight: 1.8 }} {...props} />,
  a: (props: any) => <Link color="primary" {...props} />,
  hr: () => <Divider sx={{ my: 3 }} />,
  blockquote: (props: any) => (
    <Box sx={{ borderLeft: 3, borderColor: 'primary.main', bgcolor: 'action.hover', pl: 2, py: 1, my: 2, borderRadius: 1 }} {...props} />
  ),
  table: (props: any) => <Table size="small" sx={{ my: 2 }} {...props} />,
  thead: (props: any) => <TableHead {...props} />,
  tbody: (props: any) => <TableBody {...props} />,
  tr: (props: any) => <TableRow {...props} />,
  th: (props: any) => <TableCell sx={{ fontWeight: 600 }} {...props} />,
  td: (props: any) => <TableCell {...props} />,
  pre: ({ children }: any) => <>{children}</>,
  code: ({ className, children }: any) => {
    const language = className?.replace('language-', '') || 'text'
    if (!className) return <Box component="code" sx={{ bgcolor: 'action.hover', px: 0.75, py: 0.25, borderRadius: 0.5, fontSize: '0.875em' }}>{children}</Box>
    return <CodeBlock code={String(children).trim()} language={language} />
  },
  Note: ({ children }: any) => <CalloutBox severity="info">{children}</CalloutBox>,
  Warning: ({ children }: any) => <CalloutBox severity="warning">{children}</CalloutBox>,
  Tip: ({ children }: any) => <CalloutBox severity="success">{children}</CalloutBox>,
}
```

---

### Task 36: DocsSidebar

**Files:**
- Create: `repos/website/src/components/Docs/DocsSidebar.tsx`

240px left sidebar with collapsible section groups, active page highlight (primary color + left border).

Sections:
- Getting Started: Introduction, Quick Start, Installation
- Concepts: Organizations, Projects, Agents, Threads, Providers, Endpoints, Secrets
- API Reference: Authentication, Organizations, Agents, Threads
- WebSocket: Connection, Client Events, Server Events
- Guides: Admin Dashboard, REPL CLI, Self-Hosting
- Changelog: Release Notes

Uses MUI List, ListItemButton, Collapse. Active item detected via `useLocation()`. Responsive: hidden behind hamburger on mobile/tablet (state managed via prop).

---

### Task 37: DocsTableOfContents

**Files:**
- Create: `repos/website/src/components/Docs/DocsTableOfContents.tsx`
- Create: `repos/website/src/hooks/useActiveHeading.ts`

**useActiveHeading.ts:**
IntersectionObserver-based hook that watches all h2/h3 elements in the docs content area and returns the ID of the currently visible heading.

**DocsTableOfContents.tsx:**
200px right sidebar, sticky position. Renders heading links extracted from the page. Uses `useActiveHeading` to highlight active. Hidden below 1280px breakpoint (`display: { xs: 'none', lg: 'block' }`).

---

### Task 38: DocsPrevNext

**Files:**
- Create: `repos/website/src/components/Docs/DocsPrevNext.tsx`

Bottom navigation showing previous and next doc page links. Reads from a flat ordered array of all doc routes. Uses `useLocation()` to find current position. Shows arrow + title for each direction.

---

### Task 39: ComingSoon

**Files:**
- Create: `repos/website/src/components/Docs/ComingSoon.tsx`

```tsx
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import ConstructionIcon from '@mui/icons-material/Construction'

const ComingSoon = () => (
  <Box sx={{ textAlign: 'center', py: 8 }}>
    <ConstructionIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
    <Typography variant="h5" sx={{ mb: 1 }}>Coming Soon</Typography>
    <Typography variant="body2" color="text.secondary">
      This documentation page is under construction. Check back soon or visit our GitHub for updates.
    </Typography>
  </Box>
)

export default ComingSoon
```

---

### Task 40: Dynamic Docs Page Renderer

**Files:**
- Modify: `repos/website/src/pages/docs/DocsPage.tsx`

Reads the URL path (e.g., `/docs/getting-started`) and dynamically imports the matching MDX file from `content/docs/`. Falls back to `ComingSoon` if the MDX file doesn't exist.

```tsx
import { useLocation } from 'react-router'
import { useState, useEffect, lazy, Suspense } from 'react'
import { MDXProvider } from '@mdx-js/react'
import { mdxComponents } from '@TAF/components/Docs/MDXComponents'
import ComingSoon from '@TAF/components/Docs/ComingSoon'
import DocsPrevNext from '@TAF/components/Docs/DocsPrevNext'

const contentModules = import.meta.glob('../../content/docs/**/*.mdx')

const DocsPage = () => {
  const { pathname } = useLocation()
  const slug = pathname.replace('/docs/', '') || 'getting-started'
  const [Content, setContent] = useState<React.ComponentType | null>(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    setContent(null)
    setNotFound(false)

    // Try direct match, then index file
    const paths = [
      `../../content/docs/${slug}.mdx`,
      `../../content/docs/${slug}/introduction.mdx`,
      `../../content/docs/${slug}/index.mdx`,
    ]

    const match = paths.find((p) => contentModules[p])
    if (match) {
      contentModules[match]().then((mod: any) => setContent(() => mod.default))
    } else {
      setNotFound(true)
    }
  }, [slug])

  if (notFound) return <ComingSoon />
  if (!Content) return null

  return (
    <MDXProvider components={mdxComponents}>
      <Content />
      <DocsPrevNext />
    </MDXProvider>
  )
}

export default DocsPage
```

---

### Task 41: Wire Docs Layout with Sidebar and TOC

**Files:**
- Modify: `repos/website/src/layouts/DocsLayout.tsx`

Final version integrating DocsSidebar, content area, and DocsTableOfContents:

```tsx
import { Outlet } from 'react-router'
import Box from '@mui/material/Box'
import Header from '@TAF/components/Header/Header'
import DocsFooter from '@TAF/components/Footer/DocsFooter'
import DocsSidebar from '@TAF/components/Docs/DocsSidebar'
import DocsTableOfContents from '@TAF/components/Docs/DocsTableOfContents'

const DocsLayout = () => (
  <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
    <Header />
    <Box sx={{ display: 'flex', flex: 1 }}>
      <DocsSidebar />
      <Box component="main" sx={{ flex: 1, maxWidth: 800, mx: 'auto', px: 3, py: 4 }}>
        <Outlet />
      </Box>
      <DocsTableOfContents />
    </Box>
    <DocsFooter />
  </Box>
)

export default DocsLayout
```

---

## Phase 7: Docs Content (Key Pages Only)

### Task 42: Getting Started — Introduction

**Files:**
- Create: `repos/website/src/content/docs/getting-started/introduction.mdx`

Content: What is ThreadedStack, platform overview, key capabilities (auth, AI agents, FaaS, secrets, threads), who it's for, quick links to other docs sections.

---

### Task 43: Getting Started — Quick Start

**Files:**
- Create: `repos/website/src/content/docs/getting-started/quick-start.mdx`

Content: 5-minute quickstart guide. Create org via admin dashboard, create an agent, get API key, make first API call (curl examples), create a thread, send a message.

---

### Task 44: Concepts — Key Pages

**Files:**
- Create: `repos/website/src/content/docs/concepts/organizations.mdx`
- Create: `repos/website/src/content/docs/concepts/agents.mdx`
- Create: `repos/website/src/content/docs/concepts/threads.mdx`

Each page: concept explanation, how it fits in the hierarchy, key properties, relationship to other entities, brief code/API examples.

---

### Task 45: API Reference — Authentication

**Files:**
- Create: `repos/website/src/content/docs/api-reference/authentication.mdx`

Content: Authentication methods (JWT via Neon Auth, API keys with `tdsk_*` prefix, session tokens for WebSocket), header format, example requests, error responses.

---

### Task 46: Remaining Doc Stubs

For all other pages listed in the sidebar navigation that don't have content yet, the `DocsPage` renderer will show `ComingSoon` automatically since there's no matching MDX file. No action needed — the fallback handles it.

---

## Phase 8: SEO & Polish

### Task 47: SEO Meta Tags

**Files:**
- Create: `repos/website/src/components/Shared/PageMeta.tsx`

```tsx
import { Helmet } from 'react-helmet-async'

type Props = {
  title?: string
  description?: string
}

const PageMeta = ({ title, description }: Props) => (
  <Helmet>
    <title>{title ? `${title} | ThreadedStack` : 'ThreadedStack — The Developer Platform for AI Agents'}</title>
    {description && <meta name="description" content={description} />}
    <meta property="og:title" content={title || 'ThreadedStack'} />
    {description && <meta property="og:description" content={description} />}
    <meta property="og:type" content="website" />
  </Helmet>
)

export default PageMeta
```

Add `<PageMeta>` to each page component with appropriate title/description.

---

### Task 48: robots.txt and sitemap.xml

**Files:**
- Create: `repos/website/public/robots.txt`
- Create: `repos/website/public/sitemap.xml`

**robots.txt:**
```
User-agent: *
Allow: /
Sitemap: https://threadedstack.app/sitemap.xml
```

**sitemap.xml:** List all public routes (/, /features, /pricing, /use-cases, /docs/getting-started, etc.).

---

### Task 49: Update index.html Meta

**Files:**
- Modify: `repos/website/index.html`

Add default meta tags: description, viewport, og:image, theme-color, charset. These serve as fallbacks before React hydrates.

---

### Task 50: Final Review & Verification

**Verify all routes render:**
- `/` — Full landing page with all 8 sections
- `/features` — Features deep-dive
- `/pricing` — Pricing with comparison table
- `/use-cases` — Use cases deep-dive
- `/docs` — Redirects to `/docs/getting-started`
- `/docs/getting-started` — MDX content renders
- `/docs/concepts` — Shows introduction or coming soon
- `/docs/api-reference` — Shows auth page or coming soon

**Verify theme:**
- Dark mode default
- Toggle to light mode
- Persists across refresh (localStorage)
- All sections look correct in both modes

**Verify responsive:**
- Desktop (1280+): full layout, TOC visible in docs
- Tablet (720-1279): TOC hidden, sidebar hamburger in docs
- Mobile (< 720): stacked layouts, mobile menu, simplified hero diagram

---

## Summary

| Phase | Tasks | Description |
|-------|-------|-------------|
| 1 | 1-7 | Foundation: deps, theme, router, App shell, placeholder pages |
| 2 | 8-14 | Shared components: SectionContainer, SectionHeader, cards, CodeBlock |
| 3 | 15-21 | Header (transparent/solid), Footer, ThemeToggle, MobileMenu |
| 4 | 22-30 | Landing page: Hero, Architecture, Features, HowItWorks, Code, Pricing, UseCases, Testimonials, CTA |
| 5 | 31-33 | Inner pages: Features, Pricing, UseCases deep-dives |
| 6 | 34-41 | Docs: MDX pipeline, sidebar, TOC, prev/next, dynamic renderer |
| 7 | 42-46 | Docs content: Getting Started, Concepts, API Reference (key pages) |
| 8 | 47-50 | SEO: meta tags, robots.txt, sitemap, final review |
