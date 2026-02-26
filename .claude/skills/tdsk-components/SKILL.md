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
- Built with modern tooling (tsup for bundling, vitest for testing)

## Directory Structure

```
repos/components/
├── src/
│   ├── components/          # React UI components
│   │   ├── Accordion/       # Accordion components (Accordion, AccordionAction, AccordionActions, AccordionInfoAction)
│   │   ├── Buttons/         # Button variants (Button, IconButton, LoadingButton, DialButton, ButtonGroup)
│   │   ├── Card/            # Card components (Card, CardActions)
│   │   ├── ClipboardCopy/   # Clipboard copy functionality
│   │   ├── Collapse/        # Collapsible sections
│   │   ├── Confirm/         # Confirmation dialogs (Confirm, ConfirmDelete)
│   │   ├── Definitions/     # Definition lists (Definitions, Definition, ComplexDefs, DefsFilters)
│   │   ├── Dialog/          # Dialog components (Dialog, DialogActions, DraggableDialog)
│   │   ├── Drawer/          # Side drawer panel (Drawer, DrawerActions)
│   │   ├── Dropdown/        # Dropdown menus (Dropdown, DDHeader)
│   │   ├── Empty/           # Empty state components
│   │   ├── Icons/           # Custom icon components (20+ icons)
│   │   ├── Image/           # Image components
│   │   ├── InfoTip/         # Info tooltips (not exported from components barrel)
│   │   ├── InlineDom/       # Inline DOM rendering
│   │   ├── Inputs/          # Form input components (17 exported components + style re-exports)
│   │   ├── List/            # List components (List, ListItem)
│   │   ├── Loading/         # Loading indicators (Loading, LoadingDots)
│   │   ├── MemoChildren/    # Memoized children wrapper
│   │   ├── Menu/            # Menu components (Menu, MenuItems, MultilevelMenu, IconMenuItem, MenuBack, MenuHeader, MenuContext)
│   │   ├── Monaco/          # Monaco code editor wrapper (Monaco, MonacoActions, LangSelect)
│   │   ├── NotificationCount/ # Notification badges (not exported from components barrel)
│   │   ├── Portal/          # React portal wrapper
│   │   ├── RenderType/      # Conditional rendering (RenderType, RenderIcon)
│   │   ├── Resize/          # Resizable panels
│   │   ├── Section/         # Section containers (Section, SectionActions)
│   │   ├── Tabs/            # Tab components
│   │   ├── Text/            # Text components (Text, TextElements, TextPair)
│   │   └── Tooltip/         # Tooltip components
│   ├── hooks/               # Custom React hooks
│   │   ├── api/             # API-related hooks (useFetch, useLoadDynamic)
│   │   ├── components/      # Component-specific hooks (9 exported, 2 non-exported)
│   │   ├── data/            # Data management hooks (useRecall, useTimeout, useInterval, useArrToggle)
│   │   ├── definitions/     # Definition-related hooks (useDefsFilters) — not exported from hooks barrel
│   │   ├── dom/             # DOM interaction hooks (9 hooks)
│   │   ├── monaco/          # Monaco editor hooks (useMonaco exported, useMonacoActions not exported)
│   │   └── theme/           # Theme-related hooks (5 hooks)
│   ├── contexts/            # React contexts
│   │   └── CacheContext.tsx  # Cache context provider
│   ├── hocs/                # Higher-order components
│   │   ├── TooltipHoc.tsx    # Tooltip HOC
│   │   └── OverlayScroll.tsx # Overlay scrollbar HOC
│   ├── services/            # Service modules
│   │   ├── storage.ts        # Storage service
│   │   ├── clipboard.ts      # Clipboard service
│   │   ├── cacheService.tsx   # Cache service
│   │   ├── eventEmitter.ts   # Event emitter
│   │   └── overlayScrollBody.tsx # Overlay scroll utilities
│   ├── theme/               # Theming system
│   │   ├── colors.ts        # Color palette
│   │   ├── theme.tsx        # Theme factory (dark/light)
│   │   ├── helpers.ts       # Theme helpers
│   │   ├── dims.ts          # Dimension constants
│   │   └── gutter.ts        # Spacing/gutter system
│   ├── types/               # TypeScript type definitions
│   │   ├── accordion.types.ts
│   │   ├── cache.types.ts
│   │   ├── cron.types.ts
│   │   ├── helpers.types.ts
│   │   ├── input.types.ts
│   │   ├── list.types.ts
│   │   ├── monaco.types.ts
│   │   ├── notification.types.tsx
│   │   ├── tabs.types.ts
│   │   └── theme.types.ts
│   ├── utils/               # Utility functions
│   │   ├── omit.ts          # Object property omission
│   │   ├── date.ts          # Date utilities
│   │   ├── inputs.tsx       # Input utilities
│   │   ├── helpers.ts       # General helpers
│   │   ├── customEvt.tsx    # Custom event utilities
│   │   ├── isValidFuncComp.tsx # Component validation
│   │   ├── overlayScrollOpts.tsx # Scroll options
│   │   ├── cron.ts          # Cron utilities (not exported from utils barrel)
│   │   ├── fetcher.ts       # Fetch utility (not exported from utils barrel)
│   │   └── input.tsx        # Input utility (not exported from utils barrel)
│   ├── constants/           # Constants
│   │   ├── values.ts        # Value constants
│   │   ├── monaco.ts        # Monaco editor constants
│   │   ├── events.ts        # Event constants
│   │   └── elements.ts      # Element constants
│   └── index.ts             # Main export barrel
├── configs/                 # Configuration files
│   ├── aliases.ts           # Module aliases (uses alias-hq)
│   ├── biome.json           # Biome linter/formatter config
│   └── vitest.config.ts     # Vitest testing config
├── scripts/                 # Build/test scripts
│   ├── getEntries.ts        # Entry point generation
│   ├── setupTests.ts        # Test setup
│   ├── loadEnvs.ts          # Environment loading
│   └── addToProcess.ts      # Process utilities
├── package.json
└── tsconfig.json            # TypeScript configuration
```

