---
name: "tdsk-components"
description: "Knowledge base for the shared React components library (@tdsk/components)"
tags: ["react", "mui", "components", "hooks", "frontend", "shared-library"]
---
# Components Repo Skill

## Overview

The **@tdsk/components** repository is a shared React component library that provides reusable UI components, custom hooks, utilities, and theming for the Threaded Stack platform. It serves as the foundational UI layer consumed by the Admin SPA and other frontend applications.

**Key Features:**
- Material-UI (MUI) based component library
- Custom hooks for common functionality
- Monaco Editor integration for code editing
- Theming system with dark/light mode support
- TypeScript-first with comprehensive type definitions
- Built with tsup for bundling, vitest for testing

## Directory Structure

```
repos/components/
├── src/
│   ├── components/          # React UI components
│   │   ├── Accordion/       # Accordion, AccordionAction, AccordionActions, AccordionInfoAction
│   │   ├── Buttons/         # Button, IconButton, LoadingButton, DialButton, ButtonGroup
│   │   ├── Card/            # Card, CardActions
│   │   ├── ClipboardCopy/   # Clipboard copy functionality
│   │   ├── Collapse/        # Collapsible sections
│   │   ├── Confirm/         # Confirm, ConfirmDelete
│   │   ├── Definitions/     # Definitions, Definition, ComplexDefs, DefsFilters
│   │   ├── Dialog/          # Dialog, DialogActions, DraggableDialog
│   │   ├── Drawer/          # Drawer, DrawerActions
│   │   ├── Dropdown/        # Dropdown, DDHeader
│   │   ├── Empty/           # Empty state components
│   │   ├── Icons/           # 20+ custom SVG icons
│   │   ├── Image/           # Image components (mui-image-alter)
│   │   ├── InfoTip/         # Info tooltips (NOT exported from barrel)
│   │   ├── InlineDom/       # Inline DOM rendering (react-from-dom)
│   │   ├── Inputs/          # 17 exported input components + style re-exports
│   │   ├── List/            # List, ListItem
│   │   ├── Loading/         # Loading, LoadingDots
│   │   ├── MemoChildren/    # Memoized children wrapper
│   │   ├── Menu/            # Menu, MenuItems, MultilevelMenu, IconMenuItem, MenuBack, MenuHeader, MenuContext
│   │   ├── Monaco/          # Monaco, MonacoActions, LangSelect
│   │   ├── NotificationCount/ # Notification badges (NOT exported from barrel)
│   │   ├── Portal/          # React portal wrapper
│   │   ├── RenderType/      # RenderType, RenderIcon
│   │   ├── Resize/          # Resizable panels (react-resizable-panels)
│   │   ├── Section/         # Section, SectionActions
│   │   ├── Tabs/            # Tab components
│   │   ├── Text/            # Text, TextElements, TextPair
│   │   └── Tooltip/         # Tooltip components
│   ├── hooks/               # Custom React hooks
│   │   ├── api/             # useFetch, useLoadDynamic
│   │   ├── components/      # 9 exported, 2 non-exported
│   │   ├── data/            # useRecall, useTimeout, useInterval, useArrToggle
│   │   ├── definitions/     # useDefsFilters (NOT exported from hooks barrel)
│   │   ├── dom/             # 9 hooks
│   │   ├── monaco/          # useMonaco (exported), useMonacoActions (not exported)
│   │   └── theme/           # 5 hooks
│   ├── contexts/            # CacheContext provider
│   ├── hocs/                # TooltipHoc, OverlayScroll
│   ├── services/            # storage, clipboard, cacheService, eventEmitter, overlayScrollBody
│   ├── theme/               # colors, theme factory, helpers, dims, gutter
│   ├── types/               # TypeScript type definitions
│   ├── utils/               # omit, date, inputs, helpers, customEvt, isValidFuncComp, overlayScrollOpts
│   ├── constants/           # values, monaco, events, elements
│   └── index.ts             # Main export barrel
├── configs/                 # biome.json, vitest.config.ts, aliases.ts
├── scripts/                 # getEntries, setupTests, loadEnvs, addToProcess
├── package.json
└── tsconfig.json
```

**Note on barrel exports:** Several components, hooks, and utils are NOT re-exported from their parent `index.ts` barrels. `InfoTip/` and `NotificationCount/` components are not exported from `src/components/index.ts`. The `definitions/` hooks category is not exported from `src/hooks/index.ts`. These must be imported directly from their file paths.

## Build

- **Build tool**: tsup (`tsup --config ./configs/tsup.config.ts`)
- **Build output**: `dist/` directory
- **Main entry**: `dist/index.js`
- **ESM entry**: `dist/esm/index.js`
- **Types**: `dist/index.d.ts`

## Component Library

