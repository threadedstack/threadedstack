import type { TProviderInput, TProviderLink } from '@tdsk/domain'
import type {
  TDBUpdate,
  TServiceOpts,
  TDBQueryOpts,
  TDBWithRecord,
  TDBSandboxSelect,
  TDBSandboxInsert,
  TDBProviderSelect,
} from '@TDB/types'

import { eq, and, sql, notInArray } from 'drizzle-orm'
import { Base } from '@TDB/services/base'
import { logger } from '@TDB/utils/logger'
import { DBError } from '@TDB/utils/error/error'
import { sandboxes } from '@TDB/schemas/sandboxes'
import { Sandbox as SandboxModel } from '@tdsk/domain'
import { sandboxProviders } from '@TDB/schemas/sandboxProviders'
import { addWhere, addOrderBy } from '@TDB/utils/database/buildQuery'

export type TSandboxSelectOpts = TDBSandboxSelect & {
  providers?: {
    priority: number
    sandboxId: string
    providerId: string
    model?: string | null
    provider: TDBProviderSelect
  }[]
}

type TSandboxProviderMeta = {
  providerLinks?: TProviderLink[]
  providerInputs?: TProviderInput[]
}

export type TSandboxInsertOpts = TDBSandboxInsert & TSandboxProviderMeta

export class Sandbox extends Base<
  typeof sandboxes,
  TSandboxSelectOpts,
  TDBSandboxInsert,
  SandboxModel
> {
  constructor(opts: TServiceOpts) {
    super({ ...opts, table: sandboxes })
  }

  with = (opts: TDBWithRecord) => {
    return {
      ...opts,
      providers: {
        with: {
          provider: true,
        },
      },
    } as TDBWithRecord
  }

  model = (data: TSandboxSelectOpts) => {
    const { providers, ...rest } = data
    return new SandboxModel({
      ...rest,
      providerLinks: (providers || [])
        .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0))
        .map((link) => ({
          provider: link.provider,
          model: link.model ?? null,
          priority: link.priority ?? 0,
        })),
    })
  }

  async get(id: string, opts?: TDBQueryOpts) {
    try {
      const row = await this.db.query[this.name].findFirst({
        with: this.with(opts?.with),
        where: eq(this.table.id, id),
      })

      if (!row) return { error: new DBError(`${this.title} not found`) }

      return { data: this.model(row as TSandboxSelectOpts) }
    } catch (error: any) {
      return { error }
    }
  }

  async list(opts: TDBQueryOpts = {}) {
    const { where, limit, offset, orderBy } = opts

    try {
      const found = await this.db.query[this.name].findMany({
        limit,
        offset,
        with: this.with(opts?.with),
        orderBy: orderBy ? addOrderBy(this.table, opts) : undefined,
        where: where ? and(...addWhere(this.table, opts)) : undefined,
      })

      if (!found?.length) return { data: [] as SandboxModel[] }

      return {
        data: found.map((row) => this.model(row as TSandboxSelectOpts)) as SandboxModel[],
      }
    } catch (error: any) {
      return { error }
    }
  }

  async create(data: TSandboxInsertOpts | (TDBSandboxInsert & Record<string, any>)) {
    const { providerLinks, providerInputs, ...sandboxData } = data as TSandboxInsertOpts
    const result = await super.create(sandboxData as TDBSandboxInsert)

    if (result.data && providerInputs?.length) {
      try {
        await this.#upsertProviders(result.data.id, providerInputs)
        const updated = await this.get(result.data.id)
        result.data = updated.data
      } catch (err) {
        await this.db
          .delete(sandboxes)
          .where(eq(sandboxes.id, result.data.id))
          .catch((cleanupErr) => {
            logger.error(
              `Failed to cleanup sandbox ${result.data!.id} after provider link error`,
              {
                error: cleanupErr instanceof Error ? cleanupErr.message : cleanupErr,
              }
            )
          })
        throw err
      }
    }

    return result
  }

  async update(data: TDBUpdate<TSandboxInsertOpts>) {
    const { providerInputs, providerLinks, ...sandboxData } = data

    if (!sandboxData.id)
      return { data: null, error: new DBError(`Sandbox ID is required for update`) }

    const result = await super.update(sandboxData)

    if (result.data && providerInputs !== undefined) {
      try {
        await this.#upsertProviders(sandboxData.id, providerInputs)
        const updated = await this.get(sandboxData.id)
        result.data = updated.data
      } catch (error: any) {
        return { data: undefined, error }
      }
    }

    return result
  }

  async listByOrg(orgId: string) {
    return this.list({ where: { orgId } })
  }

  async listByProject(projectId: string) {
    return this.list({ where: { projectId } })
  }

  async addProvider(
    sandboxId: string,
    providerId: string,
    priority: number = 0,
    model?: string | null
  ) {
    const [result] = await this.db
      .insert(sandboxProviders)
      .values({
        sandboxId,
        priority,
        providerId,
        model: model ?? null,
      })
      .returning()

    return { data: result, error: null }
  }

  async removeProvider(sandboxId: string, providerId: string) {
    await this.db
      .delete(sandboxProviders)
      .where(
        and(
          eq(sandboxProviders.sandboxId, sandboxId),
          eq(sandboxProviders.providerId, providerId)
        )
      )

    return { data: null, error: null }
  }

  async setProviders(sandboxId: string, inputs: TProviderInput[]) {
    await this.#upsertProviders(sandboxId, inputs)
    return { data: null, error: null }
  }

  #upsertProviders = async (sandboxId: string, inputs: TProviderInput[]) => {
    if (!inputs) return

    const rows = inputs
      .filter((p) => p.id)
      .map((p, i) => ({
        providerId: p.id,
        priority: i,
        sandboxId,
        model: p.model ?? null,
      }))

    await this.db.transaction(async (tx) => {
      // Remove providers no longer in the list
      if (rows.length) {
        await tx.delete(sandboxProviders).where(
          and(
            eq(sandboxProviders.sandboxId, sandboxId),
            notInArray(
              sandboxProviders.providerId,
              rows.map((r) => r.providerId)
            )
          )
        )
      } else {
        await tx.delete(sandboxProviders).where(eq(sandboxProviders.sandboxId, sandboxId))
      }

      // Upsert: insert new, update priority/model on existing
      if (rows.length) {
        await tx
          .insert(sandboxProviders)
          .values(rows)
          .onConflictDoUpdate({
            target: [sandboxProviders.sandboxId, sandboxProviders.providerId],
            set: {
              priority: sql`excluded.priority`,
              model: sql`excluded.model`,
            },
          })
      }
    })
  }
}
