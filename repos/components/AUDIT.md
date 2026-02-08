# Components Repo Audit (`@tdsk/components`)

**Date**: 2026-02-08
**Auditor**: Claude Opus 4.6
**Scope**: Full source code audit of `repos/components/`
**Files Reviewed**: ~170+ TypeScript/TSX source files (all source files)

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 5 |
| Security | 2 |
| High | 14 |
| Medium | 19 |
| Low | 16 |
| **Total** | **56** |

**Test Coverage**: ~0% (1 test file with placeholder assertion `expect(true).toBe(true)`)

---

## Critical Issues

### C-01: `ListItem.tsx:133-151` -- `ItemExpand` references `window.open` instead of component prop

**File**: `src/components/List/ListItem.tsx`

The `ItemExpand` component destructures props but omits `open`:

```typescript
const ItemExpand = (props: TListItemExpand) => {
  const { id, onOpen, selected, expandSx, expandClass } = props
  // BUG: `open` is NOT destructured from props
  return (
    <ItemExpContainer ...>
      {open ? <ExpandLess /> : <ExpandMore />}  // `open` resolves to window.open
    </ItemExpContainer>
  )
}
```

On lines 144 and 148, `open` resolves to `window.open` (a global function, always truthy). This means:
- The expand icon always shows `<ExpandLess />` regardless of actual open state
- The CSS class `tdsk-list-item-expand-opened` is always applied

**Impact**: List item expand/collapse visual indicator is permanently broken.

---

### C-02: `components/index.ts:9,12` -- Duplicate `Inputs` barrel export, missing components

**File**: `src/components/index.ts`

```typescript
export * from './Inputs'   // line 9
export * from './Dialog'   // line 10
export * from './Drawer'   // line 11
export * from './Inputs'   // line 12 -- DUPLICATE
```

While TypeScript silently deduplicates these, it masks that `InfoTip` and `NotificationCount` directories exist but are NOT exported from the barrel.

**Impact**: `InfoTip` and `NotificationCount` components are unreachable through the package's public API.

---

### C-03: `hooks/index.ts` -- Missing `monaco` and `definitions` barrel exports

**File**: `src/hooks/index.ts`

```typescript
export * from './dom'
export * from './api'
export * from './data'
export * from './theme'
export * from './components'
// MISSING: export * from './definitions'
// MISSING: export * from './monaco'
```

The `hooks/monaco/` directory exports `useMonaco` (and `useMonacoActions` exists as a file but is also missing from `hooks/monaco/index.ts`). The `hooks/definitions/` directory exports `useDefsFilters`. All of these hooks are unreachable through the package's public API because the parent `hooks/index.ts` barrel does not re-export these subdirectories.

**Impact**: Consumers must use direct file path imports to access these hooks, breaking the barrel export convention.

---

### C-04: `cron.ts:61-62` -- `cronToString` hourly case puts interval in wrong cron field

**File**: `src/utils/cron.ts`

```typescript
case ERepeatType.hourly:
  cron = `0 */${interval} * * * *`   // interval in MINUTES field (index 1)
  break
```

The second field (index 1) in a 6-field cron expression is minutes. The hourly interval should be in the hours field (index 2): `0 0 */${interval} * * *`.

**Impact**: Setting "every 2 hours" actually creates "every 2 minutes".

---

### C-05: `utils/index.ts` -- Missing `cron` and `fetcher` exports

**File**: `src/utils/index.ts`

```typescript
export * from './omit'
export * from './date'
export * from './inputs'
export * from './helpers'
export * from './customEvt'
export * from './isValidFuncComp'
export * from './overlayScrollOpts'
// MISSING: export * from './cron'
// MISSING: export * from './fetcher'
```

The `parseCron`, `cronToString`, and `fetcher` utilities exist but are not exported through the utils barrel.

**Impact**: These utilities are unreachable via the package barrel export chain.

---

## Security Issues

### S-01: `InlineDom.tsx:21` -- Arbitrary HTML-to-React conversion via `react-from-dom`

**File**: `src/components/InlineDom/InlineDom.tsx`

