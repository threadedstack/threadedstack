/**
 * StreamManager Usage Examples
 *
 * Demonstrates how to use StreamManager with just-bash for
 * integrating with xterm.js, WebSockets, and other stream consumers.
 */

import { Bash } from 'just-bash'
import { StreamManager } from '../io/StreamManager'

/**
 * Example 1: Basic stdout streaming
 */
async function basicExample() {
  const bash = new Bash({
    files: {
      '/hello.txt': 'Hello from just-bash!',
    },
  })

  const streamManager = new StreamManager(bash)

  // Read from stdout
  const reader = streamManager.stdout.getReader()

  // Execute command
  await streamManager.exec('cat /hello.txt')

  // Get output
  const result = await reader.read()
  console.log('Output:', result.value)

  reader.releaseLock()
  await streamManager.close()
}

/**
 * Example 2: Piping to xterm.js (adapter pattern)
 */
async function xtermExample() {
  const bash = new Bash()
  const streamManager = new StreamManager(bash)

  // Create xterm.js adapter (simplified for example)
  class XtermAdapter {
    writable: WritableStream<string>

    constructor() {
      this.writable = new WritableStream({
        write: (chunk) => {
          // In real code: this.terminal.write(chunk)
          console.log('[xterm.js]', chunk)
        },
      })
    }
  }

  const xtermAdapter = new XtermAdapter()

  // Pipe shell output to xterm
  streamManager.pipe(xtermAdapter.writable)

  // Execute commands
  await streamManager.exec('echo "Hello xterm!"')
  await streamManager.exec('ls -la')

  await streamManager.close()
}

/**
 * Example 3: WebSocket streaming
 */
async function websocketExample() {
  const bash = new Bash()
  const streamManager = new StreamManager(bash)

  // Create WebSocket adapter (simplified)
  class WebSocketAdapter {
    writable: WritableStream<string>

    constructor(ws: { send: (data: string) => void }) {
      this.writable = new WritableStream({
        write: (chunk) => {
          ws.send(JSON.stringify({ type: 'output', data: chunk }))
        },
      })
    }
  }

  // Simulate WebSocket
  const mockWs = {
    send: (data: string) => {
      console.log('[WebSocket send]', data)
    },
  }

  const wsAdapter = new WebSocketAdapter(mockWs)

  // Stream output over WebSocket
  streamManager.pipe(wsAdapter.writable)

  await streamManager.exec('whoami')

  await streamManager.close()
}

/**
 * Example 4: Multiple consumers with tee
 */
async function teeExample() {
  const bash = new Bash()
  const streamManager = new StreamManager(bash)

  // Split output to multiple consumers
  const [logBranch, displayBranch] = streamManager.teeStdout()

  // Consumer 1: Log to file (simulated)
  const logWriter = new WritableStream({
    write: (chunk) => {
      console.log('[LOG]', chunk)
    },
  })

  // Consumer 2: Display in UI (simulated)
  const displayWriter = new WritableStream({
    write: (chunk) => {
      console.log('[DISPLAY]', chunk)
    },
  })

  // Pipe to both consumers
  logBranch.pipeTo(logWriter)
  displayBranch.pipeTo(displayWriter)

  await streamManager.exec('echo "Multiple outputs"')

  await streamManager.close()
}

/**
 * Example 5: Combined stdout + stderr
 */
async function combinedOutputExample() {
  const bash = new Bash()
  const streamManager = new StreamManager(bash)

  const combined = streamManager.getCombinedOutput()
  const reader = combined.getReader()

  // Read in background
  const outputPromise = (async () => {
    const chunks: string[] = []
    while (true) {
      const result = await reader.read()
      if (result.done) break
      chunks.push(result.value)
    }
    return chunks.join('')
  })()

  // Execute commands that produce both stdout and stderr
  await streamManager.exec('echo "Normal output"')
  await streamManager.exec('cat /nonexistent 2>&1') // Will produce stderr

  await streamManager.close()

  const output = await outputPromise
  console.log('Combined output:', output)
}

/**
 * Example 6: Interactive shell with stdin
 */
async function interactiveExample() {
  const bash = new Bash()
  const streamManager = new StreamManager(bash)

  // Queue stdin commands
  const writer = streamManager.stdin.getWriter()
  await writer.write('echo "Command 1"\n')
  await writer.write('echo "Command 2"\n')
  writer.releaseLock()

  // Execute with stdin
  await streamManager.exec('bash')

  await streamManager.close()
}

/**
 * Example 7: Backpressure handling
 */
async function backpressureExample() {
  const bash = new Bash()
  const streamManager = new StreamManager(bash, {
    highWaterMark: 5, // Control backpressure threshold
  })

  // Slow consumer simulating network delay
  const slowConsumer = new WritableStream({
    async write(chunk) {
      // Simulate slow processing (e.g., network upload)
      await new Promise((resolve) => setTimeout(resolve, 100))
      console.log('[Slow consumer]', chunk.substring(0, 50))
    },
  })

  streamManager.pipe(slowConsumer)

  // Produce output faster than consumer can process
  for (let i = 0; i < 10; i++) {
    await streamManager.exec(`echo "Chunk ${i}"`)
  }

  console.log('Stdin queue size:', streamManager.getStdinQueueSize())

  await streamManager.close()
}

/**
 * Example 8: Real-world xterm.js integration
 */
async function realXtermExample() {
  // This would be used in a real browser/Electron app
  const bash = new Bash()
  const streamManager = new StreamManager(bash)

  /*
  // In browser code:
  import { Terminal } from '@xterm/xterm'

  const terminal = new Terminal({
    cursorBlink: true,
    theme: {
      background: '#1e1e1e',
    },
  })

  terminal.open(document.getElementById('terminal'))

  // Create WritableStream adapter for xterm
  const xtermWriter = new WritableStream({
    write: (chunk) => {
      terminal.write(chunk)
    },
  })

  // Pipe shell output to terminal
  streamManager.pipe(xtermWriter)

  // Handle terminal input
  terminal.onData(async (data) => {
    const writer = streamManager.stdin.getWriter()
    await writer.write(data)
    writer.releaseLock()

    // Execute on Enter
    if (data === '\r') {
      await streamManager.exec(currentCommand)
      currentCommand = ''
    } else {
      currentCommand += data
    }
  })
  */

  console.log('See inline comments for xterm.js integration')
  await streamManager.close()
}

// Run examples
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('\n=== Example 1: Basic stdout streaming ===')
  await basicExample()

  console.log('\n=== Example 2: xterm.js adapter ===')
  await xtermExample()

  console.log('\n=== Example 3: WebSocket streaming ===')
  await websocketExample()

  console.log('\n=== Example 4: Multiple consumers ===')
  await teeExample()

  console.log('\n=== Example 5: Combined output ===')
  await combinedOutputExample()

  console.log('\n=== Example 6: Interactive shell ===')
  await interactiveExample()

  console.log('\n=== Example 7: Backpressure handling ===')
  await backpressureExample()

  console.log('\n=== Example 8: Real xterm.js integration ===')
  await realXtermExample()
}