**Note on barrel exports:** Several components, hooks, and utils have source files that are NOT re-exported from their parent `index.ts` barrels. These are noted inline above. The `InfoTip/` and `NotificationCount/` components exist but are not exported from `src/components/index.ts`. The `definitions/` hooks category exists but is not exported from `src/hooks/index.ts`.

## Key Files

### Core Entry Points
- **`src/index.ts`** - Main export barrel that re-exports all components, hooks, utils, types, constants, contexts, hocs, services, and theme
- **`package.json`** - Package configuration with build scripts and dependencies
- **`tsconfig.json`** - TypeScript configuration with path aliases

### Configuration
- **`configs/biome.json`** - Biome linter and formatter configuration
- **`configs/vitest.config.ts`** - Vitest test runner configuration
- **`configs/aliases.ts`** - Module alias configuration using alias-hq

### Build
- **Build tool**: tsup (referenced in build script as `tsup --config ./configs/tsup.config.ts`)
- **Build output**: `dist/` directory (not in repo)
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
- **CreationIcon** - Create/add icon
- **ExpandIcon** - Expand/collapse icon
- **ExportIcon** - Export icon
- **GitlabIcon** - GitLab logo
- **GridPlusIcon** - Grid plus icon
- **ImportIcon** - Import icon
- **ItemListIcon** - Item list icon
- **JsonCodeIcon** - JSON code icon
- **MCPIcon** - MCP logo
- **NamedIcon** - Generic icon by name (uses MUI icon library, also exported separately)
- **PencilCircleIcon** - Pencil circle icon
- **PlayCircleIcon** - Play circle icon
- **RobotIcon** - Robot/AI icon
- **RobotOutlineIcon** - Robot outline icon
- **StarCircleIcon** - Star circle icon
- **StarPointsIcon** - Star points icon
- **StarPointsCircleIcon** - Star points circle icon
- **StopCircleIcon** - Stop circle icon
- **TSIcon** - TypeScript logo
- **VercelIcon** - Vercel logo

### Layout Components
- **Accordion** - Collapsible accordion panels (includes AccordionAction, AccordionActions, AccordionInfoAction)
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
- **useMonacoActions** - Monaco actions management (file exists, not exported from barrel)

### Definition Hooks (`src/hooks/definitions/`)
- **useDefsFilters** - Definition filtering

**Note:** The `definitions/` hook category is NOT exported from the main `src/hooks/index.ts` barrel. These hooks must be imported directly from their file path.

## Architecture