```typescript
const output = convert(html)  // html prop is arbitrary string
setConverted(output)
```

The `html` prop is converted to React elements using `react-from-dom`. If the `html` string contains untrusted content (e.g., user-submitted data), this could allow XSS attacks. `react-from-dom` parses HTML and creates React elements, potentially including `<script>` tags, event handlers (`onclick`, `onerror`), and other dangerous content. There is no DOMPurify or other sanitization step.

Additionally, `if (converted) return` on line 20 prevents re-conversion when the `html` prop changes after initial render, which is both a bug and a partial accidental mitigation.

**Impact**: Potential XSS if any caller passes user-controlled HTML strings.

---

### S-02: `Definition.tsx:72` -- Uses `InlineDom` to render icon HTML strings

**File**: `src/components/Definitions/Definition.tsx`

```typescript
<InlineDom html={icon} />
```

The `Definition` component passes an `icon` HTML string through `InlineDom`, inheriting the same XSS risk as S-01. If definition data comes from an API or user input, this is exploitable.

**Impact**: Secondary XSS vector via `InlineDom`.

---

## High Issues

### H-01: `Portal.tsx:21-31` -- `useEffect` with no dependency array runs every render

**File**: `src/components/Portal/Portal.tsx`

```typescript
useEffect(() => {
  const element = elementRef?.current || (id && document.getElementById(id))
  if (!element) return console.log(`Can not find Portal Dom element`)
  if (current && element === current) return
  portalRef.current = element
  forceUpdate()  // triggers re-render -> useEffect runs again
})  // NO dependency array
```

This effect runs on every render. When it calls `forceUpdate()`, that triggers another render, which runs the effect again. The early return `if (current && element === current) return` prevents an infinite loop only if the element is found and unchanged. If the element flickers or the DOM element is not yet mounted, this creates a render loop.

**Impact**: Performance degradation; potential infinite re-render loop.

---

### H-02: `DraggableDialog.tsx:104-120` -- ResizeObserver useEffect has no dependency array

**File**: `src/components/Dialog/DraggableDialog.tsx`

```typescript
useEffect(() => {
  if (!paperRef?.current) return
  const resizeObs = new ResizeObserver((entries) => { ... })
  resizeObs.observe(paperRef?.current)
  return () => { resizeObs.disconnect() }
})  // NO dependency array
```

Creates and disconnects a new `ResizeObserver` on every render. Each render cycle allocates a new observer, observes the element, then disconnects on the next render's cleanup. The `position` captured in the closure goes stale.

**Impact**: Performance waste; observer flickers and may miss resize events between cleanup and re-registration.

---

### H-03: `eventEmitter.ts:63` -- `off()` crashes when event has no listeners

**File**: `src/services/eventEmitter.ts`

```typescript
off = (event, ref, warn) => {
  const cb = typeof ref === `string` ? this.refKey[ref] : ref
  if (!cb) return warn ? console.warn(...) : undefined
  this.listeners[event].delete(cb)  // CRASH if this.listeners[event] is undefined
}
```

If `off()` is called for an event that was never registered (or after `reset()`), `this.listeners[event]` is `undefined`, and `.delete()` throws `TypeError: Cannot read properties of undefined`.

**Impact**: Unsubscribing from unregistered events crashes the application.

---

### H-04: `storage.ts:51-52` -- `find()` crashes on `null` from `localStorage.key()`

**File**: `src/services/storage.ts`

```typescript
for (let i = 0; i < localStorage.length; i++) {
  const name = localStorage.key(i)
  if (name.endsWith(key)) return this.get(name)  // name can be null
}
```

`localStorage.key(i)` can return `null`. Calling `.endsWith()` on `null` throws `TypeError`.

**Impact**: `Storage.find()` crashes if localStorage has null keys.

---

### H-05: `useArrToggle.ts:17-23` -- Stale closure captures old `items` array

**File**: `src/hooks/data/useArrToggle.ts`

```typescript
const onToggleItems = useInline((item: T, status?: boolean) => {
  const hasItem = items.includes(item)      // `items` from closure
  setItems(items.filter((it) => it !== item)) // stale `items` reference
})
```

