import type { TTaskActionArgs } from '@TSCL/types'

import { capture } from '@TSCL/utils/proc/capture'
import { getKubeMeta } from '@TSCL/utils/kube/getKubeMeta'

export type TChangedContexts = {
  /** Image contexts that need a docker build + push */
  docker: string[]
  /** Frontend apps that need a Firebase build + deploy */
  firebase: string[]
  /** True when database schema files changed */
  db: boolean
  /** True when deploy config (helm templates/values/devspace) changed — deploy without rebuilding */
  deployConfig: boolean
  /** The deployed SHA the diff was taken against (undefined when unknown) */
  baseline?: string
  /** Human readable explanation of how targets were selected */
  reason: string
}

/** Canonical build order — matches config.release.docker */
export const ALL_DOCKER = [`caddy`, `proxy`, `backend`, `sandbox`, `init`, `jobs`]
/** Canonical frontend order — matches config.release.firebase */
export const ALL_FIREBASE = [`admin`, `threads`, `website`]

/**
 * Pure mapping of changed file paths to build targets.
 * Mirrors the change-detection logic in .github/workflows/deploy-production.yml
 * so the CLI and CI select the same contexts.
 */
export const mapChangedFiles = (
  files: string[]
): Pick<TChangedContexts, `docker` | `firebase` | `db` | `deployConfig`> => {
  const docker = new Set<string>()
  const firebase = new Set<string>()
  let db = false

  const has = (re: RegExp) => files.some((file) => re.test(file))

  // Shared backend deps (domain, database, logger) rebuild both proxy + backend
  if (has(/^repos\/(domain|database|logger)\//)) {
    docker.add(`proxy`)
    docker.add(`backend`)
  }

  if (has(/^(repos\/proxy\/|deploy\/Dockerfile\.proxy)/)) docker.add(`proxy`)

  // agent + sandbox repos are bundled into the backend image
  if (has(/^(repos\/(backend|agent|sandbox)\/|deploy\/Dockerfile\.backend)/))
    docker.add(`backend`)

  if (has(/^deploy\/(Caddyfile|Dockerfile\.caddy)/)) docker.add(`caddy`)
  // sandbox-entrypoint.sh is COPY'd into the sandbox image, so a change to it
  // must rebuild the sandbox image just like the Dockerfile itself. The jobs
  // image extends sandbox, so it cascades on the same triggers.
  if (has(/^deploy\/(Dockerfile\.sandbox|sandbox-entrypoint\.sh)/)) {
    docker.add(`sandbox`)
    docker.add(`jobs`)
  }
  if (has(/^deploy\/Dockerfile\.init/)) docker.add(`init`)
  // jobs image bakes in a repo clone + pnpm install, so it must rebuild on
  // its own Dockerfile OR any lockfile/workspace package.json change (root
  // lock is already handled by the "rebuild everything" rule below).
  if (has(/^deploy\/Dockerfile\.jobs/)) docker.add(`jobs`)
  if (has(/^repos\/[^/]+\/package\.json$/)) docker.add(`jobs`)

  // Database schema changes require a schema push before backend deploy
  if (has(/^repos\/database\/src\/schemas\//)) db = true

  // Frontend apps (Firebase)
  if (has(/^repos\/admin\//)) firebase.add(`admin`)
  if (has(/^repos\/threads\//)) firebase.add(`threads`)
  if (has(/^repos\/website\//)) firebase.add(`website`)
  // Shared frontend deps rebuild every SPA
  if (has(/^repos\/(components|domain)\//))
    ALL_FIREBASE.forEach((app) => firebase.add(app))

  // Root-level shared files affect every image and every frontend
  if (has(/^(pnpm-lock\.yaml|package\.json|tsconfig\.json|\.npmrc)$/)) {
    ALL_DOCKER.forEach((ctx) => docker.add(ctx))
    ALL_FIREBASE.forEach((app) => firebase.add(app))
  }

  // Deploy config (helm templates, values, devspace) — redeploy without rebuilding images
  const deployConfig = has(/^deploy\/(templates\/|devspace\.yaml|values)/)

  return {
    docker: ALL_DOCKER.filter((ctx) => docker.has(ctx)),
    firebase: ALL_FIREBASE.filter((app) => firebase.has(app)),
    db,
    deployConfig,
  }
}

/** Every target — used as the safe fallback when a diff can't be computed */
export const everything = (reason: string): TChangedContexts => ({
  docker: [...ALL_DOCKER],
  firebase: [...ALL_FIREBASE],
  db: true,
  deployConfig: true,
  reason,
})

/** True when the changeset selects no build/deploy work at all */
export const isNoop = (changes: TChangedContexts): boolean =>
  !changes.docker.length &&
  !changes.firebase.length &&
  !changes.db &&
  !changes.deployConfig

/**
 * Reads the git SHA currently deployed to the cluster from the backend
 * deployment's running image tag (expects a `sha-<short>` tag). Returns
 * undefined when the deployment is missing or not tagged with a SHA.
 */
export const deployedSha = async (
  props: TTaskActionArgs
): Promise<string | undefined> => {
  const meta = getKubeMeta(props, false)
  const deployment = props.config.envs.TDSK_BE_DEPLOYMENT || `tdsk-backend`

  const args = [
    ...(meta.context ? [`--context`, meta.context] : []),
    ...(meta.namespace ? [`-n`, meta.namespace] : []),
    `get`,
    `deployment`,
    deployment,
    `-o`,
    `jsonpath={.spec.template.spec.containers[0].image}`,
  ]

  const { code, output } = await capture(`kubectl`, args)
  if (code !== 0 || !output) return undefined

  const tag = output.split(`:`).pop() || ``
  const matched = tag.match(/^sha-([0-9a-f]{7,40})$/)

  return matched ? matched[1] : undefined
}

/**
 * Determines which contexts changed since the currently-deployed SHA.
 * Falls back to building everything (and logs why) when the baseline SHA
 * is unknown, not in local git history, or the diff fails — never silently
 * under-builds.
 */
export const detectChanges = async (
  props: TTaskActionArgs
): Promise<TChangedContexts> => {
  const baseline = await deployedSha(props)
  if (!baseline)
    return everything(
      `Could not determine the currently-deployed SHA (backend deployment missing or not tagged "sha-*") — building all targets`
    )

  const known = await capture(`git`, [`cat-file`, `-e`, `${baseline}^{commit}`])
  if (known.code !== 0)
    return everything(
      `Deployed SHA "${baseline}" is not in local git history (fetch/pull first) — building all targets`
    )

  const diff = await capture(`git`, [`diff`, `--name-only`, baseline, `HEAD`])
  if (diff.code !== 0)
    return everything(`git diff against "${baseline}" failed — building all targets`)

  const files = diff.output
    .split(`\n`)
    .map((file) => file.trim())
    .filter(Boolean)

  return {
    ...mapChangedFiles(files),
    baseline,
    reason: `Diff ${baseline}..HEAD (${files.length} file${files.length === 1 ? `` : `s`} changed)`,
  }
}
