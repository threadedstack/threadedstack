// shim for using process in browser with a few modifications
// based off https://github.com/defunctzombie/node-process/blob/master/browser.js
import { getEnvironment, getArguments, initialCwd } from 'wasi:cli/environment@0.2.0'

function defaultSetTimout() {
  throw new Error('setTimeout has not been defined')
}
function defaultClearTimeout() {
  throw new Error('clearTimeout has not been defined')
}
var cachedSetTimeout = defaultSetTimout
var cachedClearTimeout = defaultClearTimeout
if (typeof globalThis.setTimeout === 'function') cachedSetTimeout = setTimeout
if (typeof globalThis.clearTimeout === 'function') cachedClearTimeout = clearTimeout

function runTimeout(fun) {
  if (cachedSetTimeout === setTimeout) {
    //normal enviroments in sane situations
    return setTimeout(fun, 0)
  }
  // if setTimeout wasn't available but was latter defined
  if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
    cachedSetTimeout = setTimeout
    return setTimeout(fun, 0)
  }
  try {
    // when when somebody has screwed with setTimeout but no I.E. maddness
    return cachedSetTimeout(fun, 0)
  } catch (e) {
    try {
      // When we are in I.E. but the script has been evaled so I.E. doesn't trust the global object when called normally
      return cachedSetTimeout.call(null, fun, 0)
    } catch (e) {
      // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error
      return cachedSetTimeout.call(this, fun, 0)
    }
  }
}
function runClearTimeout(marker) {
  if (cachedClearTimeout === clearTimeout) {
    //normal enviroments in sane situations
    return clearTimeout(marker)
  }
  // if clearTimeout wasn't available but was latter defined
  if (
    (cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) &&
    clearTimeout
  ) {
    cachedClearTimeout = clearTimeout
    return clearTimeout(marker)
  }
  try {
    // when when somebody has screwed with setTimeout but no I.E. maddness
    return cachedClearTimeout(marker)
  } catch (e) {
    try {
      // When we are in I.E. but the script has been evaled so I.E. doesn't  trust the global object when called normally
      return cachedClearTimeout.call(null, marker)
    } catch (e) {
      // same as above but when it's a version of I.E. that must have the global object for 'this', hopfully our context correct otherwise it will throw a global error.
      // Some versions of I.E. have different rules for clearTimeout vs setTimeout
      return cachedClearTimeout.call(this, marker)
    }
  }
}
var queue = []
var draining = false
var currentQueue
var queueIndex = -1

function cleanUpNextTick() {
  if (!draining || !currentQueue) {
    return
  }
  draining = false
  if (currentQueue.length) {
    queue = currentQueue.concat(queue)
  } else {
    queueIndex = -1
  }
  if (queue.length) {
    drainQueue()
  }
}

function drainQueue() {
  if (draining) {
    return
  }
  var timeout = runTimeout(cleanUpNextTick)
  draining = true

  var len = queue.length
  while (len) {
    currentQueue = queue
    queue = []
    while (++queueIndex < len) {
      if (currentQueue) {
        currentQueue[queueIndex].run()
      }
    }
    queueIndex = -1
    len = queue.length
  }
  currentQueue = null
  draining = false
  runClearTimeout(timeout)
}
function nextTick(fun) {
  var args = new Array(arguments.length - 1)
  if (arguments.length > 1) {
    for (var i = 1; i < arguments.length; i++) {
      args[i - 1] = arguments[i]
    }
  }
  queue.push(new Item(fun, args))
  if (queue.length === 1 && !draining) {
    runTimeout(drainQueue)
  }
}
// v8 likes predictible objects
function Item(fun, array) {
  this.fun = fun
  this.array = array
}
Item.prototype.run = function () {
  this.fun.apply(null, this.array)
}
var config = {}
var release = {}
var versions = {}
var title = 'wasm'
var browser = true
var platform = 'wasm'
var version = '' // empty string to avoid regexp issues

function noop() {}

var on = noop
var addListener = noop
var once = noop
var off = noop
var removeListener = noop
var removeAllListeners = noop
var emit = noop

const binding = (name) => {
  throw new Error('process.binding is not supported')
}

let cwdCache = `/`
let cwdInit = false
const cwd = () => {
  if (!cwdInit) cwdCache = initialCwd()
  return cwdCache
}

const chdir = (dir) => {
  //throw new Error('process.chdir is not supported')
  cwdCache = `${cwdCache}/${dir.replace(/^\//, ``)}`
}
const umask = () => {
  return 0
}

// from https://github.com/kumavis/browser-process-hrtime/blob/master/index.js
var performance = globalThis.performance || {}
var performanceNow =
  performance.now ||
  performance.mozNow ||
  performance.msNow ||
  performance.oNow ||
  performance.webkitNow ||
  (() => new Date().getTime())

// generate timestamp or delta
// see http://nodejs.org/api/process.html#process_process_hrtime
const hrtime = (previousTimestamp) => {
  const clocktime = performanceNow.call(performance) * 1e-3
  let seconds = Math.floor(clocktime)
  let nanoseconds = Math.floor((clocktime % 1) * 1e9)
  if (previousTimestamp) {
    seconds = seconds - previousTimestamp[0]
    nanoseconds = nanoseconds - previousTimestamp[1]
    if (nanoseconds < 0) {
      seconds--
      nanoseconds += 1e9
    }
  }
  return [seconds, nanoseconds]
}

const startTime = new Date()
const uptime = () => {
  const currentTime = new Date()
  const dif = currentTime - startTime
  return dif / 1000
}

const env = {}
let _evnset = false

const envHandler = {
  get(target, prop) {
    if (!_evnset) {
      _evnset = true
      const data = getEnvironment()
      for (const [k, v] of data) target[k] = v
    }
    return target[prop]
  },
  set(target, prop, value) {
    target[prop] = `${value}`
    return true
  },
}

const envProxy = new Proxy(env, envHandler)

const processBase = {
  nextTick,
  title,
  browser,
  argv: [],
  env: envProxy,
  version: version,
  versions: versions,
  on: on,
  addListener: addListener,
  once: once,
  off: off,
  removeListener: removeListener,
  removeAllListeners: removeAllListeners,
  emit: emit,
  binding: binding,
  cwd: cwd,
  chdir: chdir,
  umask: umask,
  hrtime: hrtime,
  platform: platform,
  release: release,
  config: config,
  uptime: uptime,
}

let argvset = false
const processHandler = {
  get(target, prop) {
    if (prop === `argv`) {
      if (!argvset) {
        argvset = true
        target[prop] = getArguments()
      }
    }
    if (prop === `env`) {
      if (!_evnset) {
        _evnset = true
        const data = getEnvironment()
        for (const [k, v] of data) env[k] = v
      }
    }

    return target[prop]
  },
  set(target, prop, value) {
    target[prop] = value
    return true
  },
}

export const process = new Proxy(processBase, processHandler)

// replace process.env.VAR with define
const defines = {}
Object.keys(defines).forEach((key) => {
  const segs = key.split('.')
  let target = process
  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i]
    if (i === segs.length - 1) {
      target[seg] = defines[key]
    } else {
      target = target[seg] || (target[seg] = {})
    }
  }
})

// Set globalThis.process instead of using ES module exports
// This avoids the "import_process2.default.env" issue
globalThis.process = process

// <---REMOVE ME ---->
/**
 * The `<---REMOVE ME ---->` is used to split the file and remove the export default
 * If that line is changed, you must also change the code in ../banner.ts
 */
export default process
