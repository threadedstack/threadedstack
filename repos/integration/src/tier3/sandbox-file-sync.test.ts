import { join } from 'path'
import { env } from '../utils/env'
import { tmpdir, homedir } from 'os'
import { SandboxHomePath } from '@tdsk/domain'
import { post, get } from '../utils/api-client'
import { uniqueName } from '../utils/unique-name'
import { readContext } from '../utils/test-context'
import { CliDriver } from '@tdsk/tsa/services/sync/mutagenClient'
import { SyncManager } from '@tdsk/tsa/services/sync/syncManager'
import { mergeRules } from '@tdsk/tsa/services/sync/configLoader'
import type { TSyncRule, TSandboxSyncDefaults } from '@tdsk/domain'
import { describe, test, expect, afterAll, beforeAll } from 'vitest'
import { resolveIgnores } from '@tdsk/tsa/services/sync/ignoreResolver'
import { ensureSshConfig, getPublicKey } from '@tdsk/tsa/services/sync/sshConfig'
import { connectSandbox, execInPod, cleanupSandbox, waitForPodState } from '../utils/sandbox-helpers'
import { mkdirSync, writeFileSync, readFileSync, rmSync, mkdtempSync, existsSync, chmodSync } from 'fs'

/**
 * Ensure the TSA's tsa.yaml config has auth credentials so the
 * `tsa proxy` ProxyCommand can authenticate through the tunnel.
 * Returns previous content for cleanup.
 */
const ensureTsaAuth = (): string | null => {
  const configDir = join(homedir(), '.config', 'tdsk')
  const configPath = join(configDir, 'tsa.yaml')

  const previous = existsSync(configPath)
    ? readFileSync(configPath, 'utf-8')
    : null

  mkdirSync(configDir, { recursive: true, mode: 0o700 })

  const yaml = [
    `auth:`,
    `  apiKey: ${env.testApiKey}`,
    `  proxyUrl: ${env.proxyUrl}`,
    `  insecure: true`,
  ].join('\n') + '\n'

  writeFileSync(configPath, yaml, 'utf-8')
  chmodSync(configPath, 0o600)

  return previous
}

const restoreTsaAuth = (previous: string | null): void => {
  const configPath = join(homedir(), '.config', 'tdsk', 'tsa.yaml')
  if (previous === null) {
    try { rmSync(configPath) } catch { /* best-effort */ }
  } else {
    writeFileSync(configPath, previous, 'utf-8')
  }
}

