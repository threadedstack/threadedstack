import type { TTask, TTaskAction } from '@TSCL/types'
import type { TChangedContexts } from '@TSCL/utils/deploy/changedContexts'
import type { TPreviousImages } from '@TSCL/utils/deploy/verify'

import { Logger } from '@tdsk/logger'
import { spawn } from '@TSCL/utils/proc/spawn'
import { devspace } from '@TSCL/utils/devspace'
import { pushSafe } from '@TSCL/utils/db/pushSafe'
import { reconcileSchedules } from '@TSCL/utils/db/reconcileSchedules'
import { reconcileResident } from '@TSCL/utils/db/reconcileResident'
import { getCtx } from '@TSCL/utils/config/getCtx'
import { kubectl } from '@TSCL/utils/kube/kubectl'
import { docker } from '@TSCL/utils/docker/docker'
import { imageTag } from '@TSCL/utils/deploy/imageTag'
import { taskError } from '@TSCL/utils/tasks/error'
import { sharedOpts } from '@TSCL/utils/tasks/options'
import { preflight } from '@TSCL/utils/deploy/preflight'
import { getKubeMeta } from '@TSCL/utils/kube/getKubeMeta'
import { recordPreviousImages, verifyOrRollback } from '@TSCL/utils/deploy/verify'
import { detectChanges, everything, isNoop } from '@TSCL/utils/deploy/changedContexts'

/** Extracts the tag portion of a full image reference */
const parseTag = (image?: string): string | undefined => image?.split(`:`).pop()

/**
 * Builds the per-context TDSK_*_IMAGE_TAG env map devspace resolves for the
 * production profile. Changed contexts pin to the new SHA tag; unchanged
 * contexts keep the tag they are already running (falling back to `latest`,
 * which every build also pushes) so devspace never points a deployment at an
 * image that was not built.
 */
const deployTagEnvs = (
  changes: TChangedContexts,
  newTag: string,
  previous: TPreviousImages
): Record<string, string> => {
  const resolve = (ctx: string) =>
    changes.docker.includes(ctx) ? newTag : parseTag(previous[ctx]) || `latest`

  return {
    TDSK_IMAGE_TAG: newTag,
    TDSK_PX_IMAGE_TAG: resolve(`proxy`),
    TDSK_BE_IMAGE_TAG: resolve(`backend`),
    TDSK_CADDY_IMAGE_TAG: resolve(`caddy`),
    TDSK_SB_IMAGE_TAG: resolve(`sandbox`),
    TDSK_SB_INIT_IMAGE_TAG: resolve(`init`),
    // The egress service shares the backend image but pins its OWN tag: it
    // advances only when egress-relevant code changed (changes.egress), so a
    // routine backend release never rolls the egress pod (rolling it breaks
    // every running sandbox's egress DNAT until the sandbox is recreated).
    // Bootstrap fallback: with no prior egress deployment, point at the
    // backend's current image so the first deploy always has a real image.
    TDSK_EGRESS_IMAGE_TAG: changes.egress
      ? newTag
      : parseTag(previous[`egress`]) || parseTag(previous[`backend`]) || `latest`,
  }
}

/** Aborts the release when a spawned sub-command exits non-zero */
const ensure = (code: number, label: string) => {
  if (code !== 0) taskError(`${label} failed (exit code ${code})`)
}

const logScope = (changes: TChangedContexts) => {
  Logger.pair(`  Reason`, changes.reason)
  Logger.pair(`  Images`, changes.docker.join(`, `) || `(none)`)
  Logger.pair(`  Frontends`, changes.firebase.join(`, `) || `(none)`)
  Logger.pair(`  DB push`, changes.db ? `yes` : `no`)
  Logger.pair(`  Config deploy`, changes.deployConfig ? `yes` : `no`)
  Logger.pair(`  Egress roll`, changes.egress ? `yes` : `no (tag pinned)`)
}

