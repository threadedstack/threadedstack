# Isolate Node.js Builtins Expansion

**Date**: 2026-04-01
**Scope**: `repos/sandbox/src/local/isolate.ts` + new `shims/` directory
**Goal**: Add standard Node.js builtin modules to the IsolateRunner so FaaS functions and npm dependencies can use common APIs

## Motivation

The IsolateRunner currently provides only 3 shim modules (`fs`, `path`, `child_process`) plus `console` and `fetch` globals. FaaS functions and npm dependencies expect standard Node.js APIs (`url`, `crypto`, `Buffer`, `setTimeout`, etc.). Without these, most real-world code fails on import.

The next step after this work is adding npm dependency installation for FaaS functions — many npm packages will fail without standard Node.js builtins available.

## Current State

### Existing builtins (3 shim modules + 2 globals)

| Module | APIs | Type |
|--------|------|------|
| `fs` / `node:fs` | readFile, writeFile, exists, mkdir, readdir, unlink, stat | Host-bridged (just-bash IFileSystem) |
| `path` / `node:path` | join, resolve, dirname, basename, extname, normalize, sep, posix | Pure JS |
| `child_process` / `node:child_process` | run (custom) | Host-bridged (just-bash Bash) |
| `console` (global) | log, error, warn, info | Host-bridged (_log callback) |
| `fetch` (global) | fetch(url, opts) -> Response-like | Host-bridged (native fetch) |

**Note on `child_process`**: The current shim exposes a custom `run()` API, not standard Node.js APIs. As part of this work, `child_process` will be updated to also export `execSync(cmd)` since this is commonly used by npm packages. All commands are routed through the just-bash virtual shell (sandboxed), so there is no real host shell injection risk. `spawn` is omitted (streaming subprocess is complex and rarely needed in FaaS). **Known limitation**: `execSync` actually returns a Promise (the host bridge is async). True synchronous execution is impossible in V8 isolates. Code must `await` the result.

## Design

### Architecture: Shim Registry

Extract shim definitions from inline strings in `isolate.ts` into a `shims/` directory. Each shim file exports a consistent shape:

```typescript
type ShimDefinition = {
  names: string[]                                              // e.g. ['fs', 'node:fs']
  source?: string                                              // ES module source compiled inside V8 (omit for globals-only shims)
  dependencies?: string[]                                      // other shim names this imports (for compilation order)
  setupCallbacks?: (jail: any, ivm: any, deps: any) => Promise<void>  // host callback registration on jail
  setupGlobals?: (context: any, opts: IsolateRunnerOptions) => Promise<void>  // globalThis setup via context eval
}
```

**Shim categories**:
- **Module shims** (`source` present): compiled as ES modules, importable via `import x from 'name'`
- **Global-only shims** (`source` omitted): set up globals via `setupGlobals`, no module compilation (e.g., `process`, `timers`)

#### Directory structure

```
repos/sandbox/src/local/
  isolate.ts                # IsolateRunner class (core orchestration)
  isolate.test.ts           # Core IsolateRunner tests
  shims/
    index.ts              # Registry: shim metadata, compilation order, host callback setup
    fs.ts                 # fs shim source + host callbacks
    path.ts               # path shim source (pure JS)
    childProcess.ts       # child_process shim source + host callback
    url.ts                # url shim source (pure JS)
    querystring.ts        # querystring shim source (pure JS)
    assert.ts             # assert shim source (pure JS)
    events.ts             # events shim source (pure JS)
    util.ts               # util shim source (pure JS)
    os.ts                 # os shim source (pure JS, sandboxed values)
    crypto.ts             # crypto shim source + host callbacks
    buffer.ts             # buffer shim source (pure JS, string-focused)
    process.ts            # process globals-only shim (setupGlobals, no host bridge)
```

Each shim file exports a `ShimDefinition`. The registry in `shims/index.ts` collects them in compilation order (dependencies first) and exposes them as an ordered array for `IsolateRunner.#compile()` to loop over.

#### IsolateRunner changes

- `#compile()` becomes a loop over the shim registry instead of inline source strings
- `init()` host callback setup extracted per-shim via `setupCallbacks` functions
- `#builtinNames` static set expanded to all 22 entries (11 modules x 2 names):
  `fs`, `node:fs`, `path`, `node:path`, `child_process`, `node:child_process`,
  `buffer`, `node:buffer`, `url`, `node:url`, `querystring`, `node:querystring`,
  `events`, `node:events`, `os`, `node:os`, `assert`, `node:assert`,
  `util`, `node:util`, `crypto`, `node:crypto`
  (timers and process are globals, not in shim map)