describe('Tier 3: Sandbox File Sync', () => {
  const ctx = readContext()

  let projectId = ''
  let sandboxId = ''
  let instanceId = ''
  let setupFailed = false
  let localDir = ''
  let previousTsaConfig: string | null = null

  const driver = new CliDriver()
  const manager = new SyncManager(driver)

  const sandboxConfig = {
    image: env.sandboxImage,
    imagePullPolicy: 'IfNotPresent',
    ports: { '3000': { protocol: 'http' } },
    sync: {
      targetBase: '/workspace/synced',
      mode: 'two-way-resolved' as const,
      ignores: ['*.tmp'],
    },
    resources: {
      limits: { cpu: '500m', memory: '512Mi' },
      requests: { cpu: '100m', memory: '256Mi' },
    },
  }

  beforeAll(async () => {
    try {
      // Stop any stale Mutagen daemon from previous runs
      try { await driver.stopDaemon() } catch { /* ok if not running */ }

      // Create temp local directory with test files
      localDir = mkdtempSync(join(tmpdir(), 'tdsk-sync-test-'))
      writeFileSync(join(localDir, 'hello.txt'), 'hello from sync test')
      writeFileSync(join(localDir, 'data.json'), JSON.stringify({ key: 'value' }))
      mkdirSync(join(localDir, 'subdir'))
      writeFileSync(join(localDir, 'subdir', 'nested.txt'), 'nested content')
      writeFileSync(join(localDir, 'ignored.tmp'), 'this should be ignored')

      // Ensure SSH config, key pair, and proxy wrapper exist
      ensureSshConfig()

      // Ensure TSA auth config for the tsa proxy ProxyCommand
      previousTsaConfig = ensureTsaAuth()

      // Create project
      const projRes = await post<Record<string, any>>(
        `/orgs/${ctx.orgId}/projects`,
        { name: uniqueName('sync-project'), orgId: ctx.orgId }
      )
      if (!projRes.ok) { setupFailed = true; return }
      projectId = projRes.data.id

      // Create sandbox with sync config
      const sbRes = await post<Record<string, any>>(
        `/orgs/${ctx.orgId}/sandboxes`,
        {
          name: uniqueName('sync-sandbox'),
          config: sandboxConfig,
          orgId: ctx.orgId,
          projectId,
        }
      )
      if (!sbRes.ok) { setupFailed = true; return }
      sandboxId = sbRes.data.id

      // Connect — starts pod, returns connection info
      const connectRes = await connectSandbox(ctx.orgId, projectId, sandboxId)
      if (!connectRes.ok) { setupFailed = true; return }
      instanceId = connectRes.data.instanceId

      // Wait for pod to be fully Running
      await waitForPodState(ctx.orgId, projectId, sandboxId, instanceId, 'Running', 90_000)

      // Integration tests use execInPod (test utility) rather than ApiClient.injectSshKey
      // because the test framework authenticates differently. The shell command mirrors
      // ApiClient.injectSshKey in repos/tsa/src/services/api.ts — keep them in sync.
      const publicKey = getPublicKey()
      const escaped = publicKey.replace(/'/g, `'\\''`)
      const sshKeyRes = await execInPod(
        ctx.orgId, projectId, sandboxId, instanceId,
        `mkdir -p ${SandboxHomePath}/.ssh && echo '${escaped}' > ${SandboxHomePath}/.ssh/authorized_keys && chmod 700 ${SandboxHomePath}/.ssh && chmod 600 ${SandboxHomePath}/.ssh/authorized_keys && chown -R sandbox:sandbox ${SandboxHomePath}/.ssh`
      )
    } catch (err) {
      console.error('[sandbox-file-sync] Setup failed:', (err as Error).message)
      setupFailed = true
    }
  }, 180_000)

  afterAll(async () => {
    // Terminate any sync sessions
    try { await manager.stopAll(sandboxId) }
    catch (err) { console.warn('[cleanup] stopAll failed:', (err as Error).message) }

    // Restore original tsa config
    restoreTsaAuth(previousTsaConfig)

    // Clean up local temp dir
    if (localDir) {
      try { rmSync(localDir, { recursive: true }) }
      catch (err) { console.warn('[cleanup] rmSync failed:', (err as Error).message) }
    }

    // Clean up K8s resources
    await cleanupSandbox(ctx.orgId, { sandboxId, instanceId, projectId })
  })

  // ─── SSH Config ─────────────────────────────────────────────────

  test('ensureSshConfig adds ProxyCommand for sb_* hosts', () => {
    if (setupFailed) return expect(setupFailed).toBe(false)
    const sshConfig = readFileSync(join(homedir(), '.ssh', 'config'), 'utf-8')
    expect(sshConfig).toContain('Host sb_*')
    expect(sshConfig).toContain('ProxyCommand')
    expect(sshConfig).toContain('tsa-proxy %h')
    expect(sshConfig).toContain('IdentityFile')
    expect(sshConfig).toContain('sandbox_key')
  })

  // ─── Config Resolution ──────────────────────────────────────────

  test('sandbox config.sync is accessible via API', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await get<Record<string, any>>(
      `/orgs/${ctx.orgId}/sandboxes/${sandboxId}`
    )

    expect(res.status).toBe(200)
    expect(res.data.config.sync).toBeDefined()
    expect(res.data.config.sync.targetBase).toBe('/workspace/synced')
    expect(res.data.config.sync.mode).toBe('two-way-resolved')
    expect(res.data.config.sync.ignores).toEqual(['*.tmp'])
  })

  test('mergeRules applies sandbox sync defaults to rules', () => {
    const rules: TSyncRule[] = [{ name: 'test', source: localDir }]
    const defaults: TSandboxSyncDefaults = sandboxConfig.sync
    const merged = mergeRules(rules, defaults, undefined)

    expect(merged[0].target).toBe('/workspace/synced')
    expect(merged[0].mode).toBe('two-way-resolved')
  })

  test('resolveIgnores merges builtins with sandbox ignores', () => {
    const result = resolveIgnores({
      sandboxIgnores: ['*.tmp'],
      ruleIgnores: ['dist/'],
    })

    expect(result).toContain('.git/')
    expect(result).toContain('node_modules/')
    expect(result).toContain('*.tmp')
    expect(result).toContain('dist/')
  })

  // ─── Mutagen Sync Session ──────────────────────────────────────

  test('SyncManager.startAll creates sync sessions', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const rules: TSyncRule[] = [{
      name: 'integration-test',
      source: localDir,
      target: '/workspace/synced',
      mode: 'two-way-resolved',
      ignores: ['*.tmp'],
    }]

    const sessions = await manager.startAll(
      sandboxId,
      ctx.orgId,
      rules,
      sandboxConfig.sync,
    )

    expect(sessions.length).toBe(1)
    expect(sessions[0].name).toBe('integration-test')
    expect(sessions[0].status).toBe('watching')
  }, 60_000)

  test('synced files appear in sandbox pod', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    // Wait for Mutagen to complete initial sync
    await new Promise(r => setTimeout(r, 10_000))

    const helloRes = await execInPod(
      ctx.orgId, projectId, sandboxId, instanceId,
      'cat /workspace/synced/hello.txt'
    )
    expect(helloRes.status).toBe(200)
    expect(helloRes.data.success).toBe(true)
    expect(helloRes.data.output.trim()).toBe('hello from sync test')

    const jsonRes = await execInPod(
      ctx.orgId, projectId, sandboxId, instanceId,
      'cat /workspace/synced/data.json'
    )
    expect(jsonRes.status).toBe(200)
    expect(jsonRes.data.success).toBe(true)
    expect(JSON.parse(jsonRes.data.output.trim())).toEqual({ key: 'value' })

    const nestedRes = await execInPod(
      ctx.orgId, projectId, sandboxId, instanceId,
      'cat /workspace/synced/subdir/nested.txt'
    )
    expect(nestedRes.status).toBe(200)
    expect(nestedRes.data.success).toBe(true)
    expect(nestedRes.data.output.trim()).toBe('nested content')
  }, 30_000)

  test('ignored files do NOT appear in sandbox pod', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const res = await execInPod(
      ctx.orgId, projectId, sandboxId, instanceId,
      'test -e /workspace/synced/ignored.tmp && echo exists || echo missing'
    )
    expect(res.status).toBe(200)
    expect(res.data.output.trim()).toBe('missing')
  })

  test('file modifications sync to sandbox pod', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    writeFileSync(join(localDir, 'hello.txt'), 'updated content from sync test')

    await new Promise(r => setTimeout(r, 10_000))

    const res = await execInPod(
      ctx.orgId, projectId, sandboxId, instanceId,
      'cat /workspace/synced/hello.txt'
    )
    expect(res.status).toBe(200)
    expect(res.data.success).toBe(true)
    expect(res.data.output.trim()).toBe('updated content from sync test')
  }, 30_000)

  test('new files sync to sandbox pod', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    writeFileSync(join(localDir, 'newfile.txt'), 'brand new file')

    await new Promise(r => setTimeout(r, 10_000))

    const res = await execInPod(
      ctx.orgId, projectId, sandboxId, instanceId,
      'cat /workspace/synced/newfile.txt'
    )
    expect(res.status).toBe(200)
    expect(res.data.success).toBe(true)
    expect(res.data.output.trim()).toBe('brand new file')
  }, 30_000)

  // ─── Session Management ─────────────────────────────────────────

  test('SyncManager.status shows active sessions', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const sessions = await manager.status(sandboxId)
    expect(sessions.length).toBeGreaterThanOrEqual(1)
  })

  test('SyncManager.stopAll terminates all sessions', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    await manager.stopAll(sandboxId)

    const sessions = await manager.status(sandboxId)
    expect(sessions.length).toBe(0)
  })

  test('duplicate session is skipped when labels match', async () => {
    if (setupFailed) return expect(setupFailed).toBe(false)

    const rules: TSyncRule[] = [{
      name: 'dedup-test',
      source: localDir,
      target: '/workspace/synced',
      mode: 'two-way-resolved',
    }]

    const first = await manager.startAll(
      sandboxId, ctx.orgId, rules, undefined,
    )
    expect(first.length).toBe(1)

    const second = await manager.startAll(
      sandboxId, ctx.orgId, rules, undefined,
    )
    expect(second.length).toBe(0)

    await manager.stopAll(sandboxId)
  }, 60_000)
})
