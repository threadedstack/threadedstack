import type {
  TDBApiRes,
  TServiceOpts,
  TDBApiResType,
  TDBPermissionOverrideSelect,
  TDBPermissionOverrideInsert,
} from '@TDB/types'

import { Base } from '@TDB/services/base'
import { eq, and, lt, isNotNull } from 'drizzle-orm'
import { permissionOverrides } from '@TDB/schemas/permissionOverrides'
import { PermissionOverride as PermissionOverrideModel } from '@tdsk/domain'

export class PermissionOverride extends Base<
  typeof permissionOverrides,
  TDBPermissionOverrideSelect,
  TDBPermissionOverrideInsert,
  PermissionOverrideModel
> {
  constructor(opts: TServiceOpts) {
    super({ ...opts, table: permissionOverrides })
  }

  model = (data: TDBPermissionOverrideSelect) => new PermissionOverrideModel(data)

  /**
   * Get all overrides for a user in a given scope (org or project)
   */
  async getForUser(
    userId: string,
    context: { orgId?: string; projectId?: string }
  ): Promise<TDBApiRes<PermissionOverrideModel[]>> {
    if (!context.orgId && !context.projectId) return { data: [] }

    try {
      const conditions = [eq(permissionOverrides.userId, userId)]

      if (context.orgId) conditions.push(eq(permissionOverrides.orgId, context.orgId))

      if (context.projectId)
        conditions.push(eq(permissionOverrides.projectId, context.projectId))

      const result = await this.db
        .select()
        .from(permissionOverrides)
        .where(and(...conditions))

      return { data: result.map((item) => this.model(item)) }
    } catch (error: any) {
      return { error }
    }
  }

  /**
   * List all overrides in an org
   */
  async listForOrg(orgId: string): Promise<TDBApiRes<PermissionOverrideModel[]>> {
    try {
      const result = await this.db
        .select()
        .from(permissionOverrides)
        .where(eq(permissionOverrides.orgId, orgId))

      return { data: result.map((item) => this.model(item)) }
    } catch (error: any) {
      return { error }
    }
  }

  /**
   * List all overrides in a project
   */
  async listForProject(projectId: string): Promise<TDBApiRes<PermissionOverrideModel[]>> {
    try {
      const result = await this.db
        .select()
        .from(permissionOverrides)
        .where(eq(permissionOverrides.projectId, projectId))

      return { data: result.map((item) => this.model(item)) }
    } catch (error: any) {
      return { error }
    }
  }

  /**
   * Delete all expired overrides (where expiresAt is non-null and in the past)
   * When orgId is provided, only deletes expired overrides within that org.
   */
  async deleteExpired(orgId: string): Promise<TDBApiResType<number>> {
    try {
      const result = await this.db
        .delete(permissionOverrides)
        .where(
          and(
            eq(permissionOverrides.orgId, orgId),
            isNotNull(permissionOverrides.expiresAt),
            lt(permissionOverrides.expiresAt, new Date().toISOString())
          )
        )
        .returning()

      return { data: result.length }
    } catch (error: any) {
      return { error }
    }
  }

  /**
   * Delete an override by its id
   */
  async deleteById(id: string): Promise<TDBApiResType<boolean>> {
    try {
      const result = await this.db
        .delete(permissionOverrides)
        .where(eq(permissionOverrides.id, id))
        .returning()

      return { data: result.length > 0 }
    } catch (error: any) {
      return { error }
    }
  }
}
