import type { TKubeSandboxConfig } from '@tdsk/domain'
import type {
  TBuildPodOpts,
  TBuildPodMeta,
  TPodEgressOpts,
  TSkillsVolumeOpts,
} from '@TSB/types'
import type {
  V1Pod,
  V1EnvVar,
  V1Volume,
  V1Container,
  V1VolumeMount,
  V1ContainerPort,
} from '@kubernetes/client-node'

import { customAlphabet } from 'nanoid'
import {
  DefaultWorkdir,
  ESandboxRuntime,
  DefaultResources,
  SandboxRuntimeConfigs,
} from '@tdsk/domain'
import {
  EnvProfilePath,
  VolumeMountName,
  CACertMountPath,
  SkillsVolumeName,
} from '@TSB/constants/values'
import {
  KubeSBPrefix,
  PodLabelKeys,
  DefaultInitImage,
  PodAnnotationKeys,
} from '@TSB/constants/kube'

const podSuffix = customAlphabet(`0123456789abcdefghijklmnopqrstuvwxyz`, 4)

/**
 * Sanitize a value for use as a K8s label value.
 * Must start/end with alphanumeric, max 63 chars, only [a-zA-Z0-9._-] between.
 */
export const sanitizeLabel = (value: string): string =>
  value
    .replace(/[^a-zA-Z0-9._-]/g, ``)
    .replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, ``)
    .slice(0, 63)

/**
 * Generate a unique pod name from sandbox ID
 */
export const buildPodName = (sandboxId: string): string => {
  const slug = sandboxId
    .replace(/[^a-z0-9]/gi, ``)
    .slice(0, 8)
    .toLowerCase()
  return `tdsk-${KubeSBPrefix}-${slug}-${podSuffix()}`
}

/**
 * Build a complete K8s pod manifest for a sandbox
 */
export const buildPodManifest = (opts: TBuildPodOpts): V1Pod => {
  const {
    orgId,
    userId,
    sandbox,
    extraEnv,
    projectId,
    egressOpts,
    placeholders,
    skillsVolume,
    nodeSelector,
    runtimeClassName,
    imagePullSecrets,
  } = opts

  const config = sandbox.config
  const podName = buildPodName(sandbox.id)
  const subdomain = podName.replace(`tdsk-`, ``)

  const volumes: V1Volume[] = [
    {
      name: VolumeMountName,
      secret: { secretName: egressOpts.certSecretName },
    },
  ]

  if (skillsVolume)
    volumes.push({
      name: SkillsVolumeName,
      configMap: { name: skillsVolume.configMapName },
    })

  return {
    kind: `Pod`,
    apiVersion: `v1`,
    metadata: buildMeta({
      orgId,
      config,
      userId,
      sandbox,
      podName,
      subdomain,
      projectId,
      placeholders,
    }),
    spec: {
      restartPolicy: `Never`,
      automountServiceAccountToken: false,
      ...(runtimeClassName && { runtimeClassName, dnsPolicy: `Default` }),
      ...(nodeSelector &&
        Object.keys(nodeSelector).length && {
          nodeSelector,
          // Emit a matching NoSchedule toleration for every nodeSelector entry.
          // This lets an operator taint the target pool `key=value:NoSchedule`
          // so only sandbox pods land there — cilium-operator, coredns, or a
          // stray kube-system pod squatting on a sandbox node would otherwise
          // eat scarce memory and starve the real workload.
          tolerations: Object.entries(nodeSelector).map(([key, value]) => ({
            key,
            value,
            operator: `Equal`,
            effect: `NoSchedule`,
          })),
        }),
      ...(imagePullSecrets?.length && {
        imagePullSecrets: imagePullSecrets.map((name) => ({ name })),
      }),
      initContainers: [buildInitContainer(egressOpts)],
      containers: [buildSandboxContainer(config, extraEnv, skillsVolume)],
      volumes,
    },
  }
}