### Component Structure Pattern
```typescript
// Component file structure
ComponentName/
├── ComponentName.tsx         # Main component
├── ComponentName.styles.tsx  # Styled components (@emotion/styled)
└── index.ts                  # Export barrel
```

### Export Pattern
All modules use barrel exports (`index.ts`) for clean imports:
```typescript
// src/components/index.ts
export * from './Tabs'
export * from './List'
export * from './Menu'
// ... etc
```

### Styling Approach
- **MUI Theme System** - Custom theme with dark/light mode
- **Emotion** - Styled components using `@emotion/styled` and `@emotion/react`
- **Theme Factory** - `makeTheme(variant, breakpoints)` creates theme instances
- **Component Overrides** - MUI component default props and styles are customized in theme

### Type Safety
- TypeScript-first with strict typing disabled for compatibility
- Custom type definitions in `src/types/`
- Type exports alongside component exports

## Key Patterns

### 1. Component Composition
Components are designed for composition with flexible prop types:
```typescript
<Monaco
  title="Code Editor"
  language="typescript"
  value={code}
  onChange={handleChange}
  showActions
  placeholder="Enter code..."
/>
```

### 2. Theme Integration
All components integrate with MUI theme system:
```typescript
import { makeTheme } from '@tdsk/components'
const darkTheme = makeTheme('dark')
const lightTheme = makeTheme('light')
```

### 3. Prop Patterns
- **Render Props** - Components accept render functions for customization
- **Compound Components** - Related components (Dialog + DialogActions, Drawer + DrawerActions)
- **Controlled/Uncontrolled** - Inputs support both patterns
- **Forward Refs** - Components forward refs to underlying elements

### 4. MUI Integration
- Extends MUI components with custom styling
- Uses MUI's `sx` prop for inline styling
- Custom theme palette extensions

### 5. Service Layer
Services provide singleton utilities:
```typescript
import { GlobalCache } from '@tdsk/components'
GlobalCache.set('key', value)
const cached = GlobalCache.get('key')
```

### 6. HOC Pattern
Higher-order components for cross-cutting concerns:
```typescript
import { TooltipHoc, OverlayScroll } from '@tdsk/components'
const Enhanced = TooltipHoc(MyComponent)
```

## Dependencies

### Core UI Dependencies
- **@mui/material** (6.1.2) - Material-UI component library
- **@mui/icons-material** (6.1.2) - Material-UI icons
- **@mui/lab** (6.0.0-beta.10) - Experimental MUI components
- **@emotion/react** (11.13.3) - CSS-in-JS styling
- **@emotion/styled** (11.13.0) - Styled components
- **react** (^18.3.1) - React framework
- **react-dom** (^18.3.1) - React DOM

### Specialized Components
- **@monaco-editor/react** (4.6.0) - Monaco code editor React wrapper
- **mui-chips-input** (4.0.1) - Chips input component
- **mui-image-alter** (3.2.0) - Image component with alterations
- **overlayscrollbars** (2.11.0) - Custom scrollbars
- **overlayscrollbars-react** (0.5.6) - React wrapper for overlay scrollbars
- **react-from-dom** (0.7.5) - Convert DOM to React components
- **react-resizable-panels** (3.0.1) - Resizable panel layout

### Utilities
- **@keg-hub/jsutils** (^10.0.0) - JavaScript utilities (cls, etc.)

### Dev Dependencies
- **alias-hq** (6.2.4) - Module alias management
- **typescript** (5.7.3) - TypeScript compiler
- **vitest** (1.6.1) - Test runner
- **@testing-library/react** (^14.2.1) - React testing utilities
- **@testing-library/jest-dom** (^6.4.2) - Jest DOM matchers
- **jsdom** (^24.0.0) - DOM testing environment
- **glob** (10.3.10) - File globbing
- **vite-tsconfig-paths** (4.3.2) - Vite TypeScript path support

## Commands

### Build & Development
```bash
pnpm build              # Build with tsup
pnpm build:watch        # Build in watch mode
pnpm clean              # Remove dist/
```

### Testing
```bash
pnpm test               # Run vitest tests
pnpm types              # Type-check with tsc --noEmit
```

### Commands Notes

* Linting and formatting are automatic, so `pnpm lint` and `pnpm format` commands should be ignored.


## Integration Points

