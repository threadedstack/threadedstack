/**
 * Basic Shell usage examples
 * Demonstrates platform detection, initialization, and command execution
 */

import { Shell, EPlatform } from '../index'

/**
 * Example 1: Basic initialization and command execution
 */
async function basicUsage() {
  console.log('=== Basic Usage Example ===\n')

  // Create shell instance with default options
  const shell = new Shell()

  // Initialize the shell
  await shell.initialize()

  console.log(`Platform: ${shell.getPlatform()}`)
  console.log(`Home Directory: ${shell.getHomeDir()}`)
  console.log(`Initialized: ${shell.isInitialized()}\n`)

  // Execute simple commands
  const result1 = await shell.execute('echo "Hello, Shell!"')
  console.log('Command:', result1.command)
  console.log('Output:', result1.stdout)
  console.log('Exit Code:', result1.exitCode)
  console.log('Duration:', result1.duration, 'ms\n')

  // Execute multiple commands
  const result2 = await shell.execute('ls -la /home')
  console.log('Directory Listing:')
  console.log(result2.stdout)

  // Get current working directory
  const pwd = await shell.pwd()
  console.log('Current Directory:', pwd, '\n')

  // Clean up
  await shell.destroy()
  console.log('Shell destroyed')
}

/**
 * Example 2: Custom configuration
 */
async function customConfiguration() {
  console.log('\n=== Custom Configuration Example ===\n')

  // Create shell with custom options
  const shell = new Shell({
    homeDir: '/custom/home',
    persistent: true,
    verbose: true,
  })

  await shell.initialize()

  // Execute commands
  const result = await shell.execute('pwd')
  console.log('Working Directory:', result.stdout.trim())

  await shell.destroy()
}

/**
 * Example 3: Error handling
 */
async function errorHandling() {
  console.log('\n=== Error Handling Example ===\n')

  const shell = new Shell()
  await shell.initialize()

  // Execute command that fails
  const result = await shell.execute('nonexistent-command')
  console.log('Command:', result.command)
  console.log('Exit Code:', result.exitCode)
  console.log('Error:', result.stderr)

  await shell.destroy()
}

/**
 * Example 4: Working with directories
 */
async function directoryOperations() {
  console.log('\n=== Directory Operations Example ===\n')

  const shell = new Shell()
  await shell.initialize()

  // Create directory
  await shell.execute('mkdir -p /home/workspace/test')

  // Change directory
  await shell.cd('/home/workspace')

  // Get current directory
  const pwd = await shell.pwd()
  console.log('Current Directory:', pwd)

  // List directory contents
  const ls = await shell.execute('ls -la')
  console.log('Contents:')
  console.log(ls.stdout)

  await shell.destroy()
}

/**
 * Example 5: Stream access
 */
async function streamAccess() {
  console.log('\n=== Stream Access Example ===\n')

  const shell = new Shell()
  await shell.initialize()

  // Get streams
  const streams = shell.getStreams()

  // Listen to stdout
  streams.stdout.on('data', (chunk) => {
    console.log('STDOUT:', chunk.toString())
  })

  // Execute command
  await shell.execute('echo "Streaming output"')

  await shell.destroy()
}

/**
 * Example 6: Reset shell state
 */
async function resetShell() {
  console.log('\n=== Reset Shell Example ===\n')

  const shell = new Shell()
  await shell.initialize()

  // Execute some commands
  await shell.execute('echo "Command 1"')
  await shell.execute('echo "Command 2"')
  await shell.execute('echo "Command 3"')

  console.log('Execution Count:', shell.getExecutionCount())

  // Reset shell
  await shell.reset()

  console.log('Execution Count after reset:', shell.getExecutionCount())

  await shell.destroy()
}

/**
 * Example 7: Platform-specific behavior
 */
async function platformSpecific() {
  console.log('\n=== Platform-Specific Example ===\n')

  const shell = new Shell()

  const platform = shell.getPlatform()
  console.log('Detected Platform:', platform)

  await shell.initialize()

  switch (platform) {
    case EPlatform.Browser:
      console.log('Running in browser - using IndexedDB/InMemory filesystem')
      break
    case EPlatform.Node:
      console.log('Running in Node.js - using real filesystem')
      break
    case EPlatform.Bun:
      console.log('Running in Bun - using real filesystem')
      break
  }

  await shell.destroy()
}

/**
 * Run all examples
 */
async function runAllExamples() {
  try {
    await basicUsage()
    await customConfiguration()
    await errorHandling()
    await directoryOperations()
    await streamAccess()
    await resetShell()
    await platformSpecific()

    console.log('\n✅ All examples completed successfully!')
  } catch (error) {
    console.error('❌ Error running examples:', error)
  }
}

// Run examples if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAllExamples()
}

export {
  basicUsage,
  customConfiguration,
  errorHandling,
  directoryOperations,
  streamAccess,
  resetShell,
  platformSpecific,
  runAllExamples,
}