const releaseAct: TTaskAction = async (args) => {
  const { params, config } = args
  const env = process.env.NODE_ENV || `local`

  if (!params?.confirm && env !== `local`)
    return taskError(
      `Release requires --confirm for non-local environments (target: "${env}")`
    )

  Logger.info(`\n  Resolving changes to deploy for "${env}"...\n`)

  // 1. Determine what changed since the currently-deployed SHA
  const changes = params?.all
    ? everything(`--all flag set — building every target`)
    : await detectChanges(args)

  logScope(changes)

  if (!params?.all && isNoop(changes)) {
    Logger.success(
      `\n  Nothing changed since the deployed version — nothing to deploy.\n`
    )
    return
  }

  const shouldDeploy = changes.docker.length > 0 || changes.deployConfig

  // 2. Compute the SHA image tag (pinned across build + deploy)
  const { sha, tag } = await imageTag()
  Logger.pair(`  Deploy tag`, tag)

  // Dry run: print the plan and render manifests without touching the cluster
  if (params?.dryRun) {
    Logger.info(`\n  Dry run — rendering manifests only (no cluster changes).\n`)
    const tagEnvs = deployTagEnvs(changes, tag, {})
    await devspace.render({
      ...args,
      params: { ...params, envs: { ...(params?.envs || {}), ...tagEnvs } },
    })
    return
  }

  // 3. Preflight — fail fast before any cluster mutation
  const firebaseInScope = params?.firebase !== false && changes.firebase.length > 0
  const dbInScope = params?.database !== false && changes.db
  if (!params?.skipPreflight)
    await preflight(args, { db: dbInScope, firebase: firebaseInScope })

  Logger.info(`\n  Starting release for "${env}" (${tag})...\n`)

  // 4. [1/5] Database schema (only when schema changed)
  if (params?.database && changes.db) {
    Logger.pair(`[1/5]`, `Pushing database schema (additive-only)...`)
    await pushSafe({ config, log: params?.log })
    Logger.success(`[1/5] Database schema pushed.`)
  } else {
    Logger.pair(`[1/5]`, `No schema changes — skipping DB push.`)
  }

  // 5. [2/5] Build + push only the changed images (tagged sha-<short> AND latest)
  if (params?.docker && changes.docker.length) {
    Logger.pair(`[2/5]`, `Building images: ${changes.docker.join(`, `)}`)
    ensure(await docker.login(args), `docker login`)
    for (const name of changes.docker) {
      Logger.pair(`  Building`, `${name} (${tag})`)
      const ctx = getCtx({ ...args, params: { ...params, context: name } })
      ctx.tag = tag
      ensure(
        await docker.build({
          ...args,
          ctx,
          params: {
            ...params,
            push: true,
            tag: [`latest`],
            // Prod nodes are ALL amd64 — building arm64 under QEMU emulation
            // roughly doubled the release's build time for an arch nothing
            // runs. Override with --platforms if arm nodes ever join the
            // cluster; local multi-arch dev builds (`tdsk docker build`) keep
            // their own dual-platform default.
            platforms: params?.platforms || [`linux/amd64`],
          },
        }),
        `docker build ${name}`
      )
    }
    Logger.success(`[2/5] Images built and pushed.`)
  } else {
    Logger.pair(`[2/5]`, `No image changes — skipping build.`)
  }

  // 6. [3/5] Deploy to Kubernetes.
  // Record current images first — used both to pin unchanged services to the
  // tag they are already running and as the rollback baseline. Always recorded
  // (independent of --verify) so tag pinning is correct even when verify is off.
  let previous: TPreviousImages = {}
  if (shouldDeploy && params?.deploy) {
    previous = await recordPreviousImages(args)

    Logger.pair(`[3/5]`, `Deploying to Kubernetes...`)
    const tagEnvs = deployTagEnvs(changes, tag, previous)
    ensure(
      await devspace.deploy({
        ...args,
        params: { ...params, envs: { ...(params?.envs || {}), ...tagEnvs } },
      }),
      `devspace deploy`
    )
    Logger.success(`[3/5] Deploy applied.`)

    // Config-only deploys with no rebuilt in-cluster image may not roll pods
    // (e.g. a ConfigMap-only change) — force them to re-read config.
    const inClusterChanged = changes.docker.filter((ctx) =>
      config.release.restart.includes(ctx)
    )
    if (params?.restart && !inClusterChanged.length && changes.deployConfig) {
      Logger.pair(
        `  Restarting`,
        `${config.release.restart.join(`, `)} for config change`
      )
      const meta = getKubeMeta(args, false)
      const nsArgs = meta.namespace ? [`--namespace`, meta.namespace] : []
      for (const name of config.release.restart) {
        const ctx = getCtx({ ...args, params: { ...params, context: name } })
        if (!ctx.deployment) continue
        await kubectl.delete.pod(args, [
          `-l`,
          `app.kubernetes.io/component=${ctx.deployment}`,
          ...nsArgs,
        ])
      }
    }
  } else {
    Logger.pair(`[3/5]`, `No cluster changes — skipping deploy.`)
  }

  // 7. [4/5] Verify health, roll back on failure
  if (shouldDeploy && params?.deploy && params?.verify !== false) {
    Logger.pair(`[4/5]`, `Verifying deployment health...`)
    await verifyOrRollback(args, previous)
  } else {
    Logger.pair(`[4/5]`, `Health verification skipped.`)
  }

  // 7b. [sync] Reconcile the agent's own operating schedules (prompts + cadence)
  // from git-versioned config. Runs on every real release — independent of
  // shouldDeploy — so a prompt-only change (which does not rebuild the cluster)
  // still applies. Non-fatal: a reconcile hiccup never rolls back a healthy
  // deploy, and the next release retries.
  if (params?.database !== false) {
    Logger.pair(`[sync]`, `Reconciling agent schedules from repo...`)
    await reconcileSchedules({ config, log: params?.log })
    Logger.pair(`[sync]`, `Reconciling resident data plane from repo...`)
    await reconcileResident({ config, log: params?.log })
  } else {
    Logger.pair(`[sync]`, `Schedule + resident reconcile skipped (--no-database).`)
  }

  // 8. [5/5] Build + deploy only the changed frontends via Firebase
  if (params?.firebase && changes.firebase.length) {
    Logger.pair(`[5/5]`, `Building frontends: ${changes.firebase.join(`, `)}`)
    for (const app of changes.firebase) {
      Logger.pair(`  Building`, `@tdsk/${app}`)
      ensure(
        await spawn({
          cmd: `pnpm`,
          log: params?.log,
          args: [`--filter`, `@tdsk/${app}`, `build`],
          cwd: config.paths.root,
        }),
        `frontend build @tdsk/${app}`
      )
    }
    const only = changes.firebase.map((app) => `hosting:${app}`).join(`,`)
    Logger.pair(`  Deploying`, `Firebase (${only})`)
    ensure(
      await spawn({
        cmd: `firebase`,
        log: params?.log,
        args: [`deploy`, `--only`, only, `--project`, `threaded-stack-prod`],
        cwd: config.paths.root,
      }),
      `firebase deploy`
    )
    Logger.success(`[5/5] Firebase deploy complete.`)
  } else {
    Logger.pair(`[5/5]`, `No frontend changes — skipping Firebase.`)
  }

  Logger.success(`\n  Release complete for "${env}" (${sha}).\n`)
}