### Consumed By
- **Admin repo** (`repos/admin/`) - Primary consumer for dashboard UI

### Import Pattern
```typescript
// In consuming applications (e.g., repos/admin/)
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

### Path Aliases (in consumers)
The admin repo uses `@TAF/*` aliases via alias-hq, which resolve `@tdsk/components` imports automatically through the monorepo workspace.

### Theme Integration
```typescript
// In consuming app (e.g., admin)
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

## TypeScript Configuration

### Path Aliases
```json
{
  "@TSC": ["./src"],
  "@TSC/*": ["./src/*"],
  "@ROOT": ["../../"],
  "@ROOT/*": ["../../*"],
  "@keg-hub/jsutils": ["./node_modules/@keg-hub/jsutils/build/esm"],
  "@keg-hub/jsutils/*": ["./node_modules/@keg-hub/jsutils/build/esm/*"],
  "@keg-hub/jsutils/src/node": ["./node_modules/@keg-hub/jsutils/build/esm/node"],
  "@keg-hub/jsutils/src/node/*": ["./node_modules/@keg-hub/jsutils/build/esm/node"]
}
```

### Module Resolution
- **Module resolution**: `bundler` (modern resolution strategy)
- **JSX**: `react-jsx` (automatic runtime)
- **Strict**: `false` (for compatibility)
- **Target**: ESNext with DOM libraries
- **Extends**: Root `tsconfig.json` at `../../tsconfig.json`

## Testing

### Test Setup
- **Runner**: Vitest
- **Environment**: jsdom (for DOM testing)
- **Utilities**: @testing-library/react, @testing-library/jest-dom
- **Config**: `configs/vitest.config.ts`

### Test Pattern
```typescript
import { render, screen } from '@testing-library/react'
import { Button } from './Button'

test('renders button with text', () => {
  render(<Button>Click me</Button>)
  expect(screen.getByText('Click me')).toBeInTheDocument()
})
```

## Best Practices

### 1. Component Development
- Keep components under 300 lines
- Use barrel exports for clean imports
- Provide TypeScript types for all props
- Support both controlled and uncontrolled patterns for inputs

### 2. Styling
- Use emotion/styled for component-specific styles
- Leverage MUI theme system for consistency
- Use `sx` prop for one-off styling
- Avoid inline styles except for dynamic values

### 3. Hooks
- Keep hooks focused on single responsibility
- Document hook dependencies and effects
- Provide TypeScript types for return values
- Use memoization for expensive computations

### 4. Performance
- Use React.memo for expensive components
- Memoize callbacks with useCallback
- Avoid unnecessary re-renders
- Leverage the MemoChildren component wrapper

### 5. Accessibility
- Use semantic HTML elements
- Provide ARIA labels where needed
- Ensure keyboard navigation works
- Test with screen readers

## Common Workflows

### Adding a New Component
1. Create component directory: `src/components/NewComponent/`
2. Create main component: `NewComponent.tsx`
3. Create styles: `NewComponent.styles.tsx` (if needed)
4. Create types: Update `src/types/` if needed
5. Create index: `index.ts` with exports
6. Export from `src/components/index.ts`
7. Test the component
8. Build and verify types

### Adding a New Hook
1. Determine category (dom/api/components/data/theme)
2. Create hook file: `src/hooks/{category}/useHookName.ts`
3. Export from category index: `src/hooks/{category}/index.ts`
4. Test the hook
5. Document usage and parameters

### Updating Theme
1. Modify colors in `src/theme/colors.ts`
2. Update theme factory in `src/theme/theme.tsx`
3. Update component overrides if needed
4. Test in both light and dark modes
5. Verify MUI component integration

### Working with Monaco
1. Import Monaco component
2. Configure language and options
3. Handle value changes
4. Customize actions toolbar
5. Integrate with form state

## Development Tips

### IDE Setup
- Use TypeScript language server
- Configure path aliases in IDE
- Enable auto-import for `@tdsk/components`
- Use Biome extension for linting/formatting

### Debugging
- Use React DevTools for component inspection
- Use browser DevTools for style debugging
- Check MUI theme in DevTools
- Verify cache state with CacheContext

### Performance Monitoring
- Use React Profiler to identify slow components
- Monitor re-renders with React DevTools
- Check bundle size with build output
- Profile Monaco editor performance
