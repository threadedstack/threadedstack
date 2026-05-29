import type { TTask, TTaskAction } from '@TSCL/types'

import { Logger } from '@tdsk/logger'
import { spawn } from '@TSCL/utils/proc/spawn'
import { devspace } from '@TSCL/utils/devspace'
import { dbSpawn } from '@TSCL/utils/db/dbSpawn'
import { getCtx } from '@TSCL/utils/config/getCtx'
import { kubectl } from '@TSCL/utils/kube/kubectl'
import { docker } from '@TSCL/utils/docker/docker'
import { taskError } from '@TSCL/utils/tasks/error'
import { sharedOpts } from '@TSCL/utils/tasks/options'
import { getKubeMeta } from '@TSCL/utils/kube/getKubeMeta'

const releaseAct: TTaskAction = async (args) => {
  const { params, config } = args
  const env = process.env.NODE_ENV || `local`

  if (!params?.confirm && env !== `local`) {
    Logger.warn(`\n  This will run the full release pipeline for "${env}":`)
    Logger.warn(`    1. Push database schema`)
    Logger.warn(
      `    2. Build and push Docker images (${config.release.docker.join(`, `)})`
    )
    Logger.warn(`    3. Deploy to Kubernetes`)
    Logger.warn(`    4. Restart pods (${config.release.restart.join(`, `)})`)
    Logger.warn(`    5. Build and deploy frontends via Firebase`)
    Logger.warn(`\n  Pass --confirm to proceed.\n`)
    return taskError(`Release requires --confirm for non-local environments`)
  }

  Logger.info(`\n  Starting release for "${env}"...\n`)

  if (params?.database) {
    Logger.pair(`[1/5]`, `Pushing database schema...`)
    await dbSpawn({ script: `push`, log: params?.log, config })
    Logger.success(`[1/5] Database schema pushed.`)
  }

  if (params?.docker) {
    Logger.pair(`[2/5]`, `Building and pushing Docker images...`)
    await docker.login(args)
    for (const name of config.release.docker) {
      Logger.pair(`  Building`, name)
      try {
        const ctx = getCtx({ ...args, params: { ...params, context: name } })
        await docker.build({
          ...args,
          ctx,
          params: {
            ...params,
            push: true,
            platforms: params?.platforms || [`linux/amd64`, `linux/arm64`],
          },
        })
      } catch (err) {
        Logger.error(err)
        throw err
      }
    }
    Logger.success(`[2/5] All images built and pushed.`)
  }

  if (params?.deploy) {
    Logger.pair(`[3/5]`, `Deploying to Kubernetes...`)
    await devspace.deploy(args)
    Logger.success(`[3/5] Kubernetes deployment complete.`)
  }

  if (params?.restart) {
    Logger.pair(`[4/5]`, `Restarting pods...`)
    const meta = getKubeMeta(args, false)
    const nsArgs = meta.namespace ? [`--namespace`, meta.namespace] : []
    for (const name of config.release.restart) {
      const ctx = getCtx({ ...args, params: { ...params, context: name } })
      if (!ctx.deployment) continue
      Logger.pair(`  Restarting`, name)
      await kubectl.delete.pod(args, [
        `-l`,
        `app.kubernetes.io/component=${ctx.deployment}`,
        ...nsArgs,
      ])
    }
    Logger.success(`[4/5] Pods restarted.`)
  }

  if (params?.firebase) {
    Logger.pair(`[5/5]`, `Building frontends and deploying to Firebase...`)
    for (const app of config.release.firebase) {
      Logger.pair(`  Building`, `@tdsk/${app}`)
      await spawn({
        cmd: `pnpm`,
        log: params?.log,
        args: [`--filter`, `@tdsk/${app}`, `build`],
        cwd: config.paths.root,
      })
    }
    Logger.pair(`  Deploying`, `Firebase hosting...`)
    await spawn({
      cmd: `firebase`,
      log: params?.log,
      args: [`deploy`, `--only`, `hosting`, `--project`, `threaded-stack-prod`],
      cwd: config.paths.root,
    })
    Logger.success(`[5/5] Firebase deploy complete.`)
  }

  Logger.success(`\n  Release complete for "${env}".\n`)
}

export const release: TTask = {
  name: `release`,
  alias: [`rel`],
  action: releaseAct,
  example: `tdsk release --env production --confirm`,
  description: `Full production release: db push, docker build+push, k8s deploy, pod restart, firebase deploy`,
  options: {
    confirm: {
      type: `boolean`,
      alias: [`force`, `yes`, `y`],
      description: `Confirm the release (required for non-local environments)`,
    },
    log: sharedOpts.shared.log,
    database: {
      type: `boolean`,
      default: true,
      alias: [`db`],
      description: `Skip the database schema push step`,
    },
    docker: {
      type: `boolean`,
      default: true,
      alias: [`dc`],
      description: `Skip Docker image build and push step`,
    },
    deploy: {
      type: `boolean`,
      default: true,
      alias: [`dep`],
      description: `Skip Kubernetes deployment via DevSpace`,
    },
    restart: {
      type: `boolean`,
      default: true,
      alias: [`rt`],
      description: `Skip pod restart step`,
    },
    firebase: {
      type: `boolean`,
      default: true,
      alias: [`fb`],
      description: `Skip frontend build and Firebase deploy step`,
    },
    namespace: sharedOpts.devspace.namespace,
    kubeContext: sharedOpts.devspace.kubeContext,
  },
}
