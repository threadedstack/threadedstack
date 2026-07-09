import { Sandbox, DefaultResources } from '@tdsk/domain'
import { describe, it, expect } from 'vitest'
import { VolumeMountName, CACertMountPath } from '@TSB/constants/values'
import { buildPodName, buildPodManifest, sanitizeLabel } from './podManifest'
import { KubeSBPrefix, PodLabelKeys, PodAnnotationKeys } from '@TSB/constants/kube'

const makeSandbox = (overrides: Partial<ConstructorParameters<typeof Sandbox>[0]> = {}) =>
  new Sandbox({
    id: `test12345678`,
    name: `Test Sandbox`,
    orgId: `org1`,
    config: {
      image: `node:20`,
    },
    ...overrides,
  })

describe(`buildPodName`, () => {
  it(`should generate a pod name with tdsk-sb- prefix and first 8 chars of sandbox ID`, () => {
    const name = buildPodName(`abcdefghijklmnop`)
    expect(name).toMatch(/^tdsk-sb-abcdefgh-[a-z0-9]{4}$/)
  })

  it(`should lowercase the sandbox ID slug for RFC 1123 compliance`, () => {
    const name = buildPodName(`AbCdEfGhIjKlMnOp`)
    expect(name).toMatch(/^tdsk-sb-abcdefgh-[a-z0-9]{4}$/)
  })

  it(`should strip non-alphanumeric characters for RFC 1123 compliance`, () => {
    const name = buildPodName(`hX_b3jsxfU`)
    expect(name).toMatch(/^tdsk-sb-hxb3jsxf-[a-z0-9]{4}$/)
  })

  it(`should include a random 4 character suffix`, () => {
    const name1 = buildPodName(`test12345678`)
    const name2 = buildPodName(`test12345678`)
    const prefix = `tdsk-${KubeSBPrefix}-test1234-`
    expect(name1.startsWith(prefix)).toBe(true)
    expect(name2.startsWith(prefix)).toBe(true)
    // Random suffixes should differ (extremely unlikely to collide)
    // We just verify the format is correct
    expect(name1).toMatch(/^tdsk-sb-test1234-[a-z0-9]{4}$/)
  })
})

describe(`sanitizeLabel`, () => {
  it(`should pass through already valid values`, () => {
    expect(sanitizeLabel(`org-1`)).toBe(`org-1`)
    expect(sanitizeLabel(`test12345678`)).toBe(`test12345678`)
  })

  it(`should strip leading non-alphanumeric characters`, () => {
    expect(sanitizeLabel(`-TJvRVH2-d`)).toBe(`TJvRVH2-d`)
  })

  it(`should strip trailing non-alphanumeric characters`, () => {
    expect(sanitizeLabel(`IgB5vBYR7-`)).toBe(`IgB5vBYR7`)
  })

  it(`should strip both leading and trailing non-alphanumeric characters`, () => {
    expect(sanitizeLabel(`--abc--`)).toBe(`abc`)
  })

  it(`should remove characters not allowed in K8s labels`, () => {
    expect(sanitizeLabel(`a@b#c`)).toBe(`abc`)
  })

  it(`should truncate to 63 characters`, () => {
    const long = `a`.repeat(100)
    expect(sanitizeLabel(long)).toHaveLength(63)
  })
})