`useInline` stabilizes the callback reference but the closure captures the `items` state value at the time the callback was created. Rapid successive toggles will operate on stale state. Should use functional setState: `setItems(prev => prev.filter(...))`.

**Impact**: Rapid toggling can lose state updates.

---

### H-06: `useInput.ts:105` -- Function call `getValue(inputRef)` in useEffect dependency array

**File**: `src/hooks/dom/useInput.ts`

```typescript
useEffect(() => {
  const curVal = getValue(inputRef)
  text !== curVal && updateValue(inputRef, text)
}, [text, inputRef.current, initValRef.current, getValue(inputRef)])
//                                                ^^^^^^^^^^^^^^^^^
```

`getValue(inputRef)` is a function call, not a stable reference. React's dependency array expects values, not expressions that execute on every render. This causes the effect to run on every render since the return value is re-evaluated each time.

**Impact**: Effect runs every render instead of only when dependencies change.

---

### H-07: `useLoadDynamic.ts:25` -- `modules` in useEffect deps causes infinite re-render loop

**File**: `src/hooks/api/useLoadDynamic.ts`

```typescript
useEffect(() => {
  loader && name && !exists(modules[name]) && ife(async () => {
    const markdown = await loader()
    setModules({ ...modules, [name]: markdown.default || false })
  })
}, [loader, name, modules])  // `modules` changes after setModules -> re-triggers
```

When `setModules` is called, `modules` changes (new object reference), which re-triggers the effect. The `!exists(modules[name])` guard prevents infinite loops only when the module loads successfully. If the loader throws an error, `modules[name]` stays `undefined` and the effect re-triggers infinitely.

**Impact**: Infinite re-render loop if the loader throws an error.

---

### H-08: `useFetch.ts:141,152` -- `onCacheHit`/`onCacheMiss` have stale closure references

**File**: `src/hooks/api/useFetch.ts`

```typescript
const onCacheHit = useCallback(async (cacheKey) => {
  onLoading?.(false)   // captured from initial resolveArgs
  onSuccess?.(resp)    // never updates
}, [])                 // empty deps = never re-created

const onCacheMiss = useCallback(async (opts, cacheKey) => {
  onSuccess?.(resp)
  onError?.(err?.message)
}, [cache?.enabled])   // only re-created when cache.enabled changes
```

Both callbacks use `useCallback` with minimal/empty dependency arrays, but reference `onLoading`, `onSuccess`, and `onError` from closures. If these callbacks change, the stale versions are used.

**Impact**: Stale callback execution; `onSuccess`/`onError`/`onLoading` may not fire correctly.

---

### H-09: `useFetch.ts:197-199` -- Promise constructor anti-pattern

**File**: `src/hooks/api/useFetch.ts`

```typescript
const triggerRes = new Promise(async (res) =>
  res(await response)
) as TTriggerResp<T>
```

Wrapping `await response` inside `new Promise(async (res) => res(...))` is the "explicit promise construction anti-pattern". If `response` rejects, the rejection is caught by the async executor but the outer promise may not properly propagate the error.

**Impact**: Swallowed rejection errors in certain failure paths.

---

### H-10: `useColors.ts:14-15` -- `Object.values` on color objects returns non-string values

**File**: `src/hooks/theme/useColors.ts`

```typescript
const darkColors = Object.values(colors.dark)
const lightColors = Object.values(colors.light)
```

`colors.dark` and `colors.light` contain nested objects (`grey`, `border`, `editor`, `states`) alongside string values. `Object.values()` returns a mixed array of strings and objects. When `useColorForName` indexes into this array, it may return an object instead of a CSS color string.

**Impact**: `useColorForName` can return `{default: "#303030", alt: ...}` instead of a color string, causing React rendering errors.

---

### H-11: `MenuItems.tsx:112` -- Missing braces around else-if body

**File**: `src/components/Menu/MenuItems.tsx`

```typescript
} else if (items?.length || localItems?.length) !open && setOpen(true)
```

This is parsed as:

```typescript
} else if (items?.length || localItems?.length) {
  // empty block
}
!open && setOpen(true)  // always executes (standalone expression)
```

