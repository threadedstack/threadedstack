# Isolate Node.js Builtins Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 8 new Node.js builtin shim modules + 3 globals to the IsolateRunner so FaaS functions and npm dependencies can use standard Node.js APIs inside V8 isolates.

**Architecture:** Extract existing inline shim source strings into a `shims/` directory with a registry pattern. Each shim exports a `ShimDefinition` with source code, dependency declarations, and optional host callback setup. The `IsolateRunner` loops over the registry to compile shims in dependency order. New options (`env`, `maxTimerMs`) flow from `TSandboxConfig` through `LocalSandboxProvider` to the runner. Timers are handled as a special case in `IsolateRunner` due to bidirectional host-isolate communication requirements.

**Tech Stack:** TypeScript, isolated-vm (V8 isolates), just-bash (virtual shell/FS), Vitest

**Spec:** `docs/superpowers/specs/2026-04-01-isolate-node-builtins-design.md`

**IMPORTANT: Git Rules**
- NEVER commit, amend, revert, or change git history
- Read-only git only: `git status`, `git diff`, `git log`

---

## File Structure

### New files

| File | Responsibility |
|------|---------------|
| `repos/sandbox/src/local/shims/types.ts` | `ShimDefinition` type |
| `repos/sandbox/src/local/shims/index.ts` | Shim registry: ordered array of all shims |
| `repos/sandbox/src/local/shims/fs.ts` | `fs` / `node:fs` shim (extracted from isolate.ts) |
| `repos/sandbox/src/local/shims/path.ts` | `path` / `node:path` shim (extracted from isolate.ts) |
| `repos/sandbox/src/local/shims/childProcess.ts` | `child_process` / `node:child_process` shim (extracted + execSync) |
| `repos/sandbox/src/local/shims/buffer.ts` | `buffer` / `node:buffer` shim (new, pure JS) |
| `repos/sandbox/src/local/shims/url.ts` | `url` / `node:url` shim (new, pure JS) |
| `repos/sandbox/src/local/shims/querystring.ts` | `querystring` / `node:querystring` shim (new, pure JS) |
| `repos/sandbox/src/local/shims/events.ts` | `events` / `node:events` shim (new, pure JS) |
| `repos/sandbox/src/local/shims/os.ts` | `os` / `node:os` shim (new, pure JS) |
| `repos/sandbox/src/local/shims/assert.ts` | `assert` / `node:assert` shim (new, pure JS) |
| `repos/sandbox/src/local/shims/util.ts` | `util` / `node:util` shim (new, depends on buffer) |
| `repos/sandbox/src/local/shims/crypto.ts` | `crypto` / `node:crypto` shim (new, host-bridged) |
| `repos/sandbox/src/local/shims/process.ts` | Process globals-only shim (new, pure JS) |

### Modified files

| File | Changes |
|------|---------|
| `repos/sandbox/src/local/isolate.ts` | Refactor to use shim registry; add `env`, `maxTimerMs` options; add timer lifecycle management |
| `repos/sandbox/src/local/isolate.test.ts` | Update expected shim/callback counts; add tests for new options and timer cleanup |
| `repos/sandbox/src/local/local.ts:174-176` | Pass `env` and `maxTimerMs` from config to IsolateRunner |

---

## Chunk 1: Foundation — ShimDefinition type + registry + extract existing shims

### Task 1: Create ShimDefinition type

**Files:**
- Create: `repos/sandbox/src/local/shims/types.ts`

- [ ] **Step 1: Create the types file**

```typescript
// repos/sandbox/src/local/shims/types.ts
import type { Bash, IFileSystem } from 'just-bash'

export type ShimDeps = {
  bash: Bash
  fs: IFileSystem
  env?: Record<string, string>
  maxTimerMs?: number
}

export type ShimDefinition = {
  names: string[]
  source?: string
  dependencies?: string[]
  setupCallbacks?: (jail: any, ivm: any, deps: ShimDeps) => Promise<void>
  setupGlobals?: (context: any, deps: ShimDeps) => Promise<void>
}
```

- [ ] **Step 2: Verify types compile**

Run: `cd repos/sandbox && pnpm types`
Expected: PASS (no type errors)

---

### Task 2: Extract existing `fs` shim

**Files:**
- Create: `repos/sandbox/src/local/shims/fs.ts`

- [ ] **Step 1: Create fs shim file**

Extract the fs source string and host callbacks from `isolate.ts:83-162` and `isolate.ts:228-247` into a `ShimDefinition`:

```typescript
// repos/sandbox/src/local/shims/fs.ts
import type { ShimDefinition } from './types'

export const fsShim: ShimDefinition = {
  names: [`fs`, `node:fs`],

  source: `
    export const readFile = globalThis._fsReadFile
    export const writeFile = globalThis._fsWriteFile
    export const exists = globalThis._fsExists
    export const mkdir = globalThis._fsMkdir
    export const readdir = globalThis._fsReaddir
    export const unlink = globalThis._fsUnlink
    export const stat = globalThis._fsStat
    export default {
      readFile, writeFile, exists,
      mkdir, readdir, unlink, stat,
    }
  `,

  setupCallbacks: async (jail, ivm, deps) => {
    await jail.set(
      `_fsReadFile`,
      new ivm.Callback(
        async (path: string) => {
          return await deps.fs.readFile(path, { encoding: `utf-8` })
        },
        { async: true }
      )
    )

    await jail.set(
      `_fsWriteFile`,
      new ivm.Callback(
        async (path: string, content: string) => {
          await deps.fs.writeFile(path, content)
        },
        { async: true }
      )
    )

    await jail.set(
      `_fsExists`,
      new ivm.Callback(
        async (path: string) => {
          try {
            await deps.fs.stat(path)
            return true
          } catch {
            return false
          }
        },
        { async: true }
      )
    )

    await jail.set(
      `_fsMkdir`,
      new ivm.Callback(
        async (path: string) => {
          await deps.fs.mkdir(path, { recursive: true })
        },
        { async: true }
      )
    )

    await jail.set(
      `_fsReaddir`,
      new ivm.Callback(
        async (path: string) => {
          return await deps.fs.readdir(path)
        },
        { async: true }
      )
    )

    await jail.set(
      `_fsUnlink`,
      new ivm.Callback(
        async (path: string) => {
          await deps.fs.rm(path)
        },
        { async: true }
      )
    )

    await jail.set(
      `_fsStat`,
      new ivm.Callback(
        async (path: string) => {
          const stat = await deps.fs.stat(path)
          return {
            isDirectory: stat.isDirectory,
            isFile: stat.isFile,
            size: stat.size || 0,
          }
        },
        { async: true }
      )
    )
  },
}
```

