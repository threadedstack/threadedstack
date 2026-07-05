import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'

/**
 * Offline render tests for the staging profile (P4e E1).
 * Uses `helm template` — no kube context required.
 *
 * Assertions:
 * 1. TDSK_KUBE_NAMESPACE renders as "tdsk-staging" (not "tdsk-production")
 * 2. Staging hostnames contain the "staging" prefix
 * 3. spec.replicas is 1 for every chart render
 * 4. No production hostname leaks into the staging render
 * 5. Negative control: production values still render TDSK_KUBE_NAMESPACE as "tdsk-production"
 */

const DEPLOY_DIR = resolve(__dirname, `../../../../../deploy`)

/**
 * Render the helm chart with the given values files and return the full YAML string.
 * Mirrors the pattern from helmRbac.test.ts — pure offline `helm template`.
 */
const renderChart = (
  releaseName: string,
  valuesFiles: string[],
  extraSets: string[] = []
): string => {
  const args: string[] = [
    `template`,
    releaseName,
    `./`,
    // values files are layered last-wins (empty → base → env-specific)
    ...valuesFiles.flatMap((f) => [`-f`, f]),
    ...extraSets.flatMap((s) => [`--set`, s]),
  ]
  return execFileSync(`helm`, args, { cwd: DEPLOY_DIR, encoding: `utf8` })
}

/** Minimal container set needed for a non-empty render */
const minimalContainerSets = (name: string, image: string): string[] => [
  `containers[0].name=${name}`,
  `containers[0].image=${image}`,
]

/** Extract all "value: ..." lines that follow a "name: KEY" line */
const extractEnvValue = (yaml: string, key: string): string | undefined => {
  const nameIdx = yaml.indexOf(`name: ${key}`)
  if (nameIdx === -1) return undefined
  const after = yaml.slice(nameIdx)
  const valueMatch = after.match(/value:\s*"?([^"\n]+)"?/)
  return valueMatch ? valueMatch[1].trim() : undefined
}

/** Extract all host values from rendered Ingress or Caddy env vars */
const extractAllHostEnvValues = (yaml: string): string[] => {
  const hostKeys = [
    `TDSK_CADDY_PX_HOST`,
    `TDSK_PX_URL`,
    `TDSK_BE_URL`,
    `TDSK_AD_APP_URL`,
    `TDSK_TH_APP_URL`,
    `TDSK_SB_DOMAIN`,
  ]
  return hostKeys
    .map((k) => extractEnvValue(yaml, k))
    .filter((v): v is string => v !== undefined)
}

// Production hostname strings that must NOT appear in a staging render
const PROD_PRIMARY_HOST = `px.threadedstack.app`
const PROD_NAMESPACE = `tdsk-production`