The `!open && setOpen(true)` is NOT inside the else-if block. It executes unconditionally on every `onItemClick` call where `it === item` is true.

**Impact**: `setOpen(true)` fires unconditionally when clicking the current item, not only when items exist.

---

### H-12: `InlineSelect.tsx` -- Unguarded access to potentially undefined `itemMap`

**File**: `src/components/Inputs/InlineSelect.tsx`

```typescript
itemMap[item?.value]  // itemMap may be undefined
```

If `itemMap` is not initialized or the options array is empty, accessing `itemMap[item?.value]` throws `TypeError: Cannot read properties of undefined`.

**Impact**: Component crash when options are empty or not yet loaded.

---

### H-13: `isValidFuncComp.tsx` -- `isFuncElement` uses fragile string detection

**File**: `src/utils/isValidFuncComp.tsx`

```typescript
String(Component).includes('return React.createElement')
```

This check relies on the string representation of function bodies, which are minified in production builds. The string `return React.createElement` will not exist in minified code. Also breaks with the modern JSX transform (`jsx`/`jsxs` from `react/jsx-runtime`).

**Impact**: `isFuncElement` always returns `false` in production builds.

---

### H-14: `date.ts:1-2` -- `isValidDate` type guard uses incorrect validation logic

**File**: `src/utils/date.ts`

```typescript
const isValidDate = (date: Date | number | string): date is Date =>
  Object.prototype.toString.call(date) === '[object Date]' && isFinite(date as number)
```

The type guard declares `date is Date` while accepting `number | string` inputs. When passed a number, the guard returns `false` (because `toString.call(number) !== '[object Date]'`) even though numbers are valid inputs to `getDateValues`.

**Impact**: `getDateValues` silently fails for numeric timestamps that pass through `isValidDate` check.

---

## Medium Issues

### M-01: `theme.tsx:174` -- `DefColors[type]` crashes if `type` is undefined

**File**: `src/theme/theme.tsx`

```typescript
export const makeTheme = (theme: TTSTheme): Theme => {
  const { type } = theme
  return buildTheme(type, { ...DefColors[type], ...theme[type] })
}
```

If `theme.type` is `undefined`, `DefColors[undefined]` returns `undefined`, and spreading `undefined` into an object with other `undefined` values from `theme[undefined]` produces an empty/broken colors object.

**Impact**: Theme initialization crash or broken theming if type is not set.

---

### M-02: `useColor.ts:19-22` -- Duplicate lookup with identical arguments

**File**: `src/hooks/theme/useColor.ts`

```typescript
const named = get(theme.palette.colors, color, undefined)  // line 19
if (named) return named

const direct = get(theme.palette.colors, color, undefined) // line 22 -- SAME CALL
return isStr(direct) ? direct : color
```

Lines 19 and 22 perform the exact same `get()` call. The second call always returns the same result, so the `isStr(direct)` check is redundant after `named` was already falsy.

**Impact**: Dead code; no functional bug but indicates logic error.

---

### M-03: `CacheContext.tsx:16` -- New `CacheService` created on every render for non-global

**File**: `src/contexts/CacheContext.tsx`

```typescript
const value = fromGlobal !== false ? GlobalCache : new CacheService({ global: false })
```

When `fromGlobal` is `false`, a new `CacheService` instance is created on every render. Should be memoized with `useMemo` or `useRef`.

**Impact**: Cache is reset on every parent re-render; items are never actually cached in non-global mode.

---

### M-04: `customEvt.tsx:1` -- Unused `uuid` import

**File**: `src/utils/customEvt.tsx`

```typescript
import { uuid } from '@keg-hub/jsutils/uuid'  // never used
```

**Impact**: Unnecessary bundle size increase.

---

### M-05: `inputs.tsx:40-42` -- Dead code in `resolveDepends`

**File**: `src/utils/inputs.tsx`

The check `if (!outcome) return false` is followed by `return !outcome ? false : ...`. The `!outcome` branch can never execute because the earlier line already returned.

**Impact**: Dead code; confusing to maintain.

---

### M-06: `omit.ts` -- Uses `export default` which is invisible to barrel `export *`