const buildMeta = (opts: TBuildPodMeta) => {
  const labels: Record<string, string> = {
    [PodLabelKeys.managed]: `true`,
    [PodLabelKeys.orgId]: sanitizeLabel(opts.orgId),
    [PodLabelKeys.userId]: sanitizeLabel(opts.userId),
    [PodLabelKeys.sandboxId]: sanitizeLabel(opts.sandbox.id),
  }

  if (opts.projectId) labels[PodLabelKeys.projectId] = sanitizeLabel(opts.projectId)

  return {
    labels,
    name: opts.podName,
    annotations: {
      [PodAnnotationKeys.subdomain]: opts.subdomain,
      [PodAnnotationKeys.ports]: JSON.stringify(opts.config.ports || {}),
      /** **NOTE** - This is not a security issue, id map is arbitrary with placeholder  */
      [PodAnnotationKeys.placeholders]: JSON.stringify(opts.placeholders),
    },
  }
}

const buildInitContainer = (opts: TPodEgressOpts): V1Container => {
  const { serviceName, servicePort, serviceIp, initImage } = opts
  return {
    image: initImage || DefaultInitImage,
    name: `proxy-redirect`,
    securityContext: {
      capabilities: { add: [`NET_ADMIN`] },
    },
    command: [
      `sh`,
      `-c`,
      [
        `if iptables -t nat -L -n >/dev/null 2>&1; then IPT=iptables; else IPT=iptables-legacy; fi`,
        serviceIp
          ? `EGRESS_IP="${serviceIp}"`
          : `EGRESS_IP=$(getent hosts ${serviceName} | awk '{print $1}')`,
        `$IPT -t nat -A OUTPUT -p tcp --dport 80 -j DNAT --to-destination $EGRESS_IP:${servicePort}`,
        `$IPT -t nat -A OUTPUT -p tcp --dport 443 -j DNAT --to-destination $EGRESS_IP:${servicePort}`,
      ].join(` && `),
    ],
  }
}