- `dispose()` adds timer cleanup (clear all pending host-side timers)
- Code evaluation adds post-run timer cleanup (auto-clear pending timers)
- Constructor accepts new `env` and `maxTimerMs` options

#### Options change

```typescript
type IsolateRunnerOptions = {
  bash: Bash
  fs: IFileSystem
  memory?: number
  env?: Record<string, string>   // NEW: allowlisted env vars for process.env
  maxTimerMs?: number             // NEW: max timer duration (default 30000)
}
```

### Compilation Order

Dependencies must be compiled before dependents:

```
 1. buffer        (no deps -- needed by crypto, util)
 2. path          (no deps)
 3. fs            (no deps, host-bridged)
 4. child_process (no deps, host-bridged)
 5. url           (no deps, uses V8 globals)
 6. querystring   (no deps)
 7. events        (no deps)
 8. os            (no deps)
 9. assert        (no deps)
10. util          (imports buffer)
11. crypto        (imports buffer)
```

Globals set via context evaluation (after shim compilation):

```
12. console       (existing)
13. fetch         (existing)
14. Buffer        (globalThis.Buffer = buffer default export)
15. process       (env allowlist from options)
16. timers        (setTimeout, setInterval, etc.)
```

---

## New Shims: Pure JS (no host bridge)

### `url` / `node:url`

Re-exports V8's built-in `URL` and `URLSearchParams` plus legacy compat:

- `URL` -- re-export from `globalThis.URL`
- `URLSearchParams` -- re-export from `globalThis.URLSearchParams`
- `parse(urlString)` -- legacy `url.parse()` implemented on top of `new URL()`
- `format(urlObject)` -- reconstructs URL string from parts
- `resolve(from, to)` -- basic URL resolution via `new URL(to, from)`

### `querystring` / `node:querystring`

- `parse(str, sep='&', eq='=')` -- splits `a=1&b=2` into `{a:'1', b:'2'}`
- `stringify(obj, sep='&', eq='=')` -- inverse
- `escape(str)` -- wraps `encodeURIComponent`
- `unescape(str)` -- wraps `decodeURIComponent`

### `assert` / `node:assert`

- `ok(value, message)` -- truthy check
- `equal(a, b)` / `notEqual(a, b)` -- loose equality (`==`)
- `strictEqual(a, b)` / `notStrictEqual(a, b)` -- strict equality (`===`)
- `deepStrictEqual(a, b)` -- recursive comparison via JSON roundtrip (known limitations: loses `undefined` values, `Date`/`RegExp`/`Set`/`Map` objects, functions, and circular references — acceptable for sandbox use)
- `throws(fn, message)` / `doesNotThrow(fn)`
- `fail(message)` -- always throws
- All throw `AssertionError` (custom Error subclass defined in the shim)

### `events` / `node:events`

- `EventEmitter` class: `on`, `off`, `once`, `emit`, `removeListener`, `removeAllListeners`, `listenerCount`, `eventNames`
- No `captureRejections`, no `maxListeners` warning
- Default export is the class itself (matches Node.js `require('events')`)

### `util` / `node:util`

**Dependency**: imports from `buffer` shim.

- `format(fmt, ...args)` -- `%s`, `%d`, `%j`, `%o` substitution
- `inspect(obj, opts)` -- JSON.stringify-based with circular ref handling
- `promisify(fn)` -- wraps callback-style `fn(args, cb)` into promise-returning
- `types.isDate`, `types.isRegExp`, `types.isArray`, `types.isPromise` -- instanceof checks
- `inherits(ctor, superCtor)` -- prototype chain setup (older npm packages)
- `deprecate(fn, msg)` -- returns wrapper that warns once then calls through
- `TextEncoder` / `TextDecoder` -- re-exported from `globalThis` (available in V8)

### `os` / `node:os`

All values are sandboxed/static -- not real host values:

