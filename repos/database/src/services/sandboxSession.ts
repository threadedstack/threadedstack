import type {
  TServiceOpts,
  TDBQueryOpts,
  TDBWithRecord,
  TDBSandboxSessionSelect,
  TDBSandboxSessionInsert,
} from '@TDB/types'

import { eq } from 'drizzle-orm'
import { Base } from '@TDB/services/base'
import type { TSandboxSessionStatus } from '@tdsk/domain'
import { sandboxSessions } from '@TDB/schemas/sandboxSessions'
import { SandboxSession as SandboxSessionModel } from '@tdsk/domain'

export class SandboxSession extends Base<
  typeof sandboxSessions,
  TDBSandboxSessionSelect,
  TDBSandboxSessionInsert,
  SandboxSessionModel
> {
  constructor(opts: TServiceOpts) {
    super({ ...opts, table: sandboxSessions })
  }

  with = (opts?: TDBWithRecord) =>
    ({
      ...opts,
    }) as TDBWithRecord

  model = (data: TDBSandboxSessionSelect) => {
    return new SandboxSessionModel({
      ...data,
      status: data.status as TSandboxSessionStatus,
    })
  }

  async get(id: string, opts?: TDBQueryOpts) {
    return super.get(id, { ...opts, with: this.with(opts?.with) })
  }

  async list(opts: TDBQueryOpts = {}) {
    return super.list({ ...opts, with: this.with(opts?.with) })
  }

  async listBySandbox(sandboxId: string, opts: TDBQueryOpts = {}) {
    return this.list({
      ...opts,
      where: { ...opts.where, sandboxId },
      orderBy: opts.orderBy ?? { column: `startedAt`, direction: `desc` },
    })
  }

  async listByOrg(orgId: string, opts: TDBQueryOpts = {}) {
    return this.list({
      ...opts,
      where: { ...opts.where, orgId },
      orderBy: opts.orderBy ?? { column: `startedAt`, direction: `desc` },
    })
  }

  async complete(
    id: string,
    data: {
      status: TSandboxSessionStatus
      completedAt?: Date
      durationMs?: number
      stdoutKey?: string
      stderrKey?: string
    }
  ) {
    try {
      const resp = await this.db
        .update(sandboxSessions)
        .set({
          status: data.status,
          stdoutKey: data.stdoutKey,
          stderrKey: data.stderrKey,
          durationMs: data.durationMs,
          updatedAt: new Date(),
          completedAt: data.completedAt ?? new Date(),
        })
        .where(eq(sandboxSessions.id, id))
        .returning()

      if (!resp[0]) return { error: new Error(`Sandbox session not found`) }

      return { data: this.model(resp[0]) }
    } catch (error: any) {
      return { error }
    }
  }
}