describe(`buildPodManifest`, () => {
  const basePlaceholders = { '{{API_KEY}}': { secretId: 'secret123' } }
  const egressOpts = {
    servicePort: 8889,
    serviceName: `tdsk-backend`,
    certSecretName: `tdsk-egress-ca`,
  }

  const buildOpts = (
    sandboxOverrides: Partial<ConstructorParameters<typeof Sandbox>[0]> = {}
  ) => ({
    egressOpts,
    orgId: `org-1`,
    userId: `user-1`,
    projectId: `proj-1`,
    placeholders: basePlaceholders,
    sandbox: makeSandbox(sandboxOverrides),
  })

  it(`should produce a valid manifest with correct apiVersion and kind`, () => {
    const manifest = buildPodManifest(buildOpts())
    expect(manifest.apiVersion).toBe(`v1`)
    expect(manifest.kind).toBe(`Pod`)
  })

  it(`should set correct labels on metadata`, () => {
    const manifest = buildPodManifest(buildOpts())
    const labels = manifest.metadata!.labels!
    expect(labels[PodLabelKeys.managed]).toBe(`true`)
    expect(labels[PodLabelKeys.orgId]).toBe(`org-1`)
    expect(labels[PodLabelKeys.userId]).toBe(`user-1`)
    expect(labels[PodLabelKeys.sandboxId]).toBe(`test12345678`)
    expect(labels[PodLabelKeys.projectId]).toBe(`proj-1`)
  })

  it(`should sanitize sandboxId label values with leading/trailing dashes`, () => {
    const manifest = buildPodManifest(buildOpts({ id: `-TJvRVH2-d` }))
    const labels = manifest.metadata!.labels!
    expect(labels[PodLabelKeys.sandboxId]).toBe(`TJvRVH2-d`)
  })

  it(`should include containers with sandbox container`, () => {
    const manifest = buildPodManifest(buildOpts())
    const containers = manifest.spec!.containers!
    expect(containers).toHaveLength(1)
    expect(containers[0].name).toBe(`sandbox`)
    expect(containers[0].image).toBe(`node:20`)
  })

  it(`should include iptables init container with NET_ADMIN capability`, () => {
    const manifest = buildPodManifest(buildOpts())
    const initContainers = manifest.spec!.initContainers!
    expect(initContainers).toHaveLength(1)

    const initContainer = initContainers[0]
    expect(initContainer.name).toBe(`proxy-redirect`)
    expect(initContainer.image).toBe(`ghcr.io/threadedstack/tdsk-init`)
    expect(initContainer.securityContext!.capabilities!.add).toContain(`NET_ADMIN`)

    const cmd = initContainer.command!
    expect(cmd[0]).toBe(`sh`)
    expect(cmd[1]).toBe(`-c`)
    expect(cmd[2]).toContain(`iptables-legacy`)
    expect(cmd[2]).toContain(`$IPT -t nat`)
    expect(cmd[2]).toContain(egressOpts.serviceName)
    expect(cmd[2]).toContain(egressOpts.servicePort)
  })

  it(`should use custom initImage when provided in egressOpts`, () => {
    const built = buildOpts()
    const opts = {
      ...built,
      egressOpts: { ...built.egressOpts, initImage: `custom-registry.io/my-init:v2` },
    }
    const manifest = buildPodManifest(opts)
    expect(manifest.spec!.initContainers![0].image).toBe(`custom-registry.io/my-init:v2`)
  })

  it(`should use serviceIp directly when provided in egressOpts`, () => {
    const built = buildOpts()
    const opts = {
      ...built,
      egressOpts: { ...built.egressOpts, serviceIp: `10.1.4.50` },
    }
    const manifest = buildPodManifest(opts)
    const cmd = manifest.spec!.initContainers![0].command!
    expect(cmd[2]).toContain(`EGRESS_IP="10.1.4.50"`)
    expect(cmd[2]).not.toContain(`getent hosts`)
  })

  it(`should include volumes with CA cert secret`, () => {
    const manifest = buildPodManifest(buildOpts())
    const volumes = manifest.spec!.volumes!
    expect(volumes).toHaveLength(1)
    expect(volumes[0].name).toBe(VolumeMountName)
    expect(volumes[0].secret!.secretName).toBe(egressOpts.certSecretName)
  })

  it(`should allow overriding caCertSecretName`, () => {
    const built = buildOpts()
    const opts = {
      ...built,
      egressOpts: { ...built.egressOpts, certSecretName: `custom-ca-cert` },
    }
    const manifest = buildPodManifest(opts)
    const volumes = manifest.spec!.volumes!
    expect(volumes[0].secret!.secretName).toBe(`custom-ca-cert`)
  })

  it(`should store placeholders in annotations as JSON`, () => {
    const manifest = buildPodManifest(buildOpts())
    const annotations = manifest.metadata!.annotations!
    const parsed = JSON.parse(annotations[PodAnnotationKeys.placeholders])
    expect(parsed).toEqual(basePlaceholders)
  })

  it(`should store ports in annotations as JSON`, () => {
    const opts = buildOpts({
      config: {
        image: `node:20`,
        ports: { '3000': { protocol: `http` } },
      },
    })
    const manifest = buildPodManifest(opts)
    const annotations = manifest.metadata!.annotations!
    const parsed = JSON.parse(annotations[PodAnnotationKeys.ports])
    expect(parsed).toEqual({ '3000': { protocol: `http` } })
  })

  it(`should include environment variables when specified`, () => {
    const opts = buildOpts({
      config: {
        image: `node:20`,
        envVars: { NODE_ENV: `development`, APP_PORT: `3000` },
      },
    })
    const manifest = buildPodManifest(opts)
    const env = manifest.spec!.containers![0].env!
    expect(env).toContainEqual({ name: `NODE_ENV`, value: `development` })
    expect(env).toContainEqual({ name: `APP_PORT`, value: `3000` })
  })

  it(`should always include NODE_EXTRA_CA_CERTS env var`, () => {
    const manifest = buildPodManifest(buildOpts())
    const env = manifest.spec!.containers![0].env!
    expect(env).toContainEqual({ name: `NODE_EXTRA_CA_CERTS`, value: CACertMountPath })
  })

  it(`should only have default env vars when no envVars configured`, () => {
    const manifest = buildPodManifest(buildOpts())
    const env = manifest.spec!.containers![0].env!
    expect(env).toHaveLength(3)
    expect(env[0].name).toBe(`TERM`)
    expect(env[0].value).toBe(`xterm-256color`)
    expect(env[1].name).toBe(`DISABLE_AUTOUPDATER`)
    expect(env[1].value).toBe(`1`)
    expect(env[2].name).toBe(`NODE_EXTRA_CA_CERTS`)
    expect(env[2].value).toBe(CACertMountPath)
  })

  it(`should include port mappings when specified`, () => {
    const opts = buildOpts({
      config: {
        image: `node:20`,
        ports: {
          '3000': { protocol: `http` },
          '8080': { protocol: `http` },
        },
      },
    })
    const manifest = buildPodManifest(opts)
    const ports = manifest.spec!.containers![0].ports!
    expect(ports).toContainEqual({ protocol: `TCP`, containerPort: 3000 })
    expect(ports).toContainEqual({ protocol: `TCP`, containerPort: 8080 })
  })

  it(`should include extraEnv variables in container env`, () => {
    const opts = {
      ...buildOpts(),
      extraEnv: {
        TDSK_SSH_PASSWORD: `secret`,
        TDSK_GIT_REPO: `https://example.com/repo.git`,
      },
    }
    const manifest = buildPodManifest(opts)
    const env = manifest.spec!.containers![0].env!
    expect(env).toContainEqual({ name: `TDSK_SSH_PASSWORD`, value: `secret` })
    expect(env).toContainEqual({
      name: `TDSK_GIT_REPO`,
      value: `https://example.com/repo.git`,
    })
  })

  it(`should omit projectId label when projectId is not provided`, () => {
    const { projectId: _, ...optsWithoutProjectId } = buildOpts()
    const manifest = buildPodManifest(optsWithoutProjectId)
    const labels = manifest.metadata!.labels!
    expect(labels[PodLabelKeys.projectId]).toBeUndefined()
  })

  it(`should include projectId label when projectId is provided`, () => {
    const manifest = buildPodManifest(buildOpts())
    const labels = manifest.metadata!.labels!
    expect(labels[PodLabelKeys.projectId]).toBe(`proj-1`)
  })

  it(`should set restartPolicy to Never and disable service account token`, () => {
    const manifest = buildPodManifest(buildOpts())
    expect(manifest.spec!.restartPolicy).toBe(`Never`)
    expect(manifest.spec!.automountServiceAccountToken).toBe(false)
  })

  it(`should set subdomain annotation`, () => {
    const manifest = buildPodManifest(buildOpts())
    const annotations = manifest.metadata!.annotations!
    expect(annotations[PodAnnotationKeys.subdomain]).toMatch(
      new RegExp(`^${KubeSBPrefix}-test1234-[a-z0-9]{4}$`)
    )
  })

  it(`should set sandbox container as non-privileged`, () => {
    const manifest = buildPodManifest(buildOpts())
    const sc = manifest.spec!.containers![0].securityContext!
    expect(sc.privileged).toBe(false)
  })

  it(`should include initScript in postStart when config.initScript is set`, () => {
    const opts = buildOpts({
      config: {
        image: `node:20`,
        initScript: `echo "hello world"`,
      },
    })
    const manifest = buildPodManifest(opts)
    const postStart = manifest.spec!.containers![0].lifecycle!.postStart!.exec!.command!
    const script = postStart[2]
    expect(script).toContain(`echo "hello world"`)
    expect(script).toContain(`/etc/profile.d`)
  })

  it(`should pass setupScript to the entrypoint via TDSK_SETUP_SCRIPT env`, () => {
    const opts = buildOpts({
      config: {
        image: `node:20`,
        setupScript: `pnpm install`,
      },
    })
    const manifest = buildPodManifest(opts)
    const env = manifest.spec!.containers![0].env!
    // Delivered as env for the entrypoint to run post-clone; the entrypoint (not
    // podManifest) is responsible for executing it after the git clone.
    expect(env).toContainEqual({ name: `TDSK_SETUP_SCRIPT`, value: `pnpm install` })
  })

  it(`should not include TDSK_SETUP_SCRIPT env when config.setupScript is absent`, () => {
    const env = buildPodManifest(buildOpts()).spec!.containers![0].env!
    expect(env.some((e) => e.name === `TDSK_SETUP_SCRIPT`)).toBe(false)
  })

  it(`should not include initScript block when config.initScript is absent`, () => {
    const manifest = buildPodManifest(buildOpts())
    const postStart = manifest.spec!.containers![0].lifecycle!.postStart!.exec!.command!
    const script = postStart[2]
    expect(script).not.toContain(`initScript`)
    expect(script).toContain(`TDSK_ENV_EOF`)
  })

  it(`should wrap initScript in error handler to prevent postStart failure`, () => {
    const opts = buildOpts({
      config: {
        image: `node:20`,
        initScript: `exit 1`,
      },
    })
    const manifest = buildPodManifest(opts)
    const script = manifest.spec!.containers![0].lifecycle!.postStart!.exec!.command![2]
    expect(script).toContain(`tdsk-init-error.log`)
    expect(script).toContain(`_rc=$?`)
    expect(script).toContain(`$_rc`)
  })

  it(`should source env profile before running initScript`, () => {
    const opts = buildOpts({
      config: {
        image: `node:20`,
        initScript: `echo "after source"`,
      },
    })
    const manifest = buildPodManifest(opts)
    const script = manifest.spec!.containers![0].lifecycle!.postStart!.exec!.command![2]
    const sourceIdx = script.indexOf(`. /etc/profile.d`)
    const initIdx = script.indexOf(`echo "after source"`)
    expect(sourceIdx).toBeGreaterThan(-1)
    expect(initIdx).toBeGreaterThan(sourceIdx)
  })

  it(`should include imagePullSecrets when provided in opts`, () => {
    const opts = {
      ...buildOpts(),
      imagePullSecrets: [`secret-1`, `secret-2`],
    }
    const manifest = buildPodManifest(opts)
    expect(manifest.spec!.imagePullSecrets).toEqual([
      { name: `secret-1` },
      { name: `secret-2` },
    ])
  })

  it(`should apply DefaultResources when config.resources is absent`, () => {
    const manifest = buildPodManifest(buildOpts())
    expect(manifest.spec!.containers![0].resources).toEqual(DefaultResources)
  })

  it(`should honor explicit config.resources over the default`, () => {
    const custom = {
      requests: { cpu: `100m`, memory: `256Mi` },
      limits: { cpu: `1`, memory: `2Gi` },
    }
    const manifest = buildPodManifest(
      buildOpts({ config: { image: `node:20`, resources: custom } })
    )
    expect(manifest.spec!.containers![0].resources).toEqual(custom)
  })

  it(`should not include imagePullSecrets when array is empty or undefined`, () => {
    const manifest = buildPodManifest(buildOpts())
    expect(manifest.spec!.imagePullSecrets).toBeUndefined()

    const optsWithEmpty = {
      ...buildOpts(),
      imagePullSecrets: [],
    }
    const manifestEmpty = buildPodManifest(optsWithEmpty)
    expect(manifestEmpty.spec!.imagePullSecrets).toBeUndefined()
  })

  describe(`resident mode`, () => {
    const residentOpts = () =>
      buildOpts({
        config: { image: `node:20`, resident: { agentId: `ag_agent001` } },
      })

    it(`should launch the resident runtime via args, preserving the entrypoint`, () => {
      const container = buildPodManifest(residentOpts()).spec!.containers![0]
      // args (NOT command) so the image ENTRYPOINT still clones /workspace
      // before exec'ing the launcher. The in-pod supervisor restarts the runtime
      // (resuming its on-disk session) and exits non-zero after N crashes so the
      // watchdog recreates the pod — never an unbounded sleep that masks a dead
      // runtime under restartPolicy Never.
      expect(container.command).toBeUndefined()
      expect(container.args?.[0]).toBe(`/bin/sh`)
      expect(container.args?.[1]).toBe(`-lc`)
      const script = container.args?.[2] as string
      expect(script).toContain(
        `[ -f repos/resident/dist/index.js ] || pnpm --filter @tdsk/resident build`
      )
      expect(script).toContain(`node repos/resident/dist/index.js`)
      expect(script).toContain(`while [ $n -lt 5 ]`)
      expect(script).toContain(`exit 1`)
      expect(script).not.toContain(`sleep 3600`)
    })

    it(`should inject TDSK_RESIDENT_AGENT_ID into the container env`, () => {
      const env = buildPodManifest(residentOpts()).spec!.containers![0].env!
      expect(env).toContainEqual({
        name: `TDSK_RESIDENT_AGENT_ID`,
        value: `ag_agent001`,
      })
    })

    it(`should not duplicate TDSK_RESIDENT_AGENT_ID when extraEnv already carries it`, () => {
      // The watchdog injects the full resident env contract via extraEnv —
      // the manifest must not emit a second entry for the same name.
      const env = buildPodManifest({
        ...residentOpts(),
        extraEnv: { TDSK_RESIDENT_AGENT_ID: `ag_agent001` },
      }).spec!.containers![0].env!
      const entries = env.filter((e) => e.name === `TDSK_RESIDENT_AGENT_ID`)
      expect(entries).toEqual([{ name: `TDSK_RESIDENT_AGENT_ID`, value: `ag_agent001` }])
    })

    it(`should take precedence over an explicit custom command`, () => {
      const container = buildPodManifest(
        buildOpts({
          config: {
            image: `node:20`,
            command: [`/bin/bash`],
            args: [`-c`, `run-something`],
            resident: { agentId: `ag_agent001` },
          },
        })
      ).spec!.containers![0]
      expect(container.command).toBeUndefined()
      expect(container.args?.[0]).toBe(`/bin/sh`)
      const script = container.args?.[2] as string
      expect(script).toContain(`node repos/resident/dist/index.js`)
      expect(script).toContain(`exit 1`)
      // The explicit custom command/args are ignored in resident mode.
      expect(script).not.toContain(`run-something`)
    })

    it(`should not affect non-resident sandboxes (sleep infinity fallback)`, () => {
      const container = buildPodManifest(buildOpts()).spec!.containers![0]
      expect(container.command).toBeUndefined()
      expect(container.args).toEqual([`sleep`, `infinity`])
      const env = container.env!
      expect(env.some((e) => e.name === `TDSK_RESIDENT_AGENT_ID`)).toBe(false)
    })
  })

  it(`should apply nodeSelector when provided`, () => {
    const opts = {
      ...buildOpts(),
      nodeSelector: { 'kubernetes.civo.com/civo-node-pool': `tdsksandbox` },
    }
    const manifest = buildPodManifest(opts)
    expect(manifest.spec!.nodeSelector).toEqual({
      'kubernetes.civo.com/civo-node-pool': `tdsksandbox`,
    })
  })

  it(`should emit a matching NoSchedule toleration for each nodeSelector entry`, () => {
    const opts = {
      ...buildOpts(),
      nodeSelector: { 'kubernetes.civo.com/civo-node-pool': `tdsksandbox` },
    }
    const manifest = buildPodManifest(opts)
    expect(manifest.spec!.tolerations).toEqual([
      {
        key: `kubernetes.civo.com/civo-node-pool`,
        value: `tdsksandbox`,
        operator: `Equal`,
        effect: `NoSchedule`,
      },
    ])
  })

  it(`should omit nodeSelector and tolerations when not provided or empty`, () => {
    const manifest = buildPodManifest(buildOpts())
    expect(manifest.spec!.nodeSelector).toBeUndefined()
    expect(manifest.spec!.tolerations).toBeUndefined()

    const empty = buildPodManifest({ ...buildOpts(), nodeSelector: {} })
    expect(empty.spec!.nodeSelector).toBeUndefined()
    expect(empty.spec!.tolerations).toBeUndefined()
  })
})