**File**: `src/utils/omit.ts`

Uses `export default omit` but the barrel at `utils/index.ts` uses `export * from './omit'`. The `export *` syntax does NOT re-export default exports.

**Impact**: `omit` function is not accessible through the barrel export. Must use direct import.

---

### M-07: `hooks/components/index.ts` -- Missing `useForceUpdate` and `useMergedRef` exports

**File**: `src/hooks/components/index.ts`

The barrel exports 9 hooks but `useForceUpdate.ts` and `useMergedRef.ts` files exist in the directory and are not exported.

**Impact**: These hooks are only reachable via direct file imports.

---

### M-08: `Card.tsx` / `Section.tsx` -- Falsy JSX rendering bug

**File**: `src/components/Card/Card.tsx`, `src/components/Section/Section.tsx`

```typescript
{actions?.length && <CardActions ... />}
```

When `actions` is an empty array, `actions.length` is `0` (falsy but a number). JSX renders `0` as text, not as "nothing".

**Impact**: Renders literal `0` in the DOM when actions is empty array.

---

### M-09: `FormInput.tsx` -- Returns `null` but return type is `JSX.Element`

**File**: `src/components/Inputs/FormInput.tsx`

The function has return type `JSX.Element` but returns `null` in the default case. Should be `JSX.Element | null`.

**Impact**: TypeScript type mismatch (non-breaking with `strict: false`).

---

### M-10: `AutoInput.tsx:1` -- Component marked "don't use" but publicly exported

**File**: `src/components/Inputs/AutoInput.tsx`

```typescript
// Don't use this component, it still needs work
```

Despite the warning comment, the component is exported through the `Inputs` barrel and is part of the public API.

**Impact**: Consumers may unknowingly use an incomplete/unstable component.

---

### M-11: `CheckboxInput.tsx` -- Potential double-fire of `onChange`

**File**: `src/components/Inputs/CheckboxInput.tsx`

The `onChange` callback is attached to both the outer `Box` click handler and the inner `FormControlLabel` change handler. Clicking the checkbox triggers both.

**Impact**: `onChange` fires twice per user interaction in some cases.

---

### M-12: `MemoChildren.tsx` -- `memo()` with no custom comparator is ineffective for children

**File**: `src/components/MemoChildren/MemoChildren.tsx`

`React.memo()` with default shallow comparison on `children` prop never prevents re-renders because React creates new JSX element objects on every render. Children are always new references.

**Impact**: Component provides no memoization benefit; false sense of optimization.

---

### M-13: `Portal.tsx:26` -- Uses `console.log` for error reporting

**File**: `src/components/Portal/Portal.tsx`

```typescript
if (!element) return console.log(`Can not find Portal Dom element`)
```

Uses `console.log` instead of `console.warn` or `console.error` for a failure condition.

**Impact**: Silent failure; error not surfaced appropriately.

---

### M-14: `DraggableDialog.tsx:256` -- `onClose` passes `true` for status when dialog closes

**File**: `src/components/Dialog/DraggableDialog.tsx`

```typescript
onClose={(evt, reason) => onToggle(true, reason, evt)}
```

When MUI calls `onClose` (dialog is closing), the code passes `status=true` (open). Likely should be `false`.

**Impact**: `onToggle` handler receives inverted status on dialog close.

---

### M-15: `useLayoutMaxWidth.ts` -- Accesses non-standard `window.theme.layout`

**File**: `src/hooks/components/useLayoutMaxWidth.ts`

Accesses `window.theme.layout` which is not a standard browser API. Assumes a custom global has been set up, but there is no evidence of this being initialized.

**Impact**: Returns `undefined` if global theme is not injected; may cause layout calculation failures.

---

### M-16: `useResize.ts` -- Global mousemove/mouseup listeners recreated on state changes

**File**: `src/hooks/components/useResize.ts`

The `useEffect` for mouse event listeners depends on resize state values (via `onMouseMove`), causing listeners to be removed and re-added on every resize state change.

**Impact**: Performance cost during drag operations; brief window where events are missed.

---

### M-17: `scripts/loadEnvs.ts` -- Duplicated from domain repo

