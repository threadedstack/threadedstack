import type { TTask, TTaskActionArgs } from '@TSCL/types'

import { Logger } from '@tdsk/logger'
import { taskError } from '@TSCL/utils/tasks/error'
import { cleanColl } from '@keg-hub/jsutils/cleanColl'

const s3Act = async (props: TTaskActionArgs) => {
  const { params, tasks, config } = props
  const secretTask = tasks?.kube?.tasks?.secret
  !secretTask &&
    taskError(
      `The "kube.tasks.secret" task can not be found. Ensure it exists before running this command`
    )

  const { bucket, region, endpoint, accessKeyId, secretAccessKey, ...secParams } = params

  const cfg = {
    bucket: bucket || config.envs.TDSK_S3_BUCKET || undefined,
    region: region || config.envs.TDSK_S3_REGION || undefined,
    endpoint: endpoint || config.envs.TDSK_S3_ENDPOINT || undefined,
    accessKeyId: accessKeyId || config.envs.TDSK_S3_ACCESS_KEY_ID || undefined,
    secretAccessKey:
      secretAccessKey || config.envs.TDSK_S3_SECRET_ACCESS_KEY || undefined,
  }

  ;(!cfg.bucket || !cfg.endpoint || !cfg.accessKeyId || !cfg.secretAccessKey) &&
    taskError(`Missing S3 configuration`, undefined, cfg)

  params.log && Logger.pair(`Found valid S3 config values`)

  if (!secretTask?.action) return taskError(`Secret task could not be loaded!`)

  await secretTask.action({
    ...props,
    params: {
      ...secParams,
      name: config.envs.TDSK_KUBE_SCRT_S3_CFG || `tdsk-s3-secret`,
      secrets: Object.entries(cleanColl(cfg))
        .map(([key, value]) => `${key}:${value}`)
        .join(`,`),
    },
  })
}

export const s3: TTask = {
  name: `s3`,
  alias: [`objectstore`, `os`],
  action: s3Act,
  example: `pnpm kube secrets s3 <options>`,
  description: `Creates a kubernetes secret for the S3 object store config`,
  options: {
    bucket: {
      env: `TDSK_S3_BUCKET`,
      description: `S3 bucket name`,
    },
    endpoint: {
      env: `TDSK_S3_ENDPOINT`,
      description: `S3 endpoint URL`,
    },
    accessKeyId: {
      env: `TDSK_S3_ACCESS_KEY_ID`,
      description: `S3 access key ID`,
    },
    secretAccessKey: {
      env: `TDSK_S3_SECRET_ACCESS_KEY`,
      description: `S3 secret access key`,
    },
    region: {
      env: `TDSK_S3_REGION`,
      description: `S3 region (defaults to "auto")`,
    },
    log: {
      default: true,
      type: `boolean`,
      description: `Log the task output`,
    },
  },
}
