/**
 * toggleFleet — one command to stand the autonomous AI agent fleet DOWN or bring
 * it back UP, without touching the platform (backend / proxy / caddy / egress /
 * admin / threads all keep serving).
 *
 * The fleet is the token-burning part of the system:
 *   • 6 always-on "resident" agents (CEO, CMO, CTO-lead, 3 engineers) — each an
 *     always-running K8s pod booted by the resident WATCHDOG loop inside the
 *     backend. The watchdog boots a resident only while its body sandbox carries
 *     `config.resident`; clear that flag (+ delete the live pod) and it stops and
 *     is never re-booted.
 *   • The steward/CTO-board SCHEDULES (sensor, verify, cto-board, reflection,
 *     curation) — cron rows the scheduler loop fires. `enabled=false` stops them.
 *   • Two GitHub workflows (system-monitor health alerts + update-behind-prs).
 *
 * Everything the fleet needs is DB + workflow state, so this flips exactly that.
 * It reads the prod DB URL straight from the `tdsk-db-cfg` k8s secret, so you
 * never export credentials — just run it.
 *
 *   pnpm fleet:off      # or: tsx scripts/toggleFleet.ts --off
 *   pnpm fleet:on       # or: tsx scripts/toggleFleet.ts --on
 *   pnpm fleet:status   # or: tsx scripts/toggleFleet.ts --status   (read-only)
 *
 * ⚠ A full `tdsk release` / merge-to-main deploy re-runs the reconcile and turns
 *   the fleet back ON (the seeds declare it enabled). While you want it OFF,
 *   don't deploy — or just re-run `pnpm fleet:off` afterwards.
 */
import { execFileSync } from 'node:child_process'
import { Client } from 'pg'

// ── Wiring (prod). Override via env if the cluster coordinates ever change. ──
const KCTX = process.env.TDSK_KCTX ?? `tdsk`
const KNS = process.env.TDSK_KNS ?? `tdsk-production`
const DB_SECRET = process.env.TDSK_DB_SECRET ?? `tdsk-db-cfg`

/** The 6 resident body sandboxes, each mapped to the agent it hosts (1:1). */
const RESIDENTS: ReadonlyArray<{ sandboxId: string; agentId: string }> = [
  { sandboxId: `sb_ceo0001`, agentId: `ag_ceo0001` },
  { sandboxId: `sb_cmo0001`, agentId: `ag_cmo0001` },
  { sandboxId: `sb_cto0001`, agentId: `ag_cto0001` },
  { sandboxId: `sb_eng0001`, agentId: `ag_eng0001` },
  { sandboxId: `sb_eng0002`, agentId: `ag_eng0002` },
  { sandboxId: `sb_eng0003`, agentId: `ag_eng0003` },
]
const RESIDENT_SANDBOX_IDS = RESIDENTS.map((r) => r.sandboxId)

/** The scheduled agent cycles: sensor, verify, reflection, curation, cto-board. */
const FLEET_SCHEDULE_IDS = [
  `sd_lSst6Tq`, // sensor
  `sd_sLWvMuD`, // verify
  `sd_ROO3t4S`, // reflection
  `sd_IOf9soP`, // curation
  `sd_ctobrd1`, // cto-board (CTO strategy → engineering bridge)
]

const FLEET_WORKFLOWS = [`system-monitor.yml`, `update-behind-prs.yml`]

/** Only the 6 resident pods match this (customer sandboxes have random ids). */
const RESIDENT_POD_RE = /tdsk-sb-sb(ceo|cmo|cto|eng)000/

type Mode = `on` | `off` | `status`

const kubectl = (...args: string[]): string =>
  execFileSync(`kubectl`, [`--context`, KCTX, `-n`, KNS, ...args], {
    encoding: `utf8`,
  })

/** Build the prod Postgres URL from the k8s secret. Never logged. */
const prodDbUrl = (): string => {
  const read = (key: string): string =>
    Buffer.from(
      kubectl(`get`, `secret`, DB_SECRET, `-o`, `jsonpath={.data.${key}}`).trim(),
      `base64`
    )
      .toString(`utf8`)
      .trim()
  const user = read(`user`)
  const pass = read(`pass`)
  const host = read(`url`) // host/db?sslmode=... (no scheme, no creds)
  if (!user || !pass || !host)
    throw new Error(`could not read DB credentials from secret ${DB_SECRET}`)
  return `postgresql://${user}:${encodeURIComponent(pass)}@${host}`
}

const parseMode = (): Mode => {
  const args = process.argv.slice(2).map((a) => a.replace(/^--/, ``).toLowerCase())
  if (args.includes(`on`)) return `on`
  if (args.includes(`off`)) return `off`
  if (args.includes(`status`)) return `status`
  console.error(
    `Usage: tsx scripts/toggleFleet.ts --on | --off | --status\n` +
      `  --off     stand the fleet down (stop residents + schedules + gh alerts)\n` +
      `  --on      bring the fleet back up\n` +
      `  --status  print current state, change nothing`
  )
  process.exit(1)
}