### Input Components (`src/components/Inputs/`)
Exported from the Inputs barrel:
- **FormInput** - Generic form input (with star export)
- **SelectInput** - Standard dropdown selector (with star export)
- **SelectListItem** - Select dropdown item (with star export)
- **TagsInput** - Multi-tag input (uses mui-chips-input)
- **CronInput** - Cron expression editor
- **TextInput** - Standard text input
- **InputLabel** - Input label component
- **AdminInput** - Admin-specific input field
- **SliderInput** - Range slider
- **SwitchInput** - Toggle switch
- **InlineSelect** - Inline dropdown selector
- **CheckboxInput** - Checkbox with label
- **InputContainer** - Input wrapper
- **CheckContainer** - Checkbox container wrapper
- **InputStateHandler** - Input state management
- **SelectCategoryInput** - Category selector
- **Textarea, OutlinedInput, AutoInputText** - Style re-exports from `Inputs.styles`

Additional files not exported from barrel: `AutoInput.tsx`, `SelectInputValue.tsx`

### Button Components (`src/components/Buttons/`)
- **Button** - Standard button
- **DialButton** - Speed dial button
- **IconButton** - Icon-only button
- **ButtonGroup** - Button group container
- **LoadingButton** - Button with loading state

### Dialog Components (`src/components/Dialog/`)
- **Dialog** - Standard modal dialog
- **DialogActions** - Dialog action buttons
- **DraggableDialog** - Draggable modal dialog

### Drawer Components (`src/components/Drawer/`)
- **Drawer** - Right-anchored side drawer with header, title, close button, content area, and actions slot
- **DrawerActions** - Pre-built action bar with save/create/cancel/delete buttons, loading state support

### Monaco Editor (`src/components/Monaco/`)
- **Monaco** - Code editor component with language selection, actions, and theming
- **MonacoActions** - Editor toolbar/actions
- **LangSelect** - Language selection dropdown
- Supports TypeScript, JavaScript, JSON, Python, and more via `@monaco-editor/react`

### Icons (`src/components/Icons/`)
Custom SVG icons (20 exported from barrel):
- **Icon** - Base icon component
- **CreationIcon**, **ExpandIcon**, **ExportIcon**, **GitlabIcon**, **GridPlusIcon**, **ImportIcon**
- **ItemListIcon**, **JsonCodeIcon**, **MCPIcon**, **NamedIcon** (generic icon by name, uses MUI icon library)
- **PencilCircleIcon**, **PlayCircleIcon**, **RobotIcon**, **RobotOutlineIcon**
- **StarCircleIcon**, **StarPointsIcon**, **StarPointsCircleIcon**, **StopCircleIcon**
- **TSIcon**, **VercelIcon**

### Layout Components
- **Accordion** - Collapsible panels (includes AccordionAction, AccordionActions, AccordionInfoAction)
- **Card** - Card container (CardActions exists but is not exported from Card barrel)
- **Section** - Section container with SectionActions
- **Tabs** - Tab navigation
- **List** - List rendering with ListItem
- **Menu** - Context/dropdown menus (Menu, MenuItems, MultilevelMenu exported from barrel)
- **Collapse** - Collapsible content
- **Resize** - Resizable panels

### Utility Components
- **ClipboardCopy** - Copy to clipboard button
- **Confirm** - Confirmation dialog (includes ConfirmDelete)
- **Definitions** - Definition list (includes Definition, ComplexDefs, DefsFilters)
- **Dropdown** - Dropdown with DDHeader
- **Empty** - Empty state display
- **Image** - Image component (uses mui-image-alter)
- **InlineDom** - Inline DOM rendering (uses react-from-dom)
- **Loading** - Loading spinner/indicator (includes LoadingDots)
- **MemoChildren** - Memoized children wrapper
- **Portal** - React portal wrapper
- **RenderType** - Conditional rendering helper (includes RenderIcon)
- **Text** - Text display component (includes TextElements, TextPair)
- **Tooltip** - Tooltip overlay

## Custom Hooks

### DOM Interaction Hooks (`src/hooks/dom/`)
- **useInput** - Input field state management
- **useKeyDown** - Keyboard event handling
- **useIsMobile** - Mobile device detection
- **useSyncValue** - Value synchronization
- **useDisplayDate** - Date formatting for display
- **useDownloadText** - Text file download
- **useWindowResize** - Window resize handling
- **useFormattedTime** - Time formatting
- **useCopyToClipboard** - Clipboard copy functionality

### Component-Specific Hooks (`src/hooks/components/`)
Exported (9):
- **useProp** - Prop management
- **useCron** - Cron expression handling
- **useInline** - Inline rendering
- **useResize** - Resize handling
- **useToggle** - Toggle state
- **useEnsureRef** - Ref validation
- **useEffectOnce** - Run effect once
- **useForceRender** - Force re-render
- **useLayoutMaxWidth** - Layout width calculation

Not exported from barrel (files exist but not in `index.ts`):
- **useForceUpdate** - Force update utility
- **useMergedRef** - Merged ref utility

### Data Management Hooks (`src/hooks/data/`)
- **useRecall** - Memoization with recall
- **useTimeout** - Timeout management
- **useInterval** - Interval management
- **useArrToggle** - Array toggle utility

