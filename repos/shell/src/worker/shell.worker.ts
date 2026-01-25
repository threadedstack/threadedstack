/**
 * Shell Web Worker
 * Runs shell commands in a separate thread to prevent UI blocking
 */

import type {
  WorkerRequest,
  WorkerResponse,
  InitializeRequest,
  InitializeResponse,
  ExecuteRequest,
  ExecuteResponse,
  StreamData,
  ShellStatus,
  SetEnvRequest,
  GetEnvRequest,
  EnvResponse,
} from './types'

// Worker-scoped state
let shellReady = false
let shellBusy = false
let currentCommand: string | undefined
let startTime = Date.now()
let commandsExecuted = 0
let environment: Record<string, string> = {}

/**
 * Initialize the shell environment
 */
async function initialize(request: InitializeRequest): Promise<InitializeResponse> {
  try {
    // Set initial environment
    if (request.config?.env) {
      environment = { ...request.config.env }
    }

    // TODO: Initialize actual shell instance (WASM, etc.)
    // For now, just mark as ready
    shellReady = true
    startTime = Date.now()

    return {
      success: true,
      version: '1.0.0',
    }
  } catch (error) {
    shellReady = false
    throw new Error(
      `Failed to initialize shell: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

/**
 * Execute a command in the shell
 */
async function execute(request: ExecuteRequest): Promise<ExecuteResponse> {
  if (!shellReady) {
    throw new Error('Shell not initialized')
  }

  if (shellBusy) {
    throw new Error('Shell is busy executing another command')
  }

  try {
    shellBusy = true
    currentCommand = request.command
    commandsExecuted++

    const startExec = Date.now()

    // Merge environment variables
    const execEnv = {
      ...environment,
      ...(request.options?.env || {}),
    }

    // TODO: Execute actual command via shell instance
    // For now, simulate execution
    if (request.options?.stream) {
      // Simulate streaming output
      postStreamData({
        type: 'stdout',
        data: `Executing: ${request.command}\n`,
        timestamp: Date.now(),
      })

      // Simulate some work
      await new Promise((resolve) => setTimeout(resolve, 100))

      postStreamData({
        type: 'stdout',
        data: `Command completed\n`,
        timestamp: Date.now(),
      })
    }

    const duration = Date.now() - startExec

    return {
      stdout: `Executed: ${request.command}\nEnv vars: ${Object.keys(execEnv).length}`,
      stderr: '',
      exitCode: 0,
      duration,
    }
  } catch (error) {
    throw new Error(
      `Command execution failed: ${error instanceof Error ? error.message : String(error)}`
    )
  } finally {
    shellBusy = false
    currentCommand = undefined
  }
}

/**
 * Get current shell status
 */
function getStatus(): ShellStatus {
  return {
    ready: shellReady,
    busy: shellBusy,
    currentCommand,
    uptime: Date.now() - startTime,
    commandsExecuted,
  }
}

/**
 * Set environment variables
 */
function setEnv(request: SetEnvRequest): void {
  environment = {
    ...environment,
    ...request.variables,
  }
}

/**
 * Get environment variables
 */
function getEnv(request: GetEnvRequest): EnvResponse {
  if (request.keys) {
    const filtered: Record<string, string> = {}
    for (const key of request.keys) {
      if (key in environment) {
        filtered[key] = environment[key]
      }
    }
    return { variables: filtered }
  }

  return { variables: { ...environment } }
}

/**
 * Post stream data to main thread
 */
function postStreamData(data: StreamData): void {
  const response: WorkerResponse = {
    id: '', // Stream messages don't have request IDs
    type: 'stream',
    payload: data,
  }
  postMessage(response)
}

/**
 * Terminate the shell worker
 */
function terminate(): void {
  shellReady = false
  shellBusy = false
  currentCommand = undefined
  environment = {}
}

/**
 * Handle messages from main thread
 */
self.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const request = event.data
  const response: WorkerResponse = {
    id: request.id,
    type: 'result',
  }

  try {
    switch (request.type) {
      case 'initialize': {
        const result = await initialize(request.payload as InitializeRequest)
        response.type = 'initialized'
        response.payload = result
        break
      }

      case 'execute': {
        const result = await execute(request.payload as ExecuteRequest)
        response.type = 'result'
        response.payload = result
        break
      }

      case 'getStatus': {
        const status = getStatus()
        response.type = 'status'
        response.payload = status
        break
      }

      case 'setEnv': {
        setEnv(request.payload as SetEnvRequest)
        response.type = 'result'
        response.payload = { success: true }
        break
      }

      case 'getEnv': {
        const env = getEnv(request.payload as GetEnvRequest)
        response.type = 'env'
        response.payload = env
        break
      }

      case 'terminate': {
        terminate()
        response.type = 'terminated'
        response.payload = { success: true }
        break
      }

      default:
        throw new Error(`Unknown message type: ${request.type}`)
    }

    postMessage(response)
  } catch (error) {
    response.type = 'error'
    response.error = error instanceof Error ? error.message : String(error)
    postMessage(response)
  }
}
