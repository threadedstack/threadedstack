# StreamManager Documentation

## Overview

`StreamManager` is a WHATWG Streams wrapper for just-bash I/O, providing:

- **ReadableStream** for stdout/stderr
- **WritableStream** for stdin
- **Proper backpressure** handling
- **Text and binary modes** support
- **External consumer piping** (xterm.js, WebSockets, etc.)

## Installation

```typescript
import { StreamManager } from '@tdsk/shell'
import { Bash } from 'just-bash'
```

## Basic Usage

```typescript
const bash = new Bash()
const streamManager = new StreamManager(bash)

// Read from stdout
const reader = streamManager.stdout.getReader()
await streamManager.exec('echo "Hello World"')

const result = await reader.read()
console.log(result.value) // "Hello World\n"

reader.releaseLock()
await streamManager.close()
```

## API Reference

### Constructor

```typescript
new StreamManager(bash: Bash, options?: StreamManagerOptions)
```

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `mode` | `'text' \| 'binary'` | `'text'` | Stream mode for data transmission |
| `highWaterMark` | `number` | `1` | Backpressure threshold (chunks) |
| `encoding` | `BufferEncoding` | `'utf-8'` | Text encoding |

### Properties

#### `stdin: WritableStream<string>`

Writable stream for sending input to shell.

```typescript
const writer = streamManager.stdin.getWriter()
await writer.write('ls -la\n')
writer.releaseLock()
```

#### `stdout: ReadableStream<string>`

Readable stream for shell standard output.

```typescript
const reader = streamManager.stdout.getReader()
const { value, done } = await reader.read()
reader.releaseLock()
```

#### `stderr: ReadableStream<string>`

Readable stream for shell standard error.

```typescript
const errorReader = streamManager.stderr.getReader()
const { value } = await errorReader.read()
errorReader.releaseLock()
```

### Methods

#### `exec(command: string): Promise<void>`

Execute a command and stream its output.

```typescript
await streamManager.exec('ls -la')
```

#### `pipe(target: WritableStream<string>): Promise<void>`

Pipe stdout to an external WritableStream.

```typescript
const fileWriter = new WritableStream({
  write: (chunk) => fs.appendFile('output.log', chunk)
})

await streamManager.pipe(fileWriter)
```

#### `pipeStderr(target: WritableStream<string>): Promise<void>`

Pipe stderr to an external WritableStream.

```typescript
const errorWriter = new WritableStream({
  write: (chunk) => console.error(chunk)
})

await streamManager.pipeStderr(errorWriter)
```

#### `teeStdout(): [ReadableStream<string>, ReadableStream<string>]`

Create two independent branches of stdout for multiple consumers.

```typescript
const [logBranch, displayBranch] = streamManager.teeStdout()

logBranch.pipeTo(logWriter)
displayBranch.pipeTo(displayWriter)
```

#### `getCombinedOutput(): ReadableStream<string>`

Get a merged stream of stdout and stderr.

```typescript
const combined = streamManager.getCombinedOutput()
const reader = combined.getReader()
```

#### `close(): Promise<void>`

Close all streams gracefully.

```typescript
await streamManager.close()
```

#### `isHealthy(): boolean`

Check if all streams are operational.

```typescript
if (streamManager.isHealthy()) {
  // Streams are ready
}
```

#### `getStdinQueueSize(): number`

Get current stdin queue size (useful for monitoring backpressure).

```typescript
const queueSize = streamManager.getStdinQueueSize()
```

## Common Patterns

### Pattern 1: xterm.js Integration

