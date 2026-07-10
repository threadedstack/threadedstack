import type { TTask, TTaskActionArgs } from '@TSCL/types'

import { Logger } from '@tdsk/logger'
import { taskError } from '@TSCL/utils/tasks/error'

/**
 * Create the read-only, secrets-scoped database secret for the standalone
 * egress service (`tdsk-egress`). The egress MITM terminates TLS for
 * untrusted sandbox traffic, so it must NOT get the backend's full-access
 * database credentials — only a role limited to SELECT on the secrets table.
 *
 * The URL should point at a role provisioned like:
 *   CREATE ROLE tdsk_egress_ro WITH LOGIN PASSWORD '...';
 *   GRANT USAGE ON SCHEMA public TO tdsk_egress_ro;
 *   GRANT SELECT ON public.secrets TO tdsk_egress_ro;
 */
const databaseEgressAct = async (props: TTaskActionArgs) => {
  const { params, tasks, config } = props
  const secretTask = tasks?.kube?.tasks?.secret
  !secretTask &&
    taskError(
      `The "kube.tasks.secret" task can not be found. Ensure it exists before running this command`
    )

  const { url, ...secParams } = params
  const dbUrl = url || config.envs.TDSK_DB_EGRESS_URL

  !dbUrl &&
    taskError(
      `Missing egress database url — pass --url or set TDSK_DB_EGRESS_URL (a read-only, secrets-scoped role; never the backend's credentials)`
    )

  params.log && Logger.pair(`Found valid egress database config values`)

  if (!secretTask?.action) return taskError(`Secret task could not be loaded!`)

  await secretTask.action({
    ...props,
    params: {
      ...secParams,
      name: config.envs.TDSK_KUBE_SCRT_DB_EGRESS || `tdsk-database-egress`,
      secrets: `url:${dbUrl}`,
    },
  })
}

export const databaseEgress: TTask = {
  name: `database-egress`,
  alias: [`db-egress`, `dbe`],
  action: databaseEgressAct,
  example: `tdsk kube secret database-egress <options>`,
  description: `Creates the read-only secrets-scoped database secret for the egress service`,
  options: {
    url: {
      env: `TDSK_DB_EGRESS_URL`,
      description: `Read-only, secrets-scoped database url for the egress service`,
    },
    log: {
      default: true,
      type: `boolean`,
      description: `Log the task output`,
    },
  },
}