- [ ] **Step 2: Verify types compile**

Run: `cd repos/sandbox && pnpm types`
Expected: PASS

---

### Task 3: Extract existing `path` shim

**Files:**
- Create: `repos/sandbox/src/local/shims/path.ts`

- [ ] **Step 1: Create path shim file**

Extract from `isolate.ts:249-285`:

```typescript
// repos/sandbox/src/local/shims/path.ts
import type { ShimDefinition } from './types'

export const pathShim: ShimDefinition = {
  names: [`path`, `node:path`],

  source: `
    export const join = (...parts) => parts.join('/').replace(/\\/\\/+/g, '/')
    export const resolve = (...parts) => {
      let resolved = ''
      for (const p of parts) {
        resolved = p.startsWith('/') ? p : (resolved ? resolved + '/' + p : p)
      }
      return resolved.replace(/\\/\\/+/g, '/')
    }
    export const dirname = (p) => {
      const parts = p.split('/')
      parts.pop()
      return parts.join('/') || '/'
    }
    export const basename = (p, ext) => {
      const b = p.split('/').pop() || ''
      return ext && b.endsWith(ext) ? b.slice(0, -ext.length) : b
    }
    export const extname = (p) => {
      const m = p.match(/\\.[^.]+$/)
      return m ? m[0] : ''
    }
    export const normalize = (p) => p.replace(/\\/\\/+/g, '/')
    export const sep = '/'
    export const posix = { sep: '/' }
    export default { join, resolve, dirname, basename, extname, normalize, sep, posix }
  `,
}
```

- [ ] **Step 2: Verify types compile**

Run: `cd repos/sandbox && pnpm types`
Expected: PASS

---

### Task 4: Extract existing `child_process` shim + add execSync

**Files:**
- Create: `repos/sandbox/src/local/shims/childProcess.ts`

- [ ] **Step 1: Create child_process shim file**

Extract from `isolate.ts:164-176` and `isolate.ts:287-301`, adding `execSync`. Note: all commands route through the just-bash virtual shell (sandboxed, no real host access).

**Known limitation**: `_shellRun` is an async host callback, so both `run()` and `execSync()` return Promises. True synchronous execution is impossible in V8 isolates. This means `execSync` is actually async despite its name -- npm packages that use `const out = execSync('cmd')` directly will get a Promise. This matches how other sandbox runtimes (e.g., Cloudflare Workers) handle this constraint. Code that does `const out = await execSync('cmd')` will work correctly.

```typescript
// repos/sandbox/src/local/shims/childProcess.ts
import type { ShimDefinition } from './types'

export const childProcessShim: ShimDefinition = {
  names: [`child_process`, `node:child_process`],

  source: `
    const run = globalThis._shellRun
    // Note: execSync returns a Promise (async host bridge).
    // True sync execution is impossible in V8 isolates.
    const execSync = (cmd) => {
      return run(cmd)
    }
    export { run, execSync }
    export default { run, execSync }
  `,

  setupCallbacks: async (jail, ivm, deps) => {
    await jail.set(
      `_shellRun`,
      new ivm.Callback(
        async (cmd: string) => {
          const result = await deps.bash.exec(cmd)
          if (result.exitCode !== 0)
            throw new Error(result.stderr || `Command failed: ${cmd}`)
          return result.stdout
        },
        { async: true }
      )
    )
  },
}
```

- [ ] **Step 2: Verify types compile**

Run: `cd repos/sandbox && pnpm types`
Expected: PASS

---

### Task 5: Create shim registry

**Files:**
- Create: `repos/sandbox/src/local/shims/index.ts`

- [ ] **Step 1: Create registry with existing shims only**

```typescript
// repos/sandbox/src/local/shims/index.ts
import type { ShimDefinition } from './types'

import { fsShim } from './fs'
import { pathShim } from './path'
import { childProcessShim } from './childProcess'

export type { ShimDefinition, ShimDeps } from './types'

/**
 * Ordered array of all builtin shims.
 * Compilation order matters: dependencies must appear before dependents.
 * Module shims (with `source`) are compiled as ES modules.
 * Global-only shims (no `source`) only run setupCallbacks/setupGlobals.
 */
export const shimRegistry: ShimDefinition[] = [
  pathShim,
  fsShim,
  childProcessShim,
]

/**
 * All builtin shim module names -- these survive releaseUserModules().
 * Includes both bare and node:-prefixed names.
 */
export const builtinShimNames = new Set(
  shimRegistry.flatMap((s) => s.names)
)
```

- [ ] **Step 2: Verify types compile**

Run: `cd repos/sandbox && pnpm types`
Expected: PASS

---

### Task 6: Refactor IsolateRunner to use shim registry

**Files:**
- Modify: `repos/sandbox/src/local/isolate.ts`

- [ ] **Step 1: Update IsolateRunnerOptions type**

In `isolate.ts:29-33`, add new options:

```typescript
export type IsolateRunnerOptions = {
  bash: Bash
  fs: IFileSystem
  memory?: number
  env?: Record<string, string>
  maxTimerMs?: number
}
```

- [ ] **Step 2: Update constructor to store new options**

Add new private fields after `#output`:

```typescript
#env: Record<string, string>
#maxTimerMs: number
```

In constructor (lines 51-55), store them:

```typescript
constructor(opts: IsolateRunnerOptions) {
  this.#fs = opts.fs
  this.#bash = opts.bash
  this.#memory = opts.memory || 128
  this.#env = opts.env || {}
  this.#maxTimerMs = opts.maxTimerMs || 30000
}
```

- [ ] **Step 3: Refactor init() to use registry setupCallbacks**

Replace the inline host callback setup (lines 83-197) with a loop over the registry. Keep the console bridge (lines 66-81) and fetch callback/global (lines 178-218) inline since they are not module shims:

```typescript
// After console bridge, before fetch callback:
const deps = {
  bash: this.#bash,
  fs: this.#fs,
  env: this.#env,
  maxTimerMs: this.#maxTimerMs,
}

for (const shim of shimRegistry) {
  if (shim.setupCallbacks) {
    await shim.setupCallbacks(jail, ivm, deps)
  }
}
```

Remove the inline fs callbacks (lines 83-162) and shell callback (lines 164-176) — these are now in the shim definitions.

- [ ] **Step 4: Refactor #compile() to use registry**

Replace inline source string compilation (lines 224-301) with:

```typescript
async #compile(): Promise<void> {
  if (!this.#isolate || !this.#context) throw new Error(`Isolate not created`)

  for (const shim of shimRegistry) {
    if (!shim.source) continue

    const mod = await this.#isolate.compileModule(shim.source, {
      filename: `node:${shim.names[0]}`,
    })

    await mod.instantiate(this.#context, (specifier: string) => {
      const dep = this.#shims.get(specifier)
      if (!dep) throw new Error(`Module not found: ${specifier}`)
      return dep
    })

    await mod.evaluate()

    for (const name of shim.names) {
      this.#shims.set(name, mod)
    }
  }

  const deps = {
    bash: this.#bash,
    fs: this.#fs,
    env: this.#env,
    maxTimerMs: this.#maxTimerMs,
  }

  for (const shim of shimRegistry) {
    if (shim.setupGlobals) {
      await shim.setupGlobals(this.#context, deps)
    }
  }
}
```

- [ ] **Step 5: Update #builtinNames to use registry**

Replace the static set (lines 328-336) with imported `builtinShimNames`:

```typescript
import { shimRegistry, builtinShimNames } from '@TSB/local/shims'

// Replace releaseUserModules to use builtinShimNames:
releaseUserModules(): void {
  for (const [name, mod] of this.#shims) {
    if (builtinShimNames.has(name)) continue
    safeRelease(() => mod.release(), `released`, `releasing module '${name}'`)
    this.#shims.delete(name)
  }
}
```

Remove the old `static readonly #builtinNames` field.

- [ ] **Step 6: Run existing tests to verify refactor is behavior-preserving**

Run: `cd repos/sandbox && pnpm test`
Expected: All existing tests pass. `mockCompileModule` count = 3 (fs, path, child_process). `mockSet` callback names still match.

- [ ] **Step 7: Verify types compile**

Run: `cd repos/sandbox && pnpm types`
Expected: PASS

---

### Task 7: Wire env/maxTimerMs through LocalSandboxProvider

**Files:**
- Modify: `repos/sandbox/src/local/local.ts:174-176`

- [ ] **Step 1: Update IsolateRunner construction**

Change line 176 from:
```typescript
runner = new IsolateRunner({ memory, bash, fs })
```
to:
```typescript
runner = new IsolateRunner({
  memory,
  bash,
  fs,
  env: config.envVars || {},
  maxTimerMs: (config.options?.maxTimerMs as number) || undefined,
})
```

- [ ] **Step 2: Run tests and verify types**

Run: `cd repos/sandbox && pnpm test && pnpm types`
Expected: All tests pass

---

## Chunk 2: Pure JS shims — buffer, url, querystring, events, os, assert, util

### Task 8: Add `buffer` shim

**Files:**
- Create: `repos/sandbox/src/local/shims/buffer.ts`
- Modify: `repos/sandbox/src/local/shims/index.ts` (add to registry)

- [ ] **Step 1: Create buffer shim**