const buildSandboxContainer = (
  config: TKubeSandboxConfig,
  extraEnv?: Record<string, string>,
  skillsVolume?: TSkillsVolumeOpts
): V1Container => {
  const env: V1EnvVar[] = [
    { name: `TERM`, value: `xterm-256color` },
    { name: `DISABLE_AUTOUPDATER`, value: `1` },
    { name: `NODE_EXTRA_CA_CERTS`, value: CACertMountPath },
    ...buildEnvVars(config.envVars),
    ...buildEnvVars(extraEnv),
  ]

  if (config.runtime) env.push({ name: `TDSK_RUNTIME`, value: config.runtime })
  if (config.runtimeCommand)
    env.push({ name: `TDSK_RUNTIME_CMD`, value: config.runtimeCommand })
  // The entrypoint runs this AFTER the git clone (as the sandbox user) and
  // before the workspace-ready marker, so it gates the AI tool on setup.
  if (config.setupScript)
    env.push({ name: `TDSK_SETUP_SCRIPT`, value: config.setupScript })
  // Resident mode: identify the bound agent to the in-pod resident runtime.
  // The watchdog also supplies TDSK_RESIDENT_AGENT_ID via extraEnv (with the
  // rest of the pod env contract), so only push when not already present —
  // never emit a duplicate env entry.
  if (config.resident && !env.some((entry) => entry.name === `TDSK_RESIDENT_AGENT_ID`))
    env.push({ name: `TDSK_RESIDENT_AGENT_ID`, value: config.resident.agentId })

  const ports = buildPorts(config.ports)

  const volumeMounts: V1VolumeMount[] = [
    {
      subPath: `tls.crt`,
      name: VolumeMountName,
      mountPath: CACertMountPath,
    },
  ]

  if (skillsVolume)
    for (const file of skillsVolume.files) {
      volumeMounts.push({
        subPath: file.key,
        name: SkillsVolumeName,
        mountPath: `${skillsVolume.mountPath}/${file.path}`,
      })
    }

  const container: V1Container = {
    env,
    ports,
    volumeMounts,
    name: `sandbox`,
    image: config.image,
    // Fall back to DefaultResources so every sandbox pod carries memory/cpu
    // requests. Without a request, the kubelet ranks the pod as BestEffort
    // and evicts it first under any node memory pressure — which was
    // silently killing schedule runs mid-setup.
    resources: config.resources || DefaultResources,
    workingDir: config.workdir || DefaultWorkdir,
    securityContext: {
      privileged: false,
    },
    lifecycle: {
      postStart: {
        exec: {
          command: [`sh`, `-c`, buildPostStartScript(env, config.initScript)],
        },
      },
    },
  }

  // Resolve container start command based on runtime
  const runtime = config.runtime
  if (runtime && !(runtime in SandboxRuntimeConfigs)) {
    throw new Error(
      `Unknown sandbox runtime: "${runtime}". Valid: ${Object.keys(SandboxRuntimeConfigs).join(`, `)}`
    )
  }
  const runtimeConfig =
    runtime && runtime !== ESandboxRuntime.custom
      ? SandboxRuntimeConfigs[runtime]
      : undefined

  if (config.resident) {
    // Resident mode: the resident runtime is the pod's main process. The
    // launcher rides `args` (NOT `command`) so the image ENTRYPOINT
    // (sandbox-entrypoint.sh) still runs first — clone into /workspace, setup
    // script, workspace-ready marker — and then `exec "$@"`s the launcher.
    // Setting `command` would replace the entrypoint and skip the clone that
    // puts repos/resident in place. The `|| sleep 3600` keeps the pod alive
    // for debugging when the runtime crashes: restartPolicy is Never, so a
    // bare crash would otherwise terminate the pod (CrashLoop churn via
    // recreation) and destroy its on-disk session state.
    // Build-if-missing: the clone carries src only; if dist is absent (or a
    // crash left it stale), build once before launching. Proven live 2026-07-08:
    // the first resident boot died on a missing dist masked by the sleep.
    container.args = [
      `/bin/sh`,
      `-lc`,
      `cd /workspace && { [ -f repos/resident/dist/index.js ] || pnpm --filter @tdsk/resident build; } && node repos/resident/dist/index.js || sleep 3600`,
    ]
  } else if (runtimeConfig?.command) {
    // Built-in runtime: use the runtime's container start command
    container.command = runtimeConfig.command
    if (runtimeConfig.args) container.args = runtimeConfig.args
  } else if (config.command) {
    // Custom runtime with explicit start command
    container.command = config.command
    if (config.args) container.args = config.args
  } else {
    // No command specified: idle with sleep infinity
    container.args = [`sleep`, `infinity`]
  }

  if (config.imagePullPolicy) container.imagePullPolicy = config.imagePullPolicy

  return container
}

const buildPostStartScript = (env: V1EnvVar[], initScript?: string): string => {
  const mapped = env
    .filter((e) => e.value != null)
    .map((e) => `export ${e.name}='${(e.value ?? ``).replace(/'/g, `'\\''`)}'`)
    .join(`\n`)

  const parts = [
    `mkdir -p /etc/profile.d`,
    `cat > ${EnvProfilePath} << 'TDSK_ENV_EOF'`,
    mapped,
    `TDSK_ENV_EOF`,
    `. ${EnvProfilePath}`,
  ]

  // K8s kills the container if postStart exits non-zero — catch failures and log instead
  if (initScript)
    parts.push(
      `sh -c '${initScript.replace(/'/g, `'\\''`)}'; _rc=$?`,
      `if [ $_rc -ne 0 ]; then`,
      `  echo "[tdsk] initScript failed (exit $_rc)" >> /tmp/tdsk-init-error.log`,
      `fi`
    )

  return parts.join(`\n`)
}

const buildEnvVars = (envVars?: Record<string, string>): V1EnvVar[] => {
  if (!envVars) return []
  return Object.entries(envVars).map(([name, value]) => ({ name, value }))
}

const buildPorts = (ports?: Record<string, { protocol: string }>): V1ContainerPort[] => {
  if (!ports) return []
  return Object.entries(ports).map(([port]) => ({
    protocol: `TCP`,
    containerPort: Number(port),
  }))
}
