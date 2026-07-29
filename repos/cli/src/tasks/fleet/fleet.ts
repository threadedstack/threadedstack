import type { TTask, TTaskAction } from '@TSCL/types'

import { Logger } from '@tdsk/logger'
import { spawn } from '@TSCL/utils/proc/spawn'

/**
 * `tdsk fleet on | off | status` — one command to toggle the autonomous AI
 * agent fleet (the token-burning part of the system) without touching the
 * platform (backend / proxy / caddy / egress / admin / threads keep serving).
 *
 * The fleet = 6 always-on RESIDENT agents (CEO, CMO, CTO-lead, 3 engineers),
 * the steward/CTO-board SCHEDULES, and two GitHub workflows (health alerts +
 * update-behind-prs). All of it is DB + workflow state, so the toggle flips
 * exactly that. The single implementation lives in the database package
 * (`repos/database/scripts/toggleFleet.ts`), which reads the prod DB URL from
 * the `tdsk-db-cfg` k8s secret itself (no credential export). This task is a
 * thin, discoverable wrapper so there is one source of truth, not two.
 *
 * NOTE: "off" is live DB/workflow state, not a seed change. A full
 * `tdsk release` / merge-to-main deploy re-runs the reconcile and turns the
 * fleet back ON, so re-run `tdsk fleet off` after any deploy while it should
 * stay down.
 */
type TMode = `on` | `off` | `status`

const toggle =
  (mode: TMode): TTaskAction =>
  async () => {
    const code = await spawn({
      cmd: `pnpm`,
      args: [`--filter`, `@tdsk/database`, `run`, `fleet:${mode}`],
      output: true,
      log: true,
    })
    if (code !== 0) {
      Logger.error(`\n[tdsk fleet] "${mode}" failed (exit ${code})`)
      process.exit(code || 1)
    }
  }

export const fleet: TTask = {
  name: `fleet`,
  description: `Toggle the autonomous AI agent fleet (residents + schedules + gh alerts) on/off`,
  example: `tdsk fleet off | tdsk fleet on | tdsk fleet status`,
  tasks: {
    on: {
      name: `on`,
      alias: [`up`, `enable`],
      description: `Spin the fleet UP — 6 residents boot in ~60s, schedules fire next cron, gh workflows re-enabled`,
      example: `tdsk fleet on`,
      action: toggle(`on`),
    },
    off: {
      name: `off`,
      alias: [`down`, `disable`],
      description: `Stand the fleet DOWN — stops residents + schedules + gh alerts. Platform keeps serving`,
      example: `tdsk fleet off`,
      action: toggle(`off`),
    },
    status: {
      name: `status`,
      alias: [`state`, `st`],
      description: `Print current fleet state (residents / schedules / pods / workflows). Read-only`,
      example: `tdsk fleet status`,
      action: toggle(`status`),
    },
  },
}