```typescript
// repos/sandbox/src/local/shims/buffer.ts
import type { ShimDefinition } from './types'

export const bufferShim: ShimDefinition = {
  names: [`buffer`, `node:buffer`],

  source: `
    const _hexChars = '0123456789abcdef'

    function _utf8Encode(str) {
      const bytes = []
      for (let i = 0; i < str.length; i++) {
        let c = str.charCodeAt(i)
        if (c < 0x80) {
          bytes.push(c)
        } else if (c < 0x800) {
          bytes.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f))
        } else if (c >= 0xd800 && c <= 0xdbff && i + 1 < str.length) {
          const next = str.charCodeAt(i + 1)
          if (next >= 0xdc00 && next <= 0xdfff) {
            c = ((c - 0xd800) << 10) + (next - 0xdc00) + 0x10000
            i++
            bytes.push(
              0xf0 | (c >> 18),
              0x80 | ((c >> 12) & 0x3f),
              0x80 | ((c >> 6) & 0x3f),
              0x80 | (c & 0x3f)
            )
          }
        } else {
          bytes.push(0xef, 0xbf, 0xbd)
        }
      }
      return bytes
    }

    function _utf8Decode(bytes) {
      let str = ''
      let i = 0
      while (i < bytes.length) {
        const b = bytes[i]
        if (b < 0x80) {
          str += String.fromCharCode(b)
          i++
        } else if ((b & 0xe0) === 0xc0) {
          str += String.fromCharCode(((b & 0x1f) << 6) | (bytes[i + 1] & 0x3f))
          i += 2
        } else if ((b & 0xf0) === 0xe0) {
          str += String.fromCharCode(
            ((b & 0x0f) << 12) | ((bytes[i + 1] & 0x3f) << 6) | (bytes[i + 2] & 0x3f)
          )
          i += 3
        } else {
          const cp =
            ((b & 0x07) << 18) |
            ((bytes[i + 1] & 0x3f) << 12) |
            ((bytes[i + 2] & 0x3f) << 6) |
            (bytes[i + 3] & 0x3f)
          const offset = cp - 0x10000
          str += String.fromCharCode(0xd800 + (offset >> 10), 0xdc00 + (offset & 0x3ff))
          i += 4
        }
      }
      return str
    }

    function _hexEncode(bytes) {
      let hex = ''
      for (const b of bytes) {
        hex += _hexChars[b >> 4] + _hexChars[b & 0x0f]
      }
      return hex
    }

    function _hexDecode(hex) {
      const bytes = []
      for (let i = 0; i < hex.length; i += 2) {
        bytes.push(parseInt(hex.substring(i, i + 2), 16))
      }
      return bytes
    }

    const _b64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

    function _base64Encode(bytes) {
      let result = ''
      let i = 0
      while (i < bytes.length) {
        const a = bytes[i++] || 0
        const b = bytes[i++]
        const c = bytes[i++]
        const triplet = (a << 16) | ((b ?? 0) << 8) | (c ?? 0)
        result += _b64Chars[(triplet >> 18) & 0x3f]
        result += _b64Chars[(triplet >> 12) & 0x3f]
        result += b !== undefined ? _b64Chars[(triplet >> 6) & 0x3f] : '='
        result += c !== undefined ? _b64Chars[triplet & 0x3f] : '='
      }
      return result
    }

    function _base64Decode(str) {
      const bytes = []
      let i = 0
      const clean = str.replace(/[^A-Za-z0-9+/]/g, '')
      while (i < clean.length) {
        const a = _b64Chars.indexOf(clean[i++])
        const b = _b64Chars.indexOf(clean[i++])
        const c = _b64Chars.indexOf(clean[i++])
        const d = _b64Chars.indexOf(clean[i++])
        bytes.push((a << 2) | (b >> 4))
        if (c !== -1) bytes.push(((b & 0x0f) << 4) | (c >> 2))
        if (d !== -1) bytes.push(((c & 0x03) << 6) | d)
      }
      return bytes
    }

    class Buffer {
      #data

      constructor(data) {
        this.#data = data
        this.length = data.length
      }

      static from(input, encoding = 'utf8') {
        if (input instanceof Buffer) return new Buffer([...input.#data])
        if (Array.isArray(input)) return new Buffer([...input])
        if (typeof input !== 'string') throw new TypeError('First argument must be a string, Buffer, or Array')

        switch (encoding) {
          case 'utf8':
          case 'utf-8':
            return new Buffer(_utf8Encode(input))
          case 'hex':
            return new Buffer(_hexDecode(input))
          case 'base64':
            return new Buffer(_base64Decode(input))
          case 'ascii':
          case 'latin1':
          case 'binary':
            return new Buffer(Array.from(input, c => c.charCodeAt(0) & 0xff))
          default:
            return new Buffer(_utf8Encode(input))
        }
      }

      static alloc(size, fill = 0) {
        return new Buffer(new Array(size).fill(typeof fill === 'number' ? fill : 0))
      }

      static isBuffer(obj) {
        return obj instanceof Buffer
      }

      static concat(list) {
        const combined = []
        for (const buf of list) {
          if (buf instanceof Buffer) combined.push(...buf.#data)
          else combined.push(...buf)
        }
        return new Buffer(combined)
      }

      static byteLength(str, encoding = 'utf8') {
        return Buffer.from(str, encoding).length
      }

      toString(encoding = 'utf8') {
        switch (encoding) {
          case 'utf8':
          case 'utf-8':
            return _utf8Decode(this.#data)
          case 'hex':
            return _hexEncode(this.#data)
          case 'base64':
            return _base64Encode(this.#data)
          case 'ascii':
          case 'latin1':
          case 'binary':
            return String.fromCharCode(...this.#data)
          default:
            return _utf8Decode(this.#data)
        }
      }

      slice(start = 0, end = this.length) {
        return new Buffer(this.#data.slice(start, end))
      }

      equals(other) {
        if (!(other instanceof Buffer)) return false
        if (this.length !== other.length) return false
        for (let i = 0; i < this.length; i++) {
          if (this.#data[i] !== other.#data[i]) return false
        }
        return true
      }

      toJSON() {
        return { type: 'Buffer', data: this.#data }
      }
    }

    globalThis.Buffer = Buffer

    export { Buffer }
    export default { Buffer }
  `,
}
```

Note: `globalThis.Buffer = Buffer` is set inside the module source so it's available globally as soon as the buffer shim is compiled. No separate `setupGlobals` needed.

- [ ] **Step 2: Add buffer to registry**

In `repos/sandbox/src/local/shims/index.ts`, add `bufferShim` FIRST (before pathShim):

```typescript
import { bufferShim } from './buffer'

export const shimRegistry: ShimDefinition[] = [
  bufferShim,    // first -- crypto and util depend on it
  pathShim,
  fsShim,
  childProcessShim,
]
```

- [ ] **Step 3: Run tests**

Run: `cd repos/sandbox && pnpm test`
Expected: Tests pass. Update `mockCompileModule` count assertion in `isolate.test.ts:165` from 3 to 4.

- [ ] **Step 4: Verify types compile**

Run: `cd repos/sandbox && pnpm types`
Expected: PASS

---

### Task 9: Add `url` shim

**Files:**
- Create: `repos/sandbox/src/local/shims/url.ts`
- Modify: `repos/sandbox/src/local/shims/index.ts`

- [ ] **Step 1: Create url shim**

```typescript
// repos/sandbox/src/local/shims/url.ts
import type { ShimDefinition } from './types'

export const urlShim: ShimDefinition = {
  names: [`url`, `node:url`],

  source: `
    const URL = globalThis.URL
    const URLSearchParams = globalThis.URLSearchParams

    function parse(urlString, parseQueryString = false) {
      try {
        const u = new URL(urlString)
        return {
          protocol: u.protocol,
          slashes: u.protocol.endsWith(':'),
          auth: u.username ? (u.password ? u.username + ':' + u.password : u.username) : null,
          host: u.host,
          port: u.port || null,
          hostname: u.hostname,
          hash: u.hash || null,
          search: u.search || null,
          query: parseQueryString ? Object.fromEntries(u.searchParams) : (u.search ? u.search.slice(1) : null),
          pathname: u.pathname,
          path: u.pathname + (u.search || ''),
          href: u.href,
        }
      } catch {
        return { protocol: null, slashes: false, auth: null, host: null, port: null, hostname: null, hash: null, search: null, query: null, pathname: urlString, path: urlString, href: urlString }
      }
    }

    function format(urlObj) {
      if (typeof urlObj === 'string') return urlObj
      let result = ''
      if (urlObj.protocol) result += urlObj.protocol + '//'
      if (urlObj.auth) result += urlObj.auth + '@'
      if (urlObj.hostname) result += urlObj.hostname
      if (urlObj.port) result += ':' + urlObj.port
      if (urlObj.pathname) result += urlObj.pathname
      if (urlObj.search) result += urlObj.search
      if (urlObj.hash) result += urlObj.hash
      return result
    }

    function resolve(from, to) {
      try {
        return new URL(to, from).href
      } catch {
        return to
      }
    }

    export { URL, URLSearchParams, parse, format, resolve }
    export default { URL, URLSearchParams, parse, format, resolve }
  `,
}
```

- [ ] **Step 2: Add to registry after childProcessShim, run tests and types**

Run: `cd repos/sandbox && pnpm test && pnpm types`
Expected: PASS. Update `mockCompileModule` count to 5.

---

### Task 10: Add `querystring` shim

**Files:**
- Create: `repos/sandbox/src/local/shims/querystring.ts`
- Modify: `repos/sandbox/src/local/shims/index.ts`

- [ ] **Step 1: Create querystring shim**

```typescript
// repos/sandbox/src/local/shims/querystring.ts
import type { ShimDefinition } from './types'

export const querystringShim: ShimDefinition = {
  names: [`querystring`, `node:querystring`],

  source: `
    function escape(str) {
      return encodeURIComponent(str)
    }

    function unescape(str) {
      return decodeURIComponent(str)
    }

    function parse(str, sep = '&', eq = '=') {
      if (!str || typeof str !== 'string') return {}
      const result = {}
      const pairs = str.split(sep)
      for (const pair of pairs) {
        const idx = pair.indexOf(eq)
        const key = idx >= 0 ? unescape(pair.slice(0, idx)) : unescape(pair)
        const val = idx >= 0 ? unescape(pair.slice(idx + eq.length)) : ''
        if (result[key] !== undefined) {
          if (Array.isArray(result[key])) result[key].push(val)
          else result[key] = [result[key], val]
        } else {
          result[key] = val
        }
      }
      return result
    }

    function stringify(obj, sep = '&', eq = '=') {
      if (!obj || typeof obj !== 'object') return ''
      const pairs = []
      for (const key of Object.keys(obj)) {
        const val = obj[key]
        if (Array.isArray(val)) {
          for (const v of val) pairs.push(escape(key) + eq + escape(String(v)))
        } else {
          pairs.push(escape(key) + eq + escape(String(val)))
        }
      }
      return pairs.join(sep)
    }

    export { parse, stringify, escape, unescape }
    export default { parse, stringify, escape, unescape }
  `,
}
```

- [ ] **Step 2: Add to registry, run tests and types**

Run: `cd repos/sandbox && pnpm test && pnpm types`
Expected: PASS. Update `mockCompileModule` count to 6.

---

### Task 11: Add `events` shim

**Files:**
- Create: `repos/sandbox/src/local/shims/events.ts`
- Modify: `repos/sandbox/src/local/shims/index.ts`

- [ ] **Step 1: Create events shim**

```typescript
// repos/sandbox/src/local/shims/events.ts
import type { ShimDefinition } from './types'

export const eventsShim: ShimDefinition = {
  names: [`events`, `node:events`],

  source: `
    class EventEmitter {
      #listeners = new Map()

      on(event, fn) {
        if (!this.#listeners.has(event)) this.#listeners.set(event, [])
        this.#listeners.get(event).push(fn)
        return this
      }

      off(event, fn) {
        return this.removeListener(event, fn)
      }

      once(event, fn) {
        const wrapped = (...args) => {
          this.removeListener(event, wrapped)
          fn.apply(this, args)
        }
        wrapped._original = fn
        return this.on(event, wrapped)
      }

      emit(event, ...args) {
        const fns = this.#listeners.get(event)
        if (!fns || fns.length === 0) return false
        for (const fn of [...fns]) fn.apply(this, args)
        return true
      }

      removeListener(event, fn) {
        const fns = this.#listeners.get(event)
        if (!fns) return this
        const idx = fns.findIndex(f => f === fn || f._original === fn)
        if (idx !== -1) fns.splice(idx, 1)
        if (fns.length === 0) this.#listeners.delete(event)
        return this
      }

      removeAllListeners(event) {
        if (event !== undefined) this.#listeners.delete(event)
        else this.#listeners.clear()
        return this
      }

      listenerCount(event) {
        return this.#listeners.get(event)?.length || 0
      }

      eventNames() {
        return [...this.#listeners.keys()]
      }

      listeners(event) {
        return [...(this.#listeners.get(event) || [])]
      }

      addListener(event, fn) {
        return this.on(event, fn)
      }
    }

    export { EventEmitter }
    export default EventEmitter
  `,
}
```

- [ ] **Step 2: Add to registry, run tests and types**

Run: `cd repos/sandbox && pnpm test && pnpm types`
Expected: PASS. Update `mockCompileModule` count to 7.

---

### Task 12: Add `os` shim

**Files:**
- Create: `repos/sandbox/src/local/shims/os.ts`
- Modify: `repos/sandbox/src/local/shims/index.ts`

- [ ] **Step 1: Create os shim**

```typescript
// repos/sandbox/src/local/shims/os.ts
import type { ShimDefinition } from './types'

export const osShim: ShimDefinition = {
  names: [`os`, `node:os`],

  source: `
    const platform = () => 'linux'
    const arch = () => 'x64'
    const type = () => 'Linux'
    const tmpdir = () => '/tmp'
    const homedir = () => '/home/sandbox'
    const hostname = () => 'sandbox'
    const endianness = () => 'LE'
    const EOL = '\\n'
    const cpus = () => [{ model: 'sandbox', speed: 0, times: { user: 0, nice: 0, sys: 0, idle: 0, irq: 0 } }]
    const freemem = () => 134217728
    const totalmem = () => 134217728
    const release = () => '0.0.0'
    const networkInterfaces = () => ({})
    const userInfo = () => ({ uid: 1000, gid: 1000, username: 'sandbox', homedir: '/home/sandbox', shell: '/bin/sh' })

    export { platform, arch, type, tmpdir, homedir, hostname, endianness, EOL, cpus, freemem, totalmem, release, networkInterfaces, userInfo }
    export default { platform, arch, type, tmpdir, homedir, hostname, endianness, EOL, cpus, freemem, totalmem, release, networkInterfaces, userInfo }
  `,
}
```

- [ ] **Step 2: Add to registry, run tests and types**

Run: `cd repos/sandbox && pnpm test && pnpm types`
Expected: PASS. Update `mockCompileModule` count to 8.

---

### Task 13: Add `assert` shim

**Files:**
- Create: `repos/sandbox/src/local/shims/assert.ts`
- Modify: `repos/sandbox/src/local/shims/index.ts`

- [ ] **Step 1: Create assert shim**

```typescript
// repos/sandbox/src/local/shims/assert.ts
import type { ShimDefinition } from './types'

export const assertShim: ShimDefinition = {
  names: [`assert`, `node:assert`],

  source: `
    class AssertionError extends Error {
      constructor(opts) {
        const msg = typeof opts === 'string' ? opts : (opts?.message || 'Assertion failed')
        super(msg)
        this.name = 'AssertionError'
        this.code = 'ERR_ASSERTION'
        if (typeof opts === 'object') {
          this.actual = opts.actual
          this.expected = opts.expected
          this.operator = opts.operator
        }
      }
    }

    function ok(value, message) {
      if (!value) throw new AssertionError({ message: message || 'Expected truthy value', actual: value, expected: true, operator: '==' })
    }

    function equal(actual, expected, message) {
      if (actual != expected) throw new AssertionError({ message: message || actual + ' == ' + expected, actual, expected, operator: '==' })
    }

    function notEqual(actual, expected, message) {
      if (actual == expected) throw new AssertionError({ message: message || actual + ' != ' + expected, actual, expected, operator: '!=' })
    }

    function strictEqual(actual, expected, message) {
      if (actual !== expected) throw new AssertionError({ message: message || actual + ' === ' + expected, actual, expected, operator: '===' })
    }

    function notStrictEqual(actual, expected, message) {
      if (actual === expected) throw new AssertionError({ message: message || actual + ' !== ' + expected, actual, expected, operator: '!==' })
    }

    function deepStrictEqual(actual, expected, message) {
      const a = JSON.stringify(actual)
      const b = JSON.stringify(expected)
      if (a !== b) throw new AssertionError({ message: message || 'deepStrictEqual', actual, expected, operator: 'deepStrictEqual' })
    }

    function throws(fn, message) {
      let threw = false
      try { fn() } catch { threw = true }
      if (!threw) throw new AssertionError({ message: message || 'Expected function to throw', operator: 'throws' })
    }

    function doesNotThrow(fn, message) {
      try { fn() } catch (err) {
        throw new AssertionError({ message: message || 'Expected function not to throw: ' + err.message, operator: 'doesNotThrow' })
      }
    }

    function fail(message) {
      throw new AssertionError({ message: message || 'Failed', operator: 'fail' })
    }

    export { AssertionError, ok, equal, notEqual, strictEqual, notStrictEqual, deepStrictEqual, throws, doesNotThrow, fail }
    export default ok
  `,
}
```

Note: `export default ok` matches Node.js behavior where `require('assert')` returns the `ok` function.

- [ ] **Step 2: Add to registry, run tests and types**

Run: `cd repos/sandbox && pnpm test && pnpm types`
Expected: PASS. Update `mockCompileModule` count to 9.

---

### Task 14: Add `util` shim

**Files:**
- Create: `repos/sandbox/src/local/shims/util.ts`
- Modify: `repos/sandbox/src/local/shims/index.ts`

- [ ] **Step 1: Create util shim**

```typescript
// repos/sandbox/src/local/shims/util.ts
import type { ShimDefinition } from './types'

export const utilShim: ShimDefinition = {
  names: [`util`, `node:util`],

  source: `
    function format(fmt, ...args) {
      if (typeof fmt !== 'string') return [fmt, ...args].map(String).join(' ')
      let i = 0
      return fmt.replace(/%[sdjo%]/g, (match) => {
        if (match === '%%') return '%'
        if (i >= args.length) return match
        const arg = args[i++]
        switch (match) {
          case '%s': return String(arg)
          case '%d': return Number(arg).toString()
          case '%j': try { return JSON.stringify(arg) } catch { return '[Circular]' }
          case '%o': try { return JSON.stringify(arg, null, 2) } catch { return '[Circular]' }
          default: return match
        }
      })
    }

    function inspect(obj, opts) {
      const seen = new WeakSet()
      const depth = opts?.depth ?? 2
      function _inspect(val, currentDepth) {
        if (val === null) return 'null'
        if (val === undefined) return 'undefined'
        if (typeof val === 'string') return "'" + val + "'"
        if (typeof val === 'number' || typeof val === 'boolean') return String(val)
        if (typeof val === 'function') return '[Function: ' + (val.name || 'anonymous') + ']'
        if (typeof val === 'symbol') return val.toString()
        if (val instanceof Date) return val.toISOString()
        if (val instanceof RegExp) return val.toString()
        if (Array.isArray(val)) {
          if (seen.has(val)) return '[Circular]'
          seen.add(val)
          if (currentDepth > depth) return '[Array]'
          return '[ ' + val.map(v => _inspect(v, currentDepth + 1)).join(', ') + ' ]'
        }
        if (typeof val === 'object') {
          if (seen.has(val)) return '[Circular]'
          seen.add(val)
          if (currentDepth > depth) return '[Object]'
          const entries = Object.entries(val).map(([k, v]) => k + ': ' + _inspect(v, currentDepth + 1))
          return '{ ' + entries.join(', ') + ' }'
        }
        return String(val)
      }
      return _inspect(obj, 0)
    }

    function promisify(fn) {
      return (...args) => new Promise((resolve, reject) => {
        fn(...args, (err, result) => {
          if (err) reject(err)
          else resolve(result)
        })
      })
    }

    const types = {
      isDate: (v) => v instanceof Date,
      isRegExp: (v) => v instanceof RegExp,
      isArray: (v) => Array.isArray(v),
      isPromise: (v) => v instanceof Promise,
      isMap: (v) => v instanceof Map,
      isSet: (v) => v instanceof Set,
    }

    function inherits(ctor, superCtor) {
      ctor.super_ = superCtor
      Object.setPrototypeOf(ctor.prototype, superCtor.prototype)
    }

    function deprecate(fn, msg) {
      let warned = false
      return function(...args) {
        if (!warned) {
          console.warn('DeprecationWarning:', msg)
          warned = true
        }
        return fn.apply(this, args)
      }
    }

    const TextEncoder = globalThis.TextEncoder
    const TextDecoder = globalThis.TextDecoder

    export { format, inspect, promisify, types, inherits, deprecate, TextEncoder, TextDecoder }
    export default { format, inspect, promisify, types, inherits, deprecate, TextEncoder, TextDecoder }
  `,
}
```

- [ ] **Step 2: Add to registry after assertShim (depends on buffer)**

- [ ] **Step 3: Run tests and types**

Run: `cd repos/sandbox && pnpm test && pnpm types`
Expected: PASS. Update `mockCompileModule` count to 10.

---

### Task 15: Update isolate.test.ts for new shim count

**Files:**
- Modify: `repos/sandbox/src/local/isolate.test.ts`

- [ ] **Step 1: Update compile module count assertion**

At line 165, change:
```typescript
expect(mockCompileModule).toHaveBeenCalledTimes(3)
```
to:
```typescript
expect(mockCompileModule).toHaveBeenCalledTimes(10)
```

(10 = buffer + path + fs + child_process + url + querystring + events + os + assert + util)

- [ ] **Step 2: Run tests**

Run: `cd repos/sandbox && pnpm test`
Expected: All tests pass

---

## Chunk 3: Host-bridged shims — crypto, timers, process

### Task 16: Add `crypto` shim

**Files:**
- Create: `repos/sandbox/src/local/shims/crypto.ts`
- Modify: `repos/sandbox/src/local/shims/index.ts`
- Modify: `repos/sandbox/src/local/isolate.test.ts`

- [ ] **Step 1: Create crypto shim**

```typescript
// repos/sandbox/src/local/shims/crypto.ts
import crypto from 'node:crypto'
import type { ShimDefinition } from './types'

export const cryptoShim: ShimDefinition = {
  names: [`crypto`, `node:crypto`],
  dependencies: [`buffer`],

  source: `
    const _randomUUID = globalThis._cryptoRandomUUID
    const _randomBytes = globalThis._cryptoRandomBytes
    const _hash = globalThis._cryptoHash
    const _hmac = globalThis._cryptoHmac
    const _timingSafeEqual = globalThis._cryptoTimingSafeEqual

    function randomUUID() {
      return _randomUUID()
    }

    function randomBytes(size) {
      const hex = _randomBytes(size)
      return globalThis.Buffer.from(hex, 'hex')
    }

    function createHash(algorithm) {
      let _data = ''
      return {
        update(data) {
          _data += (typeof data === 'string' ? data : data.toString())
          return this
        },
        digest(encoding = 'hex') {
          return _hash(algorithm, _data, encoding)
        },
      }
    }

    function createHmac(algorithm, key) {
      const _key = typeof key === 'string' ? key : key.toString()
      let _data = ''
      return {
        update(data) {
          _data += (typeof data === 'string' ? data : data.toString())
          return this
        },
        digest(encoding = 'hex') {
          return _hmac(algorithm, _key, _data, encoding)
        },
      }
    }

    function timingSafeEqual(a, b) {
      const aHex = typeof a === 'string' ? globalThis.Buffer.from(a).toString('hex') : a.toString('hex')
      const bHex = typeof b === 'string' ? globalThis.Buffer.from(b).toString('hex') : b.toString('hex')
      return _timingSafeEqual(aHex, bHex)
    }

    export { randomUUID, randomBytes, createHash, createHmac, timingSafeEqual }
    export default { randomUUID, randomBytes, createHash, createHmac, timingSafeEqual }
  `,

  setupCallbacks: async (jail, ivm) => {
    await jail.set(
      `_cryptoRandomUUID`,
      new ivm.Callback(() => crypto.randomUUID())
    )

    await jail.set(
      `_cryptoRandomBytes`,
      new ivm.Callback((size: number) => crypto.randomBytes(size).toString(`hex`))
    )

    await jail.set(
      `_cryptoHash`,
      new ivm.Callback(
        async (algorithm: string, data: string, encoding: string) => {
          return crypto.createHash(algorithm).update(data).digest(encoding as any)
        },
        { async: true }
      )
    )

    await jail.set(
      `_cryptoHmac`,
      new ivm.Callback(
        async (algorithm: string, key: string, data: string, encoding: string) => {
          return crypto.createHmac(algorithm, key).update(data).digest(encoding as any)
        },
        { async: true }
      )
    )

    await jail.set(
      `_cryptoTimingSafeEqual`,
      new ivm.Callback((a: string, b: string) => {
        const bufA = globalThis.Buffer.from(a, `hex`)
        const bufB = globalThis.Buffer.from(b, `hex`)
        if (bufA.length !== bufB.length) return false
        return crypto.timingSafeEqual(bufA, bufB)
      })
    )
  },
}
```

- [ ] **Step 2: Add to registry after utilShim**

- [ ] **Step 3: Update isolate.test.ts compile count to 11**

- [ ] **Step 4: Add test assertions for crypto callbacks**

```typescript
it(`should set up crypto callbacks`, async () => {
  await runner.init()
  const setCallArgs = mockSet.mock.calls.map((c: any) => c[0])
  expect(setCallArgs).toContain(`_cryptoRandomUUID`)
  expect(setCallArgs).toContain(`_cryptoRandomBytes`)
  expect(setCallArgs).toContain(`_cryptoHash`)
  expect(setCallArgs).toContain(`_cryptoHmac`)
  expect(setCallArgs).toContain(`_cryptoTimingSafeEqual`)
})
```

- [ ] **Step 5: Run tests and types**

Run: `cd repos/sandbox && pnpm test && pnpm types`
Expected: PASS

---

### Task 17: Add timer lifecycle to IsolateRunner

**Files:**
- Modify: `repos/sandbox/src/local/isolate.ts`
- Modify: `repos/sandbox/src/local/isolate.test.ts`

Timers are implemented directly in `IsolateRunner` (not through the shim registry) because they require bidirectional host-isolate communication: the host timer fires and needs to call back into the isolate context.

- [ ] **Step 1: Add timer private fields and cleanup method**

Add after `#maxTimerMs`:

```typescript
#pendingTimers = new Map<number, ReturnType<typeof setTimeout>>()
```

Add cleanup method:

```typescript
#clearAllTimers(): void {
  for (const timer of this.#pendingTimers.values()) {
    clearTimeout(timer)
  }
  this.#pendingTimers.clear()
}
```

- [ ] **Step 2: Add #setupTimers method**

```typescript
async #setupTimers(jail: any, ivm: any): Promise<void> {
  const maxMs = this.#maxTimerMs

  await jail.set(
    `_timerSet`,
    new ivm.Callback(
      (id: number, ms: number) => {
        const clampedMs = Math.min(Math.max(ms || 0, 0), maxMs)
        const timer = setTimeout(() => {
          this.#pendingTimers.delete(id)
          try {
            this.#context?.eval(`typeof __timerFire === 'function' && __timerFire(${id})`)
          } catch {}
        }, clampedMs)
        this.#pendingTimers.set(id, timer)
      }
    )
  )

  await jail.set(
    `_timerClear`,
    new ivm.Callback((id: number) => {
      const timer = this.#pendingTimers.get(id)
      if (timer) {
        clearTimeout(timer)
        this.#pendingTimers.delete(id)
      }
    })
  )

  await jail.set(
    `_timerInterval`,
    new ivm.Callback(
      (id: number, ms: number) => {
        const clampedMs = Math.min(Math.max(ms || 0, 0), maxMs)
        const timer = setInterval(() => {
          try {
            this.#context?.eval(`typeof __timerFire === 'function' && __timerFire(${id})`)
          } catch {}
        }, clampedMs)
        this.#pendingTimers.set(id, timer)
      }
    )
  )

  await this.#context!.eval(`
    ;(function() {
      const _cbs = new Map()
      let _nextId = 1
      const _MAX = 100

      globalThis.__timerFire = function(id) {
        const cb = _cbs.get(id)
        if (cb) {
          if (!cb.interval) _cbs.delete(id)
          try { cb.fn.apply(null, cb.args) } catch(e) { console.error(e) }
        }
      }

      globalThis.setTimeout = function(fn, ms, ...args) {
        if (_cbs.size >= _MAX) throw new Error('Too many concurrent timers (max ' + _MAX + ')')
        const id = _nextId++
        _cbs.set(id, { fn, args })
        _timerSet(id, ms || 0)
        return id
      }

      globalThis.clearTimeout = function(id) {
        _cbs.delete(id)
        _timerClear(id)
      }

      globalThis.setInterval = function(fn, ms, ...args) {
        if (_cbs.size >= _MAX) throw new Error('Too many concurrent timers (max ' + _MAX + ')')
        const id = _nextId++
        _cbs.set(id, { fn, args, interval: true })
        _timerInterval(id, ms || 0)
        return id
      }

      globalThis.clearInterval = function(id) {
        _cbs.delete(id)
        _timerClear(id)
      }

      globalThis.setImmediate = function(fn, ...args) {
        return globalThis.setTimeout(fn, 0, ...args)
      }

      globalThis.queueMicrotask = globalThis.queueMicrotask || function(fn) {
        Promise.resolve().then(fn)
      }
    })()
  `)
}
```

- [ ] **Step 3: Call #setupTimers in init()**

After `await this.#compile()` and before `this.#initialized = true`:

```typescript
await this.#setupTimers(jail, ivm)
```

- [ ] **Step 4: Add timer cleanup to eval() and dispose()**

In `eval()`, after `userModule.release()` and before the return:

```typescript
this.#clearAllTimers()
```

In `dispose()`, before clearing shims:

```typescript
this.#clearAllTimers()
```

- [ ] **Step 5: Add timer tests**

```typescript
it(`should set up timer callbacks`, async () => {
  await runner.init()
  const setCallArgs = mockSet.mock.calls.map((c: any) => c[0])
  expect(setCallArgs).toContain(`_timerSet`)
  expect(setCallArgs).toContain(`_timerClear`)
  expect(setCallArgs).toContain(`_timerInterval`)
})

it(`should set up timer globals via context eval`, async () => {
  await runner.init()
  const evalCalls = mockContextEval.mock.calls.map((c: any) => c[0])
  const timerEval = evalCalls.find((s: string) => s.includes('globalThis.setTimeout'))
  expect(timerEval).toBeDefined()
  expect(timerEval).toContain('globalThis.setInterval')
})
```

- [ ] **Step 6: Update context.eval count assertion**

Context.eval is now called for: console, fetch, timers = 3 calls (plus any from setupGlobals in registry, like process). Update assertion accordingly.

- [ ] **Step 7: Run tests and types**

Run: `cd repos/sandbox && pnpm test && pnpm types`
Expected: PASS

---

### Task 18: Add `process` global shim

**Files:**
- Create: `repos/sandbox/src/local/shims/process.ts`
- Modify: `repos/sandbox/src/local/shims/index.ts`
- Modify: `repos/sandbox/src/local/isolate.test.ts`

- [ ] **Step 1: Create process shim**

```typescript
// repos/sandbox/src/local/shims/process.ts
import type { ShimDefinition } from './types'

export const processShim: ShimDefinition = {
  names: [],  // globals-only -- not importable as a module

  setupGlobals: async (context, deps) => {
    const envJson = JSON.stringify(deps.env || {})

    await context.eval(`
      globalThis.process = {
        platform: 'linux',
        version: 'v20.0.0',
        arch: 'x64',
        pid: 1,
        env: ${envJson},
        cwd: () => '/workspace',
        exit: (code) => { throw new Error('process.exit(' + (code || 0) + ') is not allowed in sandbox') },
        stdout: { write: (d) => _log(d) },
        stderr: { write: (d) => _log('ERROR:', d) },
        nextTick: (fn, ...args) => Promise.resolve().then(() => fn(...args)),
        versions: { node: '20.0.0' },
        release: { name: 'node' },
        hrtime: {
          bigint: () => BigInt(0),
        },
      }
    `)
  },
}
```

- [ ] **Step 2: Add to registry at the end**

```typescript
import { processShim } from './process'

export const shimRegistry: ShimDefinition[] = [
  bufferShim, pathShim, fsShim, childProcessShim,
  urlShim, querystringShim, eventsShim, osShim,
  assertShim, utilShim, cryptoShim,
  processShim,  // globals-only
]
```

- [ ] **Step 3: Add test for process global**

```typescript
it(`should set up process global via context eval`, async () => {
  await runner.init()
  const evalCalls = mockContextEval.mock.calls.map((c: any) => c[0])
  const processEval = evalCalls.find((s: string) => s.includes('globalThis.process'))
  expect(processEval).toBeDefined()
})
```

- [ ] **Step 4: Run tests and types**

Run: `cd repos/sandbox && pnpm test && pnpm types`
Expected: PASS

---

### Task 19: Add env option test

**Files:**
- Modify: `repos/sandbox/src/local/isolate.test.ts`

- [ ] **Step 1: Add test verifying env flows to process.env**

```typescript
it(`should pass env option to process.env in context eval`, async () => {
  const envRunner = new IsolateRunner({
    bash: mockBash,
    fs: mockFs,
    env: { NODE_ENV: 'production', MY_VAR: 'hello' },
  })
  await envRunner.init()

  const evalCalls = mockContextEval.mock.calls.map((c: any) => c[0])
  const processEval = evalCalls.find((s: string) => s.includes('globalThis.process'))
  expect(processEval).toContain('"NODE_ENV"')
  expect(processEval).toContain('"production"')
  expect(processEval).toContain('"MY_VAR"')
  expect(processEval).toContain('"hello"')

  envRunner.dispose()
})
```

- [ ] **Step 2: Run tests**

Run: `cd repos/sandbox && pnpm test`
Expected: PASS

---

### Task 20: Final verification

**Files:**
- Modify: `repos/sandbox/src/local/isolate.test.ts`

- [ ] **Step 1: Verify final compile module count = 11**

11 modules with `source`: buffer, path, fs, child_process, url, querystring, events, os, assert, util, crypto. Process has no source (globals-only).

- [ ] **Step 2: Verify final context.eval count**

Context.eval calls: console (1) + fetch (1) + timers (1) + process setupGlobals (1) = 4 total. Update assertion from 2 to 4.

- [ ] **Step 3: Run full sandbox test suite**

Run: `cd repos/sandbox && pnpm test`
Expected: All tests pass

- [ ] **Step 4: Verify types across repos**

Run: `cd repos/sandbox && pnpm types`
Run: `cd repos/backend && pnpm types`
Expected: PASS (sandbox exports unchanged, only internals added)

---

## Summary

### Final shim registry order
1. `buffer` (no deps, pure JS)
2. `path` (no deps, pure JS)
3. `fs` (no deps, host-bridged)
4. `child_process` (no deps, host-bridged)
5. `url` (no deps, pure JS)
6. `querystring` (no deps, pure JS)
7. `events` (no deps, pure JS)
8. `os` (no deps, pure JS)
9. `assert` (no deps, pure JS)
10. `util` (depends on buffer, pure JS)
11. `crypto` (depends on buffer, host-bridged)
12. `process` (globals-only)

Timers: handled directly in `IsolateRunner` (bidirectional communication requirement)

### Builtin shim names (22 entries)
`buffer`, `node:buffer`, `path`, `node:path`, `fs`, `node:fs`, `child_process`, `node:child_process`, `url`, `node:url`, `querystring`, `node:querystring`, `events`, `node:events`, `os`, `node:os`, `assert`, `node:assert`, `util`, `node:util`, `crypto`, `node:crypto`