describe(`staging values render (P4e E1)`, () => {
  // Shared staging render — tdsk-backend is the richest chart (reads values.yaml env block)
  const stagingOutput = renderChart(
    `test-staging-backend`,
    [`values.empty.yaml`, `values.yaml`, `values.staging.yaml`],
    minimalContainerSets(`tdsk-backend`, `ghcr.io/threadedstack/tdsk-backend:latest`)
  )

  describe(`1. Namespace env var`, () => {
    it(`TDSK_KUBE_NAMESPACE renders as tdsk-staging`, () => {
      const ns = extractEnvValue(stagingOutput, `TDSK_KUBE_NAMESPACE`)
      expect(ns).toBe(`tdsk-staging`)
    })

    it(`TDSK_KUBE_NAMESPACE does NOT render as tdsk-production`, () => {
      const ns = extractEnvValue(stagingOutput, `TDSK_KUBE_NAMESPACE`)
      expect(ns).not.toBe(PROD_NAMESPACE)
    })
  })

  describe(`2. Staging hostnames contain staging prefix`, () => {
    it(`TDSK_CADDY_PX_HOST contains "staging"`, () => {
      const host = extractEnvValue(stagingOutput, `TDSK_CADDY_PX_HOST`)
      expect(host).toBeDefined()
      expect(host).toContain(`staging`)
    })

    it(`TDSK_PX_URL contains "staging"`, () => {
      const url = extractEnvValue(stagingOutput, `TDSK_PX_URL`)
      expect(url).toBeDefined()
      expect(url).toContain(`staging`)
    })

    it(`TDSK_BE_URL contains "staging"`, () => {
      const url = extractEnvValue(stagingOutput, `TDSK_BE_URL`)
      expect(url).toBeDefined()
      expect(url).toContain(`staging`)
    })

    it(`TDSK_SB_DOMAIN contains "staging"`, () => {
      const domain = extractEnvValue(stagingOutput, `TDSK_SB_DOMAIN`)
      expect(domain).toBeDefined()
      expect(domain).toContain(`staging`)
    })
  })

  describe(`3. spec.replicas is 1`, () => {
    it(`backend chart renders with replicas: 1`, () => {
      // The helm template renders "replicas: 1" (the default); verify it is present
      expect(stagingOutput).toContain(`replicas: 1`)
    })

    it(`caddy chart renders with replicas: 1`, () => {
      const caddyOutput = renderChart(
        `test-staging-caddy`,
        [`values.empty.yaml`, `values.yaml`, `values.staging.yaml`],
        minimalContainerSets(`tdsk-caddy`, `ghcr.io/threadedstack/tdsk-caddy:latest`)
      )
      expect(caddyOutput).toContain(`replicas: 1`)
    })

    it(`proxy chart renders with replicas: 1`, () => {
      const proxyOutput = renderChart(
        `test-staging-proxy`,
        [`values.empty.yaml`, `values.yaml`, `values.staging.yaml`],
        minimalContainerSets(`tdsk-proxy`, `ghcr.io/threadedstack/tdsk-proxy:latest`)
      )
      expect(proxyOutput).toContain(`replicas: 1`)
    })

    it(`embeddings chart renders with replicas: 1`, () => {
      const embOutput = renderChart(
        `test-staging-emb`,
        [`values.empty.yaml`, `values.staging.yaml`],
        [
          `containers[0].name=tdsk-embeddings`,
          `containers[0].image=ghcr.io/huggingface/text-embeddings-inference:cpu-1.6`,
          `containers[0].resources.requests.cpu=500m`,
          `containers[0].resources.requests.memory=2Gi`,
          `containers[0].resources.limits.cpu=2`,
          `containers[0].resources.limits.memory=6Gi`,
          `volumes[0].name=tdsk-emb-cache`,
          `volumes[0].size=10Gi`,
          `containers[0].volumeMounts[0].containerPath=/data`,
          `containers[0].volumeMounts[0].volume.name=tdsk-emb-cache`,
        ]
      )
      expect(embOutput).toContain(`replicas: 1`)
    })
  })

  describe(`4. No production hostname collision`, () => {
    it(`staging render does not contain the production primary host (${PROD_PRIMARY_HOST})`, () => {
      const hosts = extractAllHostEnvValues(stagingOutput)
      for (const host of hosts) {
        expect(host).not.toBe(PROD_PRIMARY_HOST)
        expect(host).not.toContain(PROD_PRIMARY_HOST)
      }
    })

    it(`staging render env vars do not contain the string "px.threadedstack.app" (prod Caddy host)`, () => {
      // Broad scan: the exact production primary host must not appear anywhere in env value positions
      const nameIndices: number[] = []
      let idx = stagingOutput.indexOf(`TDSK_CADDY_PX_HOST`)
      while (idx !== -1) {
        nameIndices.push(idx)
        idx = stagingOutput.indexOf(`TDSK_CADDY_PX_HOST`, idx + 1)
      }
      for (const start of nameIndices) {
        const slice = stagingOutput.slice(start, start + 200)
        expect(slice).not.toContain(`"px.threadedstack.app"`)
      }
    })
  })

  describe(`5. Negative control: production render is unaffected`, () => {
    it(`production values render TDSK_KUBE_NAMESPACE as tdsk-production`, () => {
      const prodOutput = renderChart(
        `test-prod-backend`,
        [`values.empty.yaml`, `values.yaml`, `values.production.yaml`],
        minimalContainerSets(`tdsk-backend`, `ghcr.io/threadedstack/tdsk-backend:latest`)
      )
      const ns = extractEnvValue(prodOutput, `TDSK_KUBE_NAMESPACE`)
      expect(ns).toBe(PROD_NAMESPACE)
    })

    it(`production values render TDSK_CADDY_PX_HOST as the production hostname`, () => {
      const prodOutput = renderChart(
        `test-prod-backend`,
        [`values.empty.yaml`, `values.yaml`, `values.production.yaml`],
        minimalContainerSets(`tdsk-backend`, `ghcr.io/threadedstack/tdsk-backend:latest`)
      )
      const host = extractEnvValue(prodOutput, `TDSK_CADDY_PX_HOST`)
      expect(host).toBe(PROD_PRIMARY_HOST)
    })

    it(`production values do NOT contain the string "staging"`, () => {
      const prodOutput = renderChart(
        `test-prod-backend`,
        [`values.empty.yaml`, `values.yaml`, `values.production.yaml`],
        minimalContainerSets(`tdsk-backend`, `ghcr.io/threadedstack/tdsk-backend:latest`)
      )
      const ns = extractEnvValue(prodOutput, `TDSK_KUBE_NAMESPACE`)
      const host = extractEnvValue(prodOutput, `TDSK_CADDY_PX_HOST`)
      expect(ns).not.toContain(`staging`)
      expect(host).not.toContain(`staging`)
    })
  })
})