```typescript
import { Terminal } from '@xterm/xterm'
import { Bash } from 'just-bash'
import { StreamManager } from '@tdsk/shell'

// Initialize
const bash = new Bash()
const streamManager = new StreamManager(bash)
const terminal = new Terminal()

terminal.open(document.getElementById('terminal'))

// Create xterm adapter
const xtermWriter = new WritableStream({
  write: (chunk) => terminal.write(chunk)
})

// Pipe shell output to terminal
streamManager.pipe(xtermWriter)

// Handle terminal input
let currentCommand = ''
terminal.onData(async (data) => {
  const writer = streamManager.stdin.getWriter()

  if (data === '\r') {
    await writer.write('\n')
    await streamManager.exec(currentCommand)
    currentCommand = ''
  } else if (data === '\x7F') { // Backspace
    if (currentCommand.length > 0) {
      currentCommand = currentCommand.slice(0, -1)
      terminal.write('\b \b')
    }
  } else {
    currentCommand += data
    await writer.write(data)
  }

  writer.releaseLock()
})
```

### Pattern 2: WebSocket Streaming

```typescript
import WebSocket from 'ws'
import { Bash } from 'just-bash'
import { StreamManager } from '@tdsk/shell'

const wss = new WebSocket.Server({ port: 8080 })

wss.on('connection', (ws) => {
  const bash = new Bash()
  const streamManager = new StreamManager(bash)

  // Create WebSocket writer
  const wsWriter = new WritableStream({
    write: (chunk) => {
      ws.send(JSON.stringify({
        type: 'output',
        data: chunk
      }))
    }
  })

  // Pipe output to WebSocket
  streamManager.pipe(wsWriter)

  // Handle incoming commands
  ws.on('message', async (message) => {
    const { command } = JSON.parse(message.toString())
    await streamManager.exec(command)
  })

  ws.on('close', () => {
    streamManager.close()
  })
})
```

### Pattern 3: File Logging with Display

```typescript
import { Bash } from 'just-bash'
import { StreamManager } from '@tdsk/shell'
import * as fs from 'fs'

const bash = new Bash()
const streamManager = new StreamManager(bash)

// Tee output to file and console
const [logBranch, displayBranch] = streamManager.teeStdout()

// Log to file
const fileWriter = new WritableStream({
  write: async (chunk) => {
    await fs.promises.appendFile('shell.log', chunk)
  }
})

logBranch.pipeTo(fileWriter)

// Display in console
const consoleWriter = new WritableStream({
  write: (chunk) => process.stdout.write(chunk)
})

displayBranch.pipeTo(consoleWriter)

// Execute commands
await streamManager.exec('ls -la')
await streamManager.exec('whoami')
```

### Pattern 4: Backpressure Management

```typescript
import { Bash } from 'just-bash'
import { StreamManager } from '@tdsk/shell'

const bash = new Bash()
const streamManager = new StreamManager(bash, {
  highWaterMark: 10 // Allow 10 chunks to queue
})

// Slow consumer
const slowConsumer = new WritableStream({
  async write(chunk) {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100))
    await uploadToServer(chunk)
  }
})

streamManager.pipe(slowConsumer)

// Fast producer
for (let i = 0; i < 100; i++) {
  await streamManager.exec(`echo "Line ${i}"`)

  // Monitor queue size
  const queueSize = streamManager.getStdinQueueSize()
  if (queueSize > 50) {
    console.warn('High backpressure detected')
  }
}
```

### Pattern 5: Combined Error Handling

```typescript
import { Bash } from 'just-bash'
import { StreamManager } from '@tdsk/shell'

const bash = new Bash()
const streamManager = new StreamManager(bash)

// Get combined output stream
const combined = streamManager.getCombinedOutput()
const reader = combined.getReader()

// Read all output
const chunks: string[] = []
const readLoop = async () => {
  while (true) {
    const result = await reader.read()
    if (result.done) break
    chunks.push(result.value)
  }
}

readLoop()

// Execute commands
await streamManager.exec('echo "Success message"')
await streamManager.exec('cat /nonexistent 2>&1') // Error

await streamManager.close()

// All output (stdout + stderr) is combined
console.log(chunks.join(''))
```

## Advanced Topics

### Custom Stream Transformers