**File**: `scripts/loadEnvs.ts`

This file is a near-exact copy of `repos/domain/src/environment/loadEnvs.ts`. Code duplication increases maintenance burden and risks drift.

**Impact**: Changes to domain's `loadEnvs` are not reflected here and vice versa.

---

### M-18: `InlineDom.tsx:20` -- Never re-converts when `html` prop changes

**File**: `src/components/InlineDom/InlineDom.tsx`

```typescript
if (converted) return  // prevents re-conversion on html prop change
```

Once the initial HTML is converted, subsequent changes to the `html` prop are ignored.

**Impact**: Component renders stale HTML content after prop changes.

---

### M-19: `storage.ts:10` -- `set()` silently swallows all errors

**File**: `src/services/storage.ts`

```typescript
set = (key, value, stringify = true) => {
  try {
    ...
  } catch (err) {}  // empty catch
}
```

Empty `catch` block means localStorage quota exceeded errors, serialization errors, or SecurityErrors are silently lost.

**Impact**: Data loss without any warning when localStorage is full or unavailable.

---

## Low Issues

### L-01: `TextElements.tsx` -- All 9 forwardRef components missing `displayName`

**File**: `src/components/Text/TextElements.tsx`

Components `H1` through `H6`, `Paragraph`, `Span`, and `Label` are created with `forwardRef` but none have a `displayName` set.

**Impact**: Shows as "Anonymous" in React DevTools.

---

### L-02: `ListItem.tsx:300-317` -- `ListItem` forwardRef missing `displayName`

**File**: `src/components/List/ListItem.tsx`

The main `ListItem` export is a `forwardRef` without `displayName`.

**Impact**: Shows as "Anonymous" in React DevTools.

---

### L-03: `useKeyDown.ts` -- Uses deprecated `evt.keyCode`

**File**: `src/hooks/dom/useKeyDown.ts`

Uses `evt.keyCode` which is deprecated in favor of `evt.key`.

**Impact**: Future compatibility risk.

---

### L-04: `Dropdown.tsx:161` -- `@ts-ignore` suppression

**File**: `src/components/Dropdown/Dropdown.tsx`

Contains `@ts-ignore` directive to suppress a TypeScript error instead of fixing the type.

**Impact**: Hides potential type errors.

---

### L-05: `cron.test.ts:6` -- Placeholder test with no real assertion

**File**: `src/utils/cron.test.ts`

```typescript
it(`should convert a cron object into a string`, () => {
  expect(true).toBe(true)
})
```

The only test file in the repo contains a placeholder assertion that always passes.

**Impact**: Zero effective test coverage.

---

### L-06: `vitest.config.ts:22` -- Test include pattern only matches `.test.ts`

**File**: `configs/vitest.config.ts`

