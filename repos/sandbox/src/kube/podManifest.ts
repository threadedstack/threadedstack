import type { TKubeSandboxConfig } from '@tdsk/domain'
import type { TBuildPodOpts, TBuildPodMeta, TPodEgressOpts } from '@TSB/types'
import type {
  V1Pod,
  V1EnvVar,
  V1Container,
  V1ContainerPort,
} from '@kubernetes/client-node'

import { customAlphabet } from 'nanoid'
import { KubeSBPrefix, PodLabelKeys, PodAnnotationKeys } from '@TSB/constants/kube'
import { DefaultWorkdir, VolumeMountName, CACertMountPath } from '@TSB/constants/values'

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
  const { orgId, userId, sandbox, extraEnv, projectId, egressOpts, placeholders } = opts

  const config = sandbox.config
  const podName = buildPodName(sandbox.id)
  const subdomain = podName.replace(`tdsk-`, ``)

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
      initContainers: [buildInitContainer(egressOpts)],
      containers: [buildSandboxContainer(config, extraEnv)],
      volumes: [
        {
          name: VolumeMountName,
          secret: { secretName: egressOpts.certSecretName },
        },
      ],
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
  const { serviceName, servicePort, serviceIp } = opts
  return {
    image: `alpine`,
    name: `proxy-redirect`,
    securityContext: {
      capabilities: {
        add: [`NET_ADMIN`],
      },
    },
    command: [
      `sh`,
      `-c`,
      [
        `apk add --no-cache iptables`,
        serviceIp
          ? `EGRESS_IP="${serviceIp}"`
          : `EGRESS_IP=$(getent hosts ${serviceName} | awk '{print $1}')`,
        `iptables -t nat -A OUTPUT -p tcp --dport 80 -j DNAT --to-destination $EGRESS_IP:${servicePort}`,
        `iptables -t nat -A OUTPUT -p tcp --dport 443 -j DNAT --to-destination $EGRESS_IP:${servicePort}`,
      ].join(` && `),
    ],
  }
}

const buildSandboxContainer = (
  config: TKubeSandboxConfig,
  extraEnv?: Record<string, string>
): V1Container => {
  const env: V1EnvVar[] = [
    { name: `NODE_EXTRA_CA_CERTS`, value: CACertMountPath },
    ...buildEnvVars(config.envVars),
    ...buildEnvVars(extraEnv),
  ]

  const ports = buildPorts(config.ports)
  if (config.sshEnabled !== false) {
    const hasSSHPort = ports.some((p) => p.containerPort === 2222)
    if (!hasSSHPort) {
      ports.push({ protocol: `TCP`, containerPort: 2222 })
    }
  }

  const container: V1Container = {
    env,
    ports,
    name: `sandbox`,
    image: config.image,
    resources: config.resources || {},
    workingDir: config.workdir || DefaultWorkdir,
    securityContext: {
      privileged: false,
      allowPrivilegeEscalation: false,
    },
    volumeMounts: [
      {
        subPath: `tls.crt`,
        name: VolumeMountName,
        mountPath: CACertMountPath,
      },
    ],
  }

  if (config.args) container.args = config.args
  container.command = config.command || [`sleep`, `infinity`]
  if (config.imagePullPolicy) container.imagePullPolicy = config.imagePullPolicy

  return container
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