```typescript
class UpperCaseTransformer implements Transformer<string, string> {
  transform(chunk: string, controller: TransformStreamDefaultController) {
    controller.enqueue(chunk.toUpperCase())
  }
}

// Apply transformer
const [outputBranch] = streamManager.teeStdout()
const uppercaseStream = outputBranch.pipeThrough(
  new TransformStream(new UpperCaseTransformer())
)

const reader = uppercaseStream.getReader()
```

### Stream Monitoring

```typescript
class MonitoringTransformer implements Transformer<string, string> {
  private bytesProcessed = 0

  transform(chunk: string, controller: TransformStreamDefaultController) {
    this.bytesProcessed += chunk.length
    console.log(`Processed: ${this.bytesProcessed} bytes`)
    controller.enqueue(chunk)
  }
}

const [monitoredBranch] = streamManager.teeStdout()
const monitoredStream = monitoredBranch.pipeThrough(
  new TransformStream(new MonitoringTransformer())
)
```

### Error Recovery

```typescript
const bash = new Bash()
const streamManager = new StreamManager(bash)

// Monitor health
setInterval(() => {
  if (!streamManager.isHealthy()) {
    console.error('Stream manager unhealthy, recreating...')
    // Recreate if needed
  }
}, 5000)

// Handle stream errors
const errorHandler = new WritableStream({
  write: (chunk) => console.log(chunk),
  abort: (reason) => {
    console.error('Stream aborted:', reason)
    // Cleanup and recovery
  }
})

streamManager.pipeStderr(errorHandler)
```

## Performance Considerations

### Memory Management

- **Close streams** when done to prevent memory leaks
- **Release locks** on readers/writers after use
- **Monitor queue size** for backpressure issues
- **Use tee sparingly** - each branch consumes memory

### Backpressure Tuning

```typescript
// Low latency (small buffer)
const lowLatency = new StreamManager(bash, {
  highWaterMark: 1
})

// High throughput (large buffer)
const highThroughput = new StreamManager(bash, {
  highWaterMark: 100
})
```

### Stream Lifecycle

```typescript
// Always close when done
try {
  await streamManager.exec('command')
} finally {
  await streamManager.close()
}
```

## Troubleshooting

### Issue: "WritableStream is locked"

**Cause**: Trying to get a writer when stream is already locked.

**Solution**: Release existing locks before getting new writers.

```typescript
const writer = streamManager.stdin.getWriter()
// Use writer
writer.releaseLock() // Important!

// Now can get new writer
const newWriter = streamManager.stdin.getWriter()
```

### Issue: Backpressure causing delays

**Cause**: Consumer is slower than producer.

**Solution**: Increase `highWaterMark` or optimize consumer.

```typescript
// Increase buffer size
const streamManager = new StreamManager(bash, {
  highWaterMark: 50
})

// Or optimize consumer
const fastWriter = new WritableStream({
  write: async (chunk) => {
    // Batch writes
    buffer.push(chunk)
    if (buffer.length >= 10) {
      await flushBuffer(buffer)
      buffer = []
    }
  }
})
```

### Issue: Streams not closing properly

**Cause**: Readers/writers not released.

**Solution**: Always release locks and close streams.

```typescript
const reader = streamManager.stdout.getReader()
try {
  const result = await reader.read()
} finally {
  reader.releaseLock()
  await streamManager.close()
}
```

## Browser Compatibility

StreamManager uses WHATWG Streams API which is supported in:

- Chrome 52+
- Firefox 65+
- Safari 14.1+
- Edge 79+
- Node.js 16.5+ (with `--experimental-web-streams` flag)
- Deno 1.0+
- Bun 0.1.0+

For older browsers, use a polyfill like `web-streams-polyfill`.

## TypeScript Support

Full TypeScript definitions included:

```typescript
import type {
  StreamManager,
  StreamManagerOptions,
  StreamMode
} from '@tdsk/shell'
```

## See Also

- [just-bash documentation](https://github.com/vercel-labs/just-bash)
- [WHATWG Streams Standard](https://streams.spec.whatwg.org/)
- [xterm.js](https://xtermjs.org/)
- [Examples](./examples/stream-manager-example.ts)