```typescript
include: [`**/*.test.ts`]
```

Excludes `.test.tsx` files. Any React component tests written as `.tsx` would not be picked up.

**Impact**: Component tests using JSX would be silently ignored.

---

### L-07: `biome.json:66` -- `noUnusedVariables` set to `off`

**File**: `configs/biome.json`

Unused variable detection is disabled, which means dead imports and variables accumulate silently (as seen with the `uuid` import in `customEvt.tsx`).

**Impact**: Dead code accumulates without tooling warnings.

---

### L-08: `Dropdown.styled.tsx` -- CSS syntax errors with colons in selectors

**File**: `src/components/Dropdown/Dropdown.styled.tsx`

```css
& .MuiAccordionSummary-content: {  /* trailing colon creates empty pseudo-selector */
  margin: 0px;  /* Never applied */
}
```

Trailing colons in CSS selectors create invalid pseudo-selectors. Rules inside are silently ignored.

**Impact**: Styles not applied; visual inconsistencies.

---

### L-09: `Monaco.styles.tsx` -- CSS value `border: None` should be `border: none`

**File**: `src/components/Monaco/Monaco.styles.tsx`

`border: None` uses a capital N. Correct CSS value is lowercase `none`.

**Impact**: Browser may still parse it, but non-standard.

---

### L-10: `LoadingDots.tsx` -- Global style injection per instance

**File**: `src/components/Loading/LoadingDots.tsx`

Each `LoadingDots` component instance injects a `<style>` tag with `@keyframes` into the DOM. Multiple instances create duplicate global styles.

**Impact**: DOM pollution with duplicate style tags.

---

### L-11: `Definitions.styles.tsx` -- Hardcoded grid columns

**File**: `src/components/Definitions/Definitions.styles.tsx`

`grid-template-columns: repeat(6, 1fr)` is hardcoded. Not responsive to screen size.

**Impact**: Layout breaks on small screens.

---

### L-12: `Dropdown.styled.tsx` -- `noProps` array is module-level mutable

**File**: `src/components/Dropdown/Dropdown.styled.tsx`

```typescript
const noProps = [...]  // mutable module-scope array
```

Should be `as const` to prevent accidental mutation.

**Impact**: Potential mutation bug if any code pushes to the array.

---

### L-13: Empty styled components in multiple files

**Files**: `AccordionActions.styles.tsx`, `Tabs.styles.tsx`, `InfoTip.styles.tsx`, `Card.styled.tsx`

Multiple styled components have empty template literal bodies, serving no purpose as styled wrappers.

**Impact**: Unnecessary abstraction; code noise.

---

### L-14: `SelectInput.styles.tsx` -- Empty `label > {}` selector

**File**: `src/components/Inputs/SelectInput.styles.tsx`

Empty CSS ruleset that serves no purpose.

**Impact**: Dead CSS code.

---

### L-15: `Inputs.styles.tsx` -- Duplicate placeholder styling across 4 components

**File**: `src/components/Inputs/Inputs.styles.tsx`

Identical `::placeholder` CSS rules duplicated across `InputText`, `OutlinedInput`, `Textarea`, and `Tags`. Should be extracted to a shared mixin.

**Impact**: Maintenance burden; changes need to be made in 4 places.

---

### L-16: `Empty.styles.tsx` -- Missing CSS colon in `margin-top` property

**File**: `src/components/Empty/Empty.styles.tsx`

```css
margin-top ${gutter.dpx};  /* missing colon */
```

Should be `margin-top: ${gutter.dpx};`. The rule is silently ignored.

**Impact**: Margin not applied to empty state component.

---

## Test Assessment

### Coverage

| Metric | Value |
|--------|-------|
| Test files | 1 (`src/utils/cron.test.ts`) |
| Test cases | 1 |
| Real assertions | 0 (placeholder `expect(true).toBe(true)`) |
| Estimated coverage | ~0% |
| Components tested | 0 of ~30 |
| Hooks tested | 0 of ~25 |
| Utils tested | 0 of ~10 |
| Services tested | 0 of 3 |

### Test Infrastructure

- Vitest 1.6.1 configured with `jsdom` environment
- `@testing-library/react` 14.2.1 and `@testing-library/jest-dom` 6.4.2 installed
- `scripts/setupTests.ts` correctly extends matchers and runs cleanup
- Test include pattern `**/*.test.ts` (missing `**/*.test.tsx`)

### Recommendations

1. **Immediate**: Fix `vitest.config.ts` to include `**/*.test.tsx` pattern
2. **Priority**: Add tests for hooks with bugs (useArrToggle, useInput, useLoadDynamic)
3. **Priority**: Add tests for `eventEmitter.ts` (off() crash, once() behavior)
4. **Priority**: Add tests for cron utilities (parseCron, cronToString)
5. **Priority**: Add tests for `ListItem.tsx` expand/collapse behavior
6. **Goal**: Target 40% coverage for utils/hooks, 20% for components

---

## Cross-Repo Issues

### Components <-> Admin

| Issue | Detail |
|-------|--------|
| Missing barrel exports | Admin cannot import `useMonaco`, `useMonacoActions`, `useDefsFilters` via `@TSC/hooks` |
| `InlineDom` XSS | If admin passes any user-generated HTML to `InlineDom`, it is not sanitized |
| `MemoChildren` ineffective | Admin uses this component but the memoization provides no benefit |

### Components <-> Domain

| Issue | Detail |
|-------|--------|
| `loadEnvs.ts` duplication | `scripts/loadEnvs.ts` duplicates `@tdsk/domain`'s `loadEnvs` (identical logic) |
| `addToProcess.ts` duplication | `scripts/addToProcess.ts` duplicates `@tdsk/domain`'s `addToProcess` |

### Components <-> Build System

| Issue | Detail |
|-------|--------|
| Missing `.tsx` test pattern | No `.test.tsx` files would be discovered by vitest |

---

## Barrel Export Gap Summary

The package has a systematic barrel export problem. Multiple modules are defined but unreachable through the main export chain:

| Module | Missing From |
|--------|-------------|
| `hooks/monaco/*` | `hooks/index.ts` |
| `hooks/monaco/useMonacoActions` | `hooks/monaco/index.ts` (double gap) |
| `hooks/definitions/*` | `hooks/index.ts` |
| `hooks/components/useForceUpdate` | `hooks/components/index.ts` |
| `hooks/components/useMergedRef` | `hooks/components/index.ts` |
| `utils/cron` | `utils/index.ts` |
| `utils/fetcher` | `utils/index.ts` |
| `utils/omit` (default export) | Not captured by `export *` |
| `components/InfoTip` | `components/index.ts` |
| `components/NotificationCount` | `components/index.ts` |

**Total**: 10 modules missing from export chain.

---

## Architecture Notes

### Strengths

1. **Well-organized directory structure**: Components, hooks, services, utils, types, theme, and HOCs all have clear boundaries with barrel exports.
2. **Consistent styled component pattern**: All style files use MUI's `styled()` API with template literal CSS strings, theme-aware color selection.
3. **Good TypeScript generics usage**: `TListItem<Meta, ID>`, `TEventCB<T>`, `Storage.get<T>` show proper generic patterns.
4. **TooltipHoc pattern**: Clean HOC implementation with `forwardRef` support for adding tooltips to any component.
5. **EventEmitter singleton**: Clean pub/sub pattern with `once`, `on`, `off`, `emit`, `dispatch`, and `reset` methods.
6. **Theme system**: Comprehensive color palette with dark/light mode, dimension constants, gutter spacing system, and MUI module augmentation.

### Weaknesses

1. **Near-zero test coverage**: 1 placeholder test across ~170 source files. No component tests, no hook tests, no service tests.
2. **Barrel export gaps**: At least 10 modules are missing from their barrel exports.
3. **Stale closure pattern**: Multiple hooks (`useArrToggle`, `useFetch`) capture stale state in callbacks. The `useInline` utility does not prevent this for state-dependent callbacks.
4. **CSS-in-JS issues**: Template literal CSS strings have no compile-time validation. Missing colons, trailing colons creating pseudo-selectors, and capitalization issues go undetected.
5. **No error boundaries**: No React error boundary components in the library. Component crashes propagate to the consuming application.
6. **Missing dependency arrays**: At least 2 useEffects (`Portal`, `DraggableDialog`) lack dependency arrays, running every render.

### Key Stats

| Metric | Value |
|--------|-------|
| Total source files | ~170 |
| Components | ~30 |
| Hooks | ~25 |
| Utils | ~10 |
| Services | 3 (EventEmitter, CacheService, Storage) |
| Contexts | 1 (CacheContext) |
| HOCs | 1 (TooltipHoc) |
| Test coverage | ~0% |
| TypeScript strict mode | OFF |
| Issues found | 56 (5 critical, 2 security, 14 high, 19 medium, 16 low) |
| Barrel export gaps | 10 modules missing |

### Dependencies

| Package | Version | Status |
|---------|---------|--------|
| react | 18.3.1 | Used |
| @mui/material | 6.1.2 | Used |
| @monaco-editor/react | 4.6.0 | Used |
| overlayscrollbars-react | 0.5.6 | Used |
| react-from-dom | 0.7.5 | Used -- XSS risk |
| mui-chips-input | 4.0.1 | Used |
| mui-image-alter | 3.2.0 | Used |
| react-resizable-panels | 3.0.1 | Used |

All production dependencies are used. No unused dependencies found.

---

**End of Audit**