### API Hooks (`src/hooks/api/`)
- **useFetch** - Data fetching with SWR-like behavior
- **useLoadDynamic** - Dynamic module loading

### Theme Hooks (`src/hooks/theme/`)
- **useTheme** - Access MUI theme
- **useColor** - Access single color from theme
- **useColors** - Access color palette from theme
- **useIsDarkMode** - Check if dark mode is active
- **useJoinSx** - Merge multiple `sx` props

### Monaco Editor Hooks (`src/hooks/monaco/`)
- **useMonaco** - Monaco editor configuration and state management (exported)
- **useMonacoActions** - Monaco actions management (not exported from barrel)

### Definition Hooks (`src/hooks/definitions/`)
- **useDefsFilters** - Definition filtering (NOT exported from main hooks barrel; import directly)

## Architecture

### Component Structure Pattern
```typescript
ComponentName/
├── ComponentName.tsx         # Main component
├── ComponentName.styles.tsx  # Styled components (@emotion/styled)
└── index.ts                  # Export barrel
```

### Styling Approach
- **MUI Theme System** - Custom theme with dark/light mode
- **Emotion** - Styled components using `@emotion/styled` and `@emotion/react`
- **Theme Factory** - `makeTheme(variant, breakpoints)` creates theme instances
- **Component Overrides** - MUI component default props and styles are customized in theme

## Key Patterns

### Theme Integration
```typescript
import { makeTheme } from '@tdsk/components'
const darkTheme = makeTheme('dark')
const lightTheme = makeTheme('light')
```

### Prop Patterns
- **Render Props** - Components accept render functions for customization
- **Compound Components** - Related components (Dialog + DialogActions, Drawer + DrawerActions)
- **Controlled/Uncontrolled** - Inputs support both patterns
- **Forward Refs** - Components forward refs to underlying elements

### Service Layer
```typescript
import { GlobalCache } from '@tdsk/components'
GlobalCache.set('key', value)
const cached = GlobalCache.get('key')
```

### HOC Pattern
```typescript
import { TooltipHoc, OverlayScroll } from '@tdsk/components'
const Enhanced = TooltipHoc(MyComponent)
```

## Integration Points

### Consumed By
- **Admin repo** (`repos/admin/`) - Primary consumer for dashboard UI

### Import Pattern
```typescript
import {
  Button,
  Dialog,
  Drawer,
  Monaco,
  TextInput,
  useFetch,
  makeTheme
} from '@tdsk/components'
```

### Theme Integration in Consumers
```typescript
import { makeTheme } from '@tdsk/components'
import { ThemeProvider } from '@mui/material/styles'

const theme = makeTheme('dark')

<ThemeProvider theme={theme}>
  <App />
</ThemeProvider>
```

### CacheContext Usage
```typescript
import { CacheProvider, useCache } from '@tdsk/components'

// Wrap app
<CacheProvider global={true}>
  <App />
</CacheProvider>

// In components
const cache = useCache()
cache.set('key', value)
```

## Monaco Editor Integration

The Monaco component provides a full-featured code editor:

```typescript
<Monaco
  language="typescript"        // Programming language
  value={code}                 // Controlled value
  onChange={handleChange}      // Change handler
  theme="vs-dark"             // Editor theme
  showActions                 // Show toolbar
  hideLanguage={false}        // Show language selector
  placeholder="Enter code..." // Placeholder text
  noLineNum                   // Hide line numbers
  options={{                  // Monaco editor options
    minimap: { enabled: false },
    fontSize: 14,
    wordWrap: 'on'
  }}
/>
```

**Features:**
- Language selection dropdown
- Custom actions toolbar
- Placeholder text support
- Theme integration with app theme
- Loading state with custom loader
- Configurable editor options

## Theming System

### Color Palette
Comprehensive color system in `src/theme/colors.ts`:
- **Primary colors** - Brand colors with variants (50-900)
- **Grey scale** - Grey variants (0-900)
- **State colors** - Success, error, warning
- **Light/Dark modes** - Complete color sets for each mode

### Theme Structure
```typescript
const theme = makeTheme('dark')

// Access colors
theme.palette.primary.main
theme.palette.background.default
theme.palette.text.primary

// Access custom palette extensions
theme.palette.colors.dark.primary
theme.palette.border.default
theme.palette.editor.background
```

### Gutter System
Spacing system in `src/theme/gutter.ts`:
```typescript
import { gutter } from '@tdsk/components'

gutter.px      // Standard padding (e.g., '16px')
gutter.dpx     // Double padding
gutter.hpx     // Half padding
gutter.qpx     // Quarter padding
gutter.tpx     // Third padding
```

## Testing

- **Runner**: Vitest with jsdom environment
- **Utilities**: @testing-library/react, @testing-library/jest-dom
- **Config**: `configs/vitest.config.ts`

```typescript
import { render, screen } from '@testing-library/react'
import { Button } from './Button'

test('renders button with text', () => {
  render(<Button>Click me</Button>)
  expect(screen.getByText('Click me')).toBeInTheDocument()
})
```
