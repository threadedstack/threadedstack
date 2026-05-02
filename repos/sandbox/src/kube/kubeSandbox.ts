/**
 * KubeSandbox — ISandbox implementation backed by K8s pods
 *
 * SECURITY NOTE: This file does NOT use child_process.
 * All command execution goes through the Kubernetes Exec API
 * (@kubernetes/client-node k8s.Exec) via KubeClient.runInPod(),
 * which sends commands over a WebSocket to the K8s API server.
 *
 * Some operations (exec, writeFile, evaluate, reset) invoke `sh -c`
 * within the pod. While the K8s Exec API itself is not subject to
 * host-level shell injection, user-supplied input passed to `sh -c`
 * should be sanitized (e.g. path escaping in writeFile).
 */

import type { KubeClient } from '@TSB/kube/kubeClient'
import type {
  ISandbox,
  TSandboxResult,
  TSandboxRuntime,
  TSandboxEvalOpts,
  TSandboxEvalResult,
} from '@tdsk/domain'

import { nanoid } from 'nanoid'
import { logger } from '@TSB/utils/logger'
import { DefaultWorkdir } from '@tdsk/domain'
import { DefaultTempdir, DefaultRuntime } from '@TSB/constants/values'

export class KubeSandbox implements ISandbox {
  private podName: string
  private client: KubeClient
  private defaultRuntime: string
  private runtimes: TSandboxRuntime[]

  constructor(
    client: KubeClient,
    podName: string,
    runtimes?: TSandboxRuntime[],
    defaultRuntime?: string
  ) {
    this.client = client
    this.podName = podName
    this.runtimes = runtimes || [DefaultRuntime]
    this.defaultRuntime = defaultRuntime || this.runtimes[0]?.name || DefaultRuntime.name
  }

  /**
   * ISandbox.exec — run a shell command inside the K8s pod.
   * Delegates to the K8s Exec API via KubeClient.runInPod().
   * Does NOT use child_process — no host-level shell access. Commands run inside the pod via sh -c.
   */
  exec = async (command: string, args: string[] = []): Promise<TSandboxResult> => {
    const cmd = args.length ? `${command} ${args.join(` `)}` : command
    return await this.client.runInPod(this.podName, [`sh`, `-c`, cmd])
  }

  async readFile(path: string): Promise<string> {
    const result = await this.client.runInPod(this.podName, [`cat`, path])
    if (!result.success) throw new Error(result.error || `Failed to read file: ${path}`)
    return result.output
  }

  async writeFile(path: string, content: string): Promise<void> {
    const escaped = content.replace(/'/g, `'\\''`)
    const escapedPath = path.replace(/'/g, `'\\''`)
    const result = await this.client.runInPod(this.podName, [
      `sh`,
      `-c`,
      `printf '%s' '${escaped}' > '${escapedPath}'`,
    ])
    if (!result.success) throw new Error(result.error || `Failed to write file: ${path}`)
  }

  async listDir(path: string): Promise<string[]> {
    const result = await this.client.runInPod(this.podName, [`ls`, `-1aF`, path])
    if (!result.success) throw new Error(result.error || `Failed to list dir: ${path}`)

    return result.output
      .split(`\n`)
      .filter(Boolean)
      .filter((e) => e !== `./` && e !== `../` && e !== `.` && e !== `..`)
      .map((entry) => {
        if (entry.endsWith(`/`)) return `[DIR] ${entry.slice(0, -1)}`
        return entry.replace(/[@*=|]$/, ``)
      })
  }

  async deleteFile(path: string): Promise<void> {
    const result = await this.client.runInPod(this.podName, [`rm`, `-rf`, path])
    if (!result.success) throw new Error(result.error || `Failed to delete: ${path}`)
  }

  async mkdir(path: string): Promise<void> {
    const result = await this.client.runInPod(this.podName, [`mkdir`, `-p`, path])
    if (!result.success) throw new Error(result.error || `Failed to create dir: ${path}`)
  }

  async fileExists(path: string): Promise<boolean> {
    const result = await this.client.runInPod(this.podName, [`test`, `-e`, path])
    return result.success
  }

  /**
   * Evaluate code by writing to a temp file and running with the configured runtime.
   *
   * 1. Creates a temp directory at ${DefaultTempdir}/tdsk-eval-<id>/
   * 2. If opts.modules provided, write each as <name>.<ext> in the temp dir
   * 3. Write main code as main.<ext> in the temp dir
   * 4. Run with the runtime command (e.g. `node main.js`)
   * 5. Clean up temp directory
   *
   * The `result` field is undefined — K8s sandbox captures output via stdout only.
   * Callers that need structured return values should print JSON to stdout.
   */
  async evaluate(code: string, opts?: TSandboxEvalOpts): Promise<TSandboxEvalResult> {
    const runtimeName = opts?.runtime || this.defaultRuntime
    const runtime = this.runtimes.find((r) => r.name === runtimeName)
    if (!runtime) {
      throw new Error(
        `Runtime "${runtimeName}" not available. Available: ${this.runtimes.map((r) => r.name).join(`, `)}`
      )
    }

    const fileId = nanoid(8)
    const tmpDir = `${DefaultTempdir}/tdsk-eval-${fileId}`
    await this.mkdir(tmpDir)

    if (opts?.modules) {
      for (const [name, moduleCode] of Object.entries(opts.modules)) {
        const modulePath = `${tmpDir}/${name}${runtime.extension}`
        await this.writeFile(modulePath, moduleCode)
      }
    }

    const mainFile = `${tmpDir}/main${runtime.extension}`
    await this.writeFile(mainFile, code)

    const timeoutFlag = opts?.timeout ? `timeout ${Math.ceil(opts.timeout / 1000)} ` : ``
    const result = await this.exec(`${timeoutFlag}${runtime.command} ${mainFile}`)

    const cleanup = await this.exec(`rm -rf ${tmpDir}`)
    if (!cleanup.success)
      logger.error(`[KubeSandbox] Temp cleanup failed for ${tmpDir}:`, cleanup.error)

    return {
      result: undefined,
      error: result.error,
      output: result.output || ``,
    }
  }

  async reset(): Promise<void> {
    const result = await this.client.runInPod(this.podName, [
      `sh`,
      `-c`,
      `rm -rf ${DefaultWorkdir}/* ${DefaultTempdir}/*`,
    ])
    if (!result.success) {
      throw new Error(`Failed to reset sandbox: ${result.error}`)
    }
  }

  async close(): Promise<void> {
    // Disconnect only — does NOT delete pod (persistent workspace)
    // Pod lifecycle managed separately by SandboxService
  }
}