export const release: TTask = {
  name: `release`,
  alias: [`rel`],
  action: releaseAct,
  example: `tdsk release --env production --confirm`,
  description: `Deploy the latest changes: detect changed contexts, build+push SHA-tagged images, push DB schema, deploy, verify health (auto-rollback), and deploy changed frontends`,
  options: {
    confirm: {
      type: `boolean`,
      alias: [`force`, `yes`, `y`],
      description: `Confirm the release (required for non-local environments)`,
    },
    log: sharedOpts.shared.log,
    all: {
      type: `boolean`,
      alias: [`full`, `rebuild`],
      description: `Build and deploy every target, skipping change detection`,
    },
    skipPreflight: {
      type: `boolean`,
      alias: [`sp`],
      description: `Skip preflight prerequisite checks`,
    },
    dryRun: {
      type: `boolean`,
      alias: [`dry`, `render`],
      description: `Print the deploy plan and render manifests without applying`,
    },
    verify: {
      type: `boolean`,
      default: true,
      description: `Verify health after deploy and auto-rollback on failure (--no-verify to skip)`,
    },
    database: {
      type: `boolean`,
      default: true,
      alias: [`db`],
      description: `Push database schema when schema changed (--no-database to skip)`,
    },
    docker: {
      type: `boolean`,
      default: true,
      alias: [`dc`],
      description: `Build and push changed images (--no-docker to skip)`,
    },
    deploy: {
      type: `boolean`,
      default: true,
      alias: [`dep`],
      description: `Apply the Kubernetes deployment (--no-deploy to skip)`,
    },
    restart: {
      type: `boolean`,
      default: true,
      alias: [`rt`],
      description: `Restart pods for config-only deploys (--no-restart to skip)`,
    },
    firebase: {
      type: `boolean`,
      default: true,
      alias: [`fb`],
      description: `Build and deploy changed frontends via Firebase (--no-firebase to skip)`,
    },
    platforms: {
      type: `array`,
      alias: [`plat`],
      example: `--platforms linux/amd64,linux/arm64`,
      description: `Image build platforms (default linux/amd64 — prod nodes are amd64-only)`,
    },
    namespace: sharedOpts.devspace.namespace,
    kubeContext: sharedOpts.devspace.kubeContext,
  },
}