const printState = async (db: Client) => {
  const res = await db.query<{ id: string; agent: string | null }>(
    `select id, config->'resident'->>'agentId' as agent
       from sandboxes where id = any($1) order by id`,
    [RESIDENT_SANDBOX_IDS]
  )
  console.log(`  residents (6):`)
  for (const row of res.rows)
    console.log(`    ${row.id}  ${row.agent ? `ON → ${row.agent}` : `off`}`)

  const sch = await db.query<{ id: string; enabled: boolean; errs: number }>(
    `select id, enabled, consecutive_errors as errs
       from schedules where id = any($1) order by id`,
    [FLEET_SCHEDULE_IDS]
  )
  console.log(`  schedules (5):`)
  for (const row of sch.rows)
    console.log(
      `    ${row.id}  ${row.enabled ? `ENABLED` : `disabled`}  (errors ${row.errs})`
    )

  const pods = kubectl(`get`, `pods`, `--no-headers`)
    .split(`\n`)
    .filter((l) => RESIDENT_POD_RE.test(l))
  console.log(`  resident pods running: ${pods.length}`)
}

const setWorkflows = (enable: boolean) => {
  for (const wf of FLEET_WORKFLOWS) {
    try {
      execFileSync(`gh`, [`workflow`, enable ? `enable` : `disable`, wf], {
        encoding: `utf8`,
        stdio: `pipe`,
      })
      console.log(`  gh workflow ${enable ? `enabled` : `disabled`}: ${wf}`)
    } catch (err: any) {
      console.log(
        `  gh workflow ${wf}: ${(err?.stderr || err?.message || `unknown`).toString().trim()}`
      )
    }
  }
}

const standDown = async (db: Client) => {
  // 1) Clear the resident flag so the watchdog stops booting them.
  await db.query(`update sandboxes set config = config - 'resident' where id = any($1)`, [
    RESIDENT_SANDBOX_IDS,
  ])
  console.log(`  cleared config.resident on ${RESIDENT_SANDBOX_IDS.length} sandboxes`)

  // 2) Disable the scheduled cycles.
  const sch = await db.query(`update schedules set enabled = false where id = any($1)`, [
    FLEET_SCHEDULE_IDS,
  ])
  console.log(`  disabled ${sch.rowCount} schedule rows`)

  // 3) Delete the live resident pods (orphaned now the flag is gone; the
  //    watchdog will NOT re-create them).
  const podNames = kubectl(`get`, `pods`, `-o`, `name`)
    .split(`\n`)
    .filter((n) => RESIDENT_POD_RE.test(n))
  if (podNames.length) {
    kubectl(`delete`, ...podNames, `--wait=false`)
    console.log(`  deleted ${podNames.length} resident pods`)
  } else console.log(`  no resident pods to delete`)

  // 4) Silence the GitHub workflows.
  setWorkflows(false)
}

const spinUp = async (db: Client) => {
  // 1) Re-arm resident mode. The watchdog boots each pod on its next sweep —
  // within ~60s when active, but after a full fleet-off it idles down to a
  // 30-minute heartbeat, so the first pod can take up to ~30m to appear.
  for (const { sandboxId, agentId } of RESIDENTS)
    await db.query(
      `update sandboxes
          set config = jsonb_set(coalesce(config, '{}'::jsonb), '{resident}', $2::jsonb)
        where id = $1`,
      [sandboxId, JSON.stringify({ agentId })]
    )
  console.log(`  re-armed config.resident on ${RESIDENTS.length} sandboxes`)

  // 2) Re-enable the scheduled cycles with a clean error slate (three of them
  //    auto-disable at 6/6 consecutive errors, so reset the counter).
  const sch = await db.query(
    `update schedules set enabled = true, consecutive_errors = 0 where id = any($1)`,
    [FLEET_SCHEDULE_IDS]
  )
  console.log(`  enabled ${sch.rowCount} schedule rows (errors reset)`)

  // 3) Re-enable the GitHub workflows.
  setWorkflows(true)
}

const main = async () => {
  const mode = parseMode()
  const db = new Client({
    connectionString: prodDbUrl(),
    ssl: { rejectUnauthorized: false },
  })
  await db.connect()
  try {
    console.log(`\n● fleet state BEFORE (${mode}):`)
    await printState(db)

    if (mode === `status`) return

    console.log(`\n● applying: ${mode.toUpperCase()}`)
    if (mode === `off`) await standDown(db)
    else await spinUp(db)

    console.log(`\n● fleet state AFTER:`)
    await printState(db)

    if (mode === `off`)
      console.log(
        `\n✅ Fleet stood DOWN. Platform is untouched and still serving.\n` +
          `   Bring it back with:  pnpm fleet:on\n` +
          `   Note: a 'tdsk release' / merge-to-main deploy re-enables the fleet;\n` +
          `   if you deploy while down, re-run  pnpm fleet:off  afterward.`
      )
    else
      console.log(
        `\n✅ Fleet spun UP. Residents boot on the watchdog's next sweep (up to ~30m after a full stand-down — it idles its poll to spare the DB); schedules fire on their next cron.`
      )
  } finally {
    await db.end()
  }
}

main().catch((err) => {
  console.error(`\n✗ toggleFleet failed:`, err?.message || err)
  process.exit(1)
})