- `platform()` -> `'linux'`
- `arch()` -> `'x64'`
- `type()` -> `'Linux'`
- `tmpdir()` -> `'/tmp'`
- `homedir()` -> `'/home/sandbox'`
- `hostname()` -> `'sandbox'`
- `EOL` -> `'\n'`
- `cpus()` -> `[{model:'sandbox', speed:0}]`
- `freemem()` / `totalmem()` -> returns the isolate's memory limit
- `endianness()` -> `'LE'`

### `buffer` / `node:buffer`

Pure JS implementation (no host bridge), string-focused rather than full binary:

**Internal storage**: JS `number[]` array (not Uint8Array -- can't cross isolate boundary efficiently).

- `Buffer.from(input, encoding)` -- supports string input with `utf8`, `base64`, `hex`, `ascii`
- `Buffer.alloc(size, fill)` -- zero-filled array
- `Buffer.isBuffer(obj)` -- instanceof check
- `Buffer.concat(list)` -- merges multiple Buffers
- `Buffer.byteLength(string, encoding)` -- returns byte count
- `buf.toString(encoding)` -- converts back to string (`utf8`, `base64`, `hex`, `ascii`)
- `buf.length` -- byte count getter
- `buf.slice(start, end)` -- returns new Buffer
- `buf.equals(other)` -- byte-by-byte comparison

Also exposed as `globalThis.Buffer` for unqualified usage.

**Decision: why not Uint8Array-backed?** Real `Buffer` extends `Uint8Array`, but binary data crossing the isolate host boundary requires base64 encoding/decoding for every callback (significant perf cost). String encoding/decoding covers 95%+ of npm Buffer usage. Can upgrade to Uint8Array-backed later if needed.

**`TextEncoder` / `TextDecoder`**: These are available as V8 globals inside `isolated-vm`. The `util` shim re-exports them (`util.TextEncoder`, `util.TextDecoder`) for packages that import from `util`, but they also work unqualified via `globalThis`.

---

## New Shims: Host-Bridged

### `crypto` / `node:crypto`

**Dependency**: imports from `buffer` shim.

Host callbacks bridged to Node.js `crypto` module:

| Callback | Host implementation |
|----------|-------------------|
| `_cryptoRandomUUID()` | `crypto.randomUUID()` |
| `_cryptoRandomBytes(size)` | `crypto.randomBytes(size).toString('hex')` |
| `_cryptoHash(algorithm, data, encoding)` | `crypto.createHash(algo).update(data).digest(encoding)` |
| `_cryptoHmac(algorithm, key, data, encoding)` | `crypto.createHmac(algo, key).update(data).digest(encoding)` |
| `_cryptoTimingSafeEqual(a, b)` | `crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'))` |

Shim-side API:

- `randomUUID()` -- calls `_cryptoRandomUUID`
- `randomBytes(size)` -- calls `_cryptoRandomBytes`, returns hex string converted to Buffer
- `createHash(algo)` -- returns chainable `{ update(data), digest(encoding) }` that calls `_cryptoHash` on `digest()`
- `createHmac(algo, key)` -- same chainable pattern, calls `_cryptoHmac`
- `timingSafeEqual(a, b)` -- converts shim Buffers to strings via `a.toString('hex')` before crossing isolate boundary, calls `_cryptoTimingSafeEqual` with the hex strings

**Host callback constraint**: All values crossing the isolate boundary via `ivm.Callback` must be serializable primitives (strings, numbers, booleans) or simple objects. No `Buffer` instances, no classes. This is why `randomBytes` returns a hex string and `timingSafeEqual` accepts hex strings — binary data is encoded as strings for the crossing.

**Decision: why subset only?** Full Node.js `crypto` has ~80+ methods. This subset (UUID, random, hash, HMAC, timing-safe compare) covers what 95% of npm packages actually use. Encrypt/decrypt (`createCipheriv`/`createDecipheriv`) omitted because the platform handles secrets server-side. Can be added later.

### `timers` (globals)

Host callbacks for real async scheduling:

| Callback | Purpose |
|----------|---------|
| `_timerSet(id, ms)` | Creates host-side `setTimeout`, calls back into isolate when fired |
| `_timerClear(id)` | Clears host-side timer (both timeout and interval) |
| `_timerInterval(id, ms)` | Creates host-side `setInterval`, calls back repeatedly |

Shim-side globals (set via context evaluation):

- `setTimeout(fn, ms, ...args)` -> registers callback, calls `_timerSet`
- `clearTimeout(id)` -> calls `_timerClear`
- `setInterval(fn, ms, ...args)` -> registers callback, calls `_timerInterval`
- `clearInterval(id)` -> calls `_timerClear`
- `setImmediate(fn, ...args)` -> `setTimeout(fn, 0)`
- `queueMicrotask(fn)` -> `Promise.resolve().then(fn)`

**Guard rails**:

| Guard | Default | Configurable |
|-------|---------|-------------|
| Max timer duration | 30s | `maxTimerMs` in options |
| Max concurrent timers | 100 | No (hard limit) |
| Auto-cleanup after code runs | Yes | No (always on) |
| setInterval auto-stop | After code run timeout | No |

**Decision: why real timers, not stubs?** Many npm packages legitimately use `setTimeout` for async patterns (debounce, retry, Promise timeouts). Stubbing (calling `fn` synchronously) causes subtle bugs. Real timers with guard rails are safer.

**Timer lifecycle within code execution**:

```
eval(code, timeout) called
  ├── Reset pendingTimers map
  ├── Compile + run user module
  │     └── User code may call setTimeout/setInterval
  │           └── Shim stores callback in isolate-side Map, calls _timerSet(id, ms)
  │                 └── Host creates real setTimeout/setInterval
  │                       └── When fired, host calls isolate Reference to trigger callback
  ├── After module.evaluate() resolves, check pendingTimers
  │     ├── If no pending timers → return immediately
  │     └── If pending timers → await a drain Promise that resolves when all
  │           setTimeout callbacks have fired (up to eval timeout)
  ├── On eval timeout expiry → clearAll() all pending host timers, resolve drain
  └── Return { output, result }
```

**Key mechanism**: Callbacks are stored in an isolate-side Map keyed by timer ID. When the host-side timer fires, it calls `context.eval('__timerFire(' + id + ')')` to invoke the stored callback inside the isolate. This is simpler than using `ivm.Reference` and works because `context.eval()` can be called from the host at any time as long as the isolate/context are still alive. The `__timerFire` global function is set up during isolate initialization.

**Implementation note**: Timers are implemented directly in `IsolateRunner` (not through the shim registry) because they require bidirectional host-isolate communication and access to the context reference, which other shims don't need.

**`setInterval` auto-stop**: All intervals are tracked in the same `pendingTimers` map. When `eval()` hits its timeout (the `timeout` param, default 5000ms), ALL pending timers (both timeouts and intervals) are cleared via `clearTimeout`/`clearInterval` on the host side. This means intervals run for at most the duration of the eval timeout.

**Cleanup on dispose**: `dispose()` calls `clearAll()` to clear any host-side timers that may still be pending, preventing callbacks into a released isolate.

### `process` (global)

Set via context evaluation, not a module import:

- `process.platform` -> `'linux'`
- `process.version` -> `'v20.0.0'`
- `process.arch` -> `'x64'`
- `process.pid` -> `1`
- `process.cwd()` -> `'/workspace'`
- `process.env` -> populated from `IsolateRunnerOptions.env` (configurable allowlist)
- `process.exit()` -> throws `Error('process.exit() is not allowed in sandbox')`
- `process.stdout.write(data)` / `process.stderr.write(data)` -> routes to `_log` callback
- `process.nextTick(fn)` -> `queueMicrotask(fn)`

**Decision: why env allowlist?** `process.env` is security-sensitive (could leak secrets). The FaaS creator sets which env vars exist via admin UI. Backend resolves them (including decrypted secrets) and passes them into `TSandboxConfig.envVars`, which flows through to `IsolateRunnerOptions.env`. Everything not in the allowlist returns `undefined`.

---

## Integration Points

### LocalSandboxProvider (`src/local/local.ts`)

**Change required**: Currently line 176 constructs `IsolateRunner` with `{ memory, bash, fs }` only — `env` is NOT passed. The `config.envVars` is currently passed to `Bash` (line 167) but not to `IsolateRunner`. This must be updated:

```typescript
// Before:
runner = new IsolateRunner({ memory, bash, fs })

// After:
runner = new IsolateRunner({
  memory,
  bash,
  fs,
  env: config.envVars || {},
  maxTimerMs: (config.options?.maxTimerMs as number) || undefined,
})
```

This wires `config.envVars` to `process.env` inside the isolate and `config.options.maxTimerMs` to the timer guard rail.

### Domain (`@tdsk/domain`)

- `TSandboxConfig.envVars` already exists (used by E2B provider) -- no schema change needed
- `IsolateRunnerOptions` is local to sandbox repo, not exported from domain

### Backend FaaS

- Backend already resolves env vars from function config and passes to sandbox
- Wiring `envVars` into the local sandbox config may need verification (currently may only flow to E2B)

---

## Testing Strategy

### Per-shim unit tests

Each shim gets its own test file verifying:
- Source string compiles without syntax errors
- Host callbacks are registered with correct names
- Shim API matches the documented surface
- Dependencies are declared correctly

Location: `repos/sandbox/src/local/shims/__tests__/`

### IsolateRunner integration tests

Update `repos/sandbox/src/local/isolate.test.ts`:
- Verify new shim count (11 modules compiled)
- Verify `#builtinNames` includes all new names
- Verify new host callbacks are registered (`_cryptoHash`, `_timerSet`, etc.)
- Verify `process` and `Buffer` globals are set up
- Verify timer cleanup on code run completion
- Verify timer cleanup on dispose

### Existing tests

- Existing tests should continue to pass unchanged
- The refactor to shims directory is structural only -- same behavior

---

## Future Expansion Notes

These decisions were made for the initial implementation. Document here for future reference:

| Decision | Current | Future option |
|----------|---------|--------------|
| Buffer backing | JS number[] array, string-focused | Uint8Array-backed for true binary support |
| Crypto scope | randomUUID, randomBytes, hash, HMAC, timingSafeEqual | Add createCipheriv/createDecipheriv for AES |
| Crypto API style | Node.js crypto module | Web Crypto API (globalThis.crypto.subtle) |
| Timer limits | 30s max, 100 concurrent | Configurable concurrent limit |
| process.env | Allowlist from options | Dynamic env var injection mid-execution |
| Streams | Not included | Add stream/node:stream for piping support |
| zlib | Not included | Add for gzip/deflate if npm packages need it |
| string_decoder | Not included | Add if streaming text decoding needed |
| Worker threads | Not included | Add if parallel execution needed |
| child_process execSync | Returns Promise (async bridge) | True sync impossible in V8 isolates; could add sync fallback via SharedArrayBuffer+Atomics if needed |
| Timers implementation | Inline in IsolateRunner (not in shim registry) | Could be moved to registry if ShimDefinition gains context access |

---

## Future: Dynamic NPM Dependency Loading

The next major capability is installing npm dependencies dynamically by fetching ESM bundles from an npm CDN and injecting them into the isolate via `registerModule()`. The current architecture supports the basic building blocks (`registerModule`, `TSandboxEvalOpts.modules`, `releaseUserModules`, `fetch` shim) but has gaps that need to be addressed.

### CDN Research: esm.sh vs unpkg.com

Two CDN candidates were evaluated for serving npm packages as ES modules to the V8 isolate sandbox.

#### esm.sh

- **Format**: Always ES modules. Automatically converts CJS packages to ESM via esbuild.
- **Bundling**: Multiple modes:
  - Default: bundles sub-modules within a package, cross-package imports become separate esm.sh URLs
  - `?bundle`: more aggressive inlining of sub-modules
  - `?standalone`: bundles the module AND all non-peer dependencies into a **single self-contained file** (zero external imports)
- **Transitive deps**: Handled automatically. Default mode rewrites imports to versioned esm.sh URLs. `?standalone` inlines everything.
- **Node.js builtins**: Polyfills by default. `?external=node:fs,node:path,...` keeps import specifiers intact so the sandbox's own shims can handle them. `*` prefix (`https://esm.sh/*pkg`) marks ALL deps as external.
- **Subpath imports**: Full support (`https://esm.sh/lodash/get` works and returns bundled ESM).
- **CJS handling**: Automatic CJS-to-ESM conversion. No consumer-side work needed.
- **TypeScript types**: Auto-served via `X-TypeScript-Types` response header.
- **Caching**: Cloudflare CDN. Versioned URLs: `max-age=31536000, immutable` (1 year). Unversioned: 15 min.
- **Failure mode**: Packages that deeply depend on Node.js-only APIs (e.g., `fs-extra` needing `graceful-fs`) return HTTP 500, which is a natural guardrail for the sandbox.
- **Key query params**: `?standalone`, `?bundle`, `?external=...`, `?target=es2022`, `?deps=pkg@ver`, `?alias=old:new`, `?no-dts`

#### unpkg.com

- **Format**: Serves raw files as published to npm. Format depends on what the package author published (CJS, UMD, or ESM). No conversion.
- **Bundling**: None. Raw file mirror.
- **Transitive deps**: NOT resolved. Intra-package relative imports work (as file fetches), but cross-package deps require manual resolution.
- **Node.js builtins**: No handling. `require('fs')` or `import fs from 'node:fs'` served as-is.
- **Subpath imports**: Raw file access only (`unpkg.com/lodash-es/get.js`). May contain relative imports requiring cascading fetches.
- **CJS handling**: None. CJS packages served as-is and will fail in `compileModule()`.
- **TypeScript types**: No special support.
- **Caching**: Cloudflare Workers. Versioned: 1 year. Unversioned: 1-5 min.
- **Key query params**: `?meta` (JSON metadata), `?module` (older ESM hint, unreliable)

#### Comparison

| Criterion | esm.sh | unpkg.com |
|---|---|---|
| Output format | Always ESM (auto-converts CJS) | Whatever the package published |
| CJS-to-ESM conversion | Automatic | None |
| Single-URL fetch | `?standalone` inlines all deps | Only if package ships single-file bundle |
| Transitive dep resolution | Automatic | None (manual resolution needed) |
| Node.js builtin control | `?external` to use sandbox shims | No handling |
| Subpath imports | Full support with bundling | Raw file access (may cascade) |
| Build tools needed | No | Yes (import maps, dep graph walking) |

#### Decision: **esm.sh**

esm.sh is the clear choice for the sandbox. Key reasons:

1. **Always-ESM output** -- every package is valid ES module syntax, exactly what `compileModule()` requires. unpkg serves CJS/UMD that would fail.
2. **`?standalone` mode** -- single fetch returns a self-contained ESM bundle with zero external imports. Maps perfectly to "fetch and register with `registerModule()`". No cascading fetches, no import maps, no dependency graph walking.
3. **Node.js builtin control** -- `?external=node:fs,node:path,...` keeps import specifiers intact so the sandbox's existing shim registry resolves them.
4. **Natural sandbox guardrail** -- packages deeply dependent on Node.js internals fail at build time (HTTP 500) rather than silently breaking at runtime.
5. **CJS-to-ESM automatic** -- eliminates Gap 2 entirely. No `require()` shim needed for the common case.

**Recommended URL patterns**:

```
# Pure-JS packages (most common case -- single self-contained file):
https://esm.sh/{pkg}@{ver}?standalone&target=es2022

# Packages that need the sandbox's Node.js shims:
https://esm.sh/{pkg}@{ver}?bundle&target=es2022&external=node:fs,node:path,node:crypto,node:buffer,node:events,node:os,node:process,node:url,node:querystring,node:util,node:assert,node:child_process

# Subpath imports:
https://esm.sh/{pkg}@{ver}/{subpath}?standalone&target=es2022
```

`target=es2022` matches the V8 version in `isolated-vm` and avoids unnecessary syntax polyfills.

### Architecture gaps for npm loading

#### Gap 1: Module resolver is flat — no subpath/relative import support

**Current**: All 3 resolver sites (`#compile`, `registerModule`, `eval`) use exact string matching: `this.#shims.get(specifier)`. Only bare-name imports work (`import fs from 'fs'`).

**Problem**: Even with esm.sh's `?standalone` mode, some packages produce imports to other esm.sh URLs (cross-package deps in non-standalone mode) or relative paths. When a module imports `./utils`, the resolver receives `'./utils'` and fails because that exact string isn't in the shims map.

**Impact with esm.sh**: Significantly reduced compared to unpkg. `?standalone` eliminates most cases. But `?bundle` mode (needed when packages use sandbox Node shims) may still produce relative imports within the bundle. The resolver upgrade is still needed as a safety net.

**Needed**: A resolver function that handles:
- **Relative imports** resolved against the importing module's filename: `./foo` from `lodash/index.js` resolves to `lodash/foo`
- **Subpath imports**: `lodash/get` looks up `lodash/get` in the shims map
- **Bare specifier fallback**: unknown bare names fall through to builtin shims

**Key constraint**: `isolated-vm`'s `Module.instantiate()` resolver receives only the specifier string, not the referrer module. However, the `filename` passed to `compileModule()` establishes the module's identity. The resolver can capture the referrer context via closure at instantiation time:

```typescript
await mod.instantiate(this.#context, (specifier: string) => {
  // 1. Try exact match first (builtins, already-registered packages)
  const exact = this.#shims.get(specifier)
  if (exact) return exact

  // 2. Resolve relative imports against this module's filename
  if (specifier.startsWith('./') || specifier.startsWith('../')) {
    const resolved = resolvePath(moduleBasePath, specifier)
    const dep = this.#shims.get(resolved)
    if (dep) return dep
  }

  throw new Error(`Module not found: ${specifier}`)
})
```

#### Gap 2: No `require()` — CommonJS packages won't work

**Mitigated by esm.sh**: esm.sh automatically converts CJS to ESM, so this gap is largely eliminated for the common case. Only relevant if:
- A package is fetched from a non-esm.sh source
- A package dynamically calls `require()` at runtime (not statically analyzable by esm.sh's esbuild transform)

**If needed later**: Add a `require()` global shim that looks up the `#shims` map synchronously. New shim file in `shims/` directory.

#### Gap 3: No on-demand module fetching from the resolver

**Current**: Unknown imports throw `Module not found` immediately.

**Key constraint**: `isolated-vm`'s `Module.instantiate()` resolver is **synchronous** — it cannot `await` a fetch. All dependencies must be pre-fetched and pre-registered before `eval()` is called.

**Approach**: npm loading happens at the `LocalSandbox` level (or a new `installPackages()` method), NOT in the resolver:

```
1. User specifies dependencies (in function config or TSandboxEvalOpts)
2. Host-side: fetch packages from esm.sh (?standalone for each)
3. Host-side: registerModule() for each fetched module
4. Then: eval() user code (resolver finds everything in #shims)
```

**New API surface** (suggested):

```typescript
// On ISandbox or IsolateRunner:
async installPackages(packages: string[]): Promise<void>
// e.g., await sandbox.installPackages(['lodash@4.17.21', 'dayjs'])
// Fetches from esm.sh with ?standalone, registers all modules
```

**With esm.sh `?standalone`**, this becomes trivially simple per package:

```typescript
async installPackages(packages: string[]) {
  for (const pkg of packages) {
    const url = `https://esm.sh/${pkg}?standalone&target=es2022`
    const response = await fetch(url)
    const code = await response.text()
    const name = pkg.split('@')[0]  // 'lodash@4.17.21' -> 'lodash'
    await this.registerModule(name, code)
  }
}
```

#### Gap 4: Package resolution (entry points, transitive deps)

**Largely eliminated by esm.sh**: The `?standalone` param handles entry point resolution, transitive dependency bundling, and CJS conversion server-side. The sandbox doesn't need to parse `package.json`, walk dependency trees, or resolve entry points.

**Remaining concern**: Packages with peer dependencies (e.g., React plugins that expect `react` to be available) are NOT inlined by `?standalone`. These require the peer to be installed separately. The `installPackages()` method should accept an array and install peers alongside their dependents.

### Existing infrastructure that supports this

| What | Status | How it helps |
|------|--------|-------------|
| `registerModule(name, code)` | Ready | Registers fetched packages as importable modules |
| `TSandboxEvalOpts.modules` | Ready | Caller can provide pre-fetched module source |
| `releaseUserModules()` | Ready | Cleans up npm packages on sandbox pool reset |
| `builtinShimNames` | Ready | Prevents npm packages from overwriting Node.js builtins |
| `fetch` shim (host-bridged) | Ready | Host-side esm.sh fetching |
| `Buffer` shim | Ready | Handles binary/encoded package data |
| Shim registry pattern | Ready | New resolver logic follows the same extensible pattern |

### Suggested implementation order

1. **Upgrade the resolver** -- add relative/subpath import resolution (Gap 1). Prerequisite for non-standalone packages. Only touches `isolate.ts`.
2. **Add `installPackages()` method** -- host-side esm.sh fetching with `?standalone` + `registerModule()` loop (Gaps 3 & 4). New file, minimal existing code changes.
3. **CJS `require()` shim** -- only if needed after testing real packages with esm.sh (Gap 2). New shim file in `shims/` directory.
