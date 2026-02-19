/**
 * Vitest setup file that mocks ink and ink-testing-library
 * to work around the react-reconciler@0.33.0 / React 18 incompatibility.
 *
 * ink@6.7.0 requires react-reconciler@0.33.0 which needs React 19,
 * but this project uses React 18. These mocks provide a lightweight
 * rendering pipeline with a minimal React hooks dispatcher.
 */
import React from 'react'
import { vi } from 'vitest'

// --- Minimal hooks dispatcher for rendering outside React's reconciler ---

let hookStates: any[] = []
let hookIndex = 0

function resetHooks() {
  hookStates = []
  hookIndex = 0
}

const minimalDispatcher = {
  readContext(context: any) {
    return context._currentValue
  },
  useCallback(callback: any) {
    return callback
  },
  useContext(context: any) {
    return context._currentValue
  },
  useEffect(create: any, deps: any) {
    // Run effects synchronously for auto-select behavior
    const idx = hookIndex++
    if (hookStates[idx] === undefined) {
      hookStates[idx] = { deps }
      try {
        create()
      } catch {}
    }
  },
  useLayoutEffect() {},
  useInsertionEffect() {},
  useMemo(create: any, deps: any) {
    const idx = hookIndex++
    if (hookStates[idx] === undefined) {
      hookStates[idx] = create()
    }
    return hookStates[idx]
  },
  useReducer(reducer: any, initialArg: any, init: any) {
    const idx = hookIndex++
    if (hookStates[idx] === undefined) {
      hookStates[idx] = init ? init(initialArg) : initialArg
    }
    return [hookStates[idx], () => {}]
  },
  useRef(initialValue: any) {
    const idx = hookIndex++
    if (hookStates[idx] === undefined) {
      hookStates[idx] = { current: initialValue }
    }
    return hookStates[idx]
  },
  useState(initialState: any) {
    const idx = hookIndex++
    if (hookStates[idx] === undefined) {
      hookStates[idx] = typeof initialState === 'function' ? initialState() : initialState
    }
    return [hookStates[idx], () => {}]
  },
  useDebugValue() {},
  useDeferredValue(value: any) {
    return value
  },
  useTransition() {
    return [false, (cb: any) => cb()]
  },
  useId() {
    const idx = hookIndex++
    return `:r${idx}:`
  },
  useSyncExternalStore(subscribe: any, getSnapshot: any) {
    return getSnapshot()
  },
}

// Access React internals to inject our dispatcher
const internals = (React as any).__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED

// --- Mock useInput from ink ---
let inputHandlers: Array<(input: string, key: any) => void> = []

function mockUseInput(handler: (input: string, key: any) => void): void {
  inputHandlers.push(handler)
}

// --- Mock ink components ---

function MockText({ children }: { children?: React.ReactNode }) {
  return React.createElement('span', null, children)
}

function MockBox({ children }: any) {
  return React.createElement('div', null, children)
}

vi.mock('ink', () => ({
  Text: MockText,
  Box: MockBox,
  useInput: mockUseInput,
  useApp: () => ({ exit: () => {} }),
  render: (element: any) => ({
    waitUntilExit: () => Promise.resolve(),
    unmount: () => {},
    rerender: () => {},
    clear: () => {},
  }),
}))

// --- Recursive React element to text renderer ---

function renderElement(el: any): string {
  if (el === null || el === undefined) return ''
  if (typeof el === 'string') return el
  if (typeof el === 'number') return String(el)
  if (typeof el === 'boolean') return ''

  if (Array.isArray(el)) {
    return el.map(renderElement).join('')
  }

  if (!React.isValidElement(el)) {
    return String(el)
  }

  const element = el as React.ReactElement<any>
  const { type, props } = element

  // For function components, call with our dispatcher active
  if (typeof type === 'function') {
    try {
      let rendered: any
      if (type.prototype && type.prototype.isReactComponent) {
        const instance = new (type as any)(props)
        rendered = instance.render()
      } else {
        rendered = (type as any)(props)
      }
      return renderElement(rendered)
    } catch {
      return renderElement(props?.children)
    }
  }

  // For host elements (span, div, etc.), render children
  const children = props?.children
  if (children === null || children === undefined) return ''
  return renderElement(children)
}

// --- Mock ink-testing-library ---
vi.mock('ink-testing-library', () => ({
  render: (element: React.ReactElement) => {
    inputHandlers = []
    resetHooks()

    // Inject our minimal dispatcher
    const prevDispatcher = internals?.ReactCurrentDispatcher?.current
    if (internals?.ReactCurrentDispatcher) {
      internals.ReactCurrentDispatcher.current = minimalDispatcher
    }

    let text: string
    try {
      text = renderElement(element)
    } catch {
      text = ''
    } finally {
      // Restore the previous dispatcher
      if (internals?.ReactCurrentDispatcher && prevDispatcher) {
        internals.ReactCurrentDispatcher.current = prevDispatcher
      }
    }

    return {
      lastFrame: () => text,
      frames: [text],
      stdin: {
        write: (input: string) => {
          for (const handler of inputHandlers) {
            handler(input, {})
          }
        },
      },
      unmount: () => {},
      rerender: (newElement: React.ReactElement) => {},
    }
  },
}))
