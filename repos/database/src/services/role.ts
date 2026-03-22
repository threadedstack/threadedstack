import type {
  TDBApiRes,
  TServiceOpts,
  TDBRoleSelect,
  TDBRoleInsert,
  TDBApiResType,
} from '@TDB/types'

import { Base } from '@TDB/services/base'
import { roles } from '@TDB/schemas/roles'
import { Role as RoleModel } from '@tdsk/domain'
import { eq, and, isNotNull } from 'drizzle-orm'

export class Role extends Base<typeof roles, TDBRoleSelect, TDBRoleInsert, RoleModel> {
  constructor(opts: TServiceOpts) {
    super({ ...opts, table: roles })
  }

  model = (data: TDBRoleSelect) => new RoleModel(data)

  /**
   * Get user's role for a specific org
   */
  async getOrgRole(userId: string, orgId: string): Promise<TDBApiRes<RoleModel>> {
    try {
      const result = await this.db
        .select()
        .from(roles)
        .where(and(eq(roles.userId, userId), eq(roles.orgId, orgId)))
        .limit(1)

      return { data: result[0] ? this.model(result[0]) : null }
    } catch (error: any) {
      return { error }
    }
  }

  /**
   * Get user's role for a specific project
   */
  async getProjectRole(userId: string, projectId: string): Promise<TDBApiRes<RoleModel>> {
    try {
      const result = await this.db
        .select()
        .from(roles)
        .where(and(eq(roles.userId, userId), eq(roles.projectId, projectId)))
        .limit(1)

      return { data: result[0] ? this.model(result[0]) : null }
    } catch (error: any) {
      return { error }
    }
  }

  /**
   * Get all roles for a user (across all orgs and projects)
   */
  async getUserRoles(userId: string): Promise<TDBApiRes<RoleModel[]>> {
    try {
      const result = await this.db.select().from(roles).where(eq(roles.userId, userId))

      return { data: result.map((item) => this.model(item)) }
    } catch (error: any) {
      return { error }
    }
  }

  /**
   * Get all members of an org with their roles
   */
  async getOrgMembers(
    orgId: string,
    opts?: { limit?: number; offset?: number }
  ): Promise<TDBApiRes<RoleModel[]>> {
    try {
      let query = this.db.select().from(roles).where(eq(roles.orgId, orgId))
      if (opts?.limit) query = query.limit(opts.limit) as typeof query
      if (opts?.offset) query = query.offset(opts.offset) as typeof query
      const result = await query

      return { data: result.map((item) => this.model(item)) }
    } catch (error: any) {
      return { error }
    }
  }

  /**
   * Get org owner role
   */
  async getOrgOwner(orgId: string): Promise<TDBApiRes<RoleModel>> {
    try {
      const result = await this.db
        .select()
        .from(roles)
        .where(and(eq(roles.orgId, orgId), eq(roles.type, 'owner')))
        .limit(1)

      return { data: result[0] ? this.model(result[0]) : undefined }
    } catch (error: any) {
      return { error }
    }
  }

  /**
   * Get all members of a project with their roles and user details
   */
  async getProjectMembers(
    projectId: string,
    opts?: { limit?: number; offset?: number }
  ): Promise<TDBApiRes<RoleModel[]>> {
    try {
      const result = await this.db.query[this.name].findMany({
        where: eq(roles.projectId, projectId),
        limit: opts?.limit,
        offset: opts?.offset,
        with: {
          user: {
            columns: {
              id: true,
              name: true,
              last: true,
              email: true,
              first: true,
              image: true,
            },
          },
        },
      })

      return { data: result.map((item) => this.model(item as TDBRoleSelect)) }
    } catch (error: any) {
      return { error }
    }
  }

  /**
   * Check if user has any role in an org (is a member)
   */
  async isOrgMember(userId: string, orgId: string): Promise<TDBApiResType<boolean>> {
    try {
      const result = await this.db
        .select()
        .from(roles)
        .where(and(eq(roles.userId, userId), eq(roles.orgId, orgId)))
        .limit(1)

      return { data: result.length > 0 }
    } catch (error: any) {
      return { error }
    }
  }

  /**
   * Check if user has any role in a project (is a member)
   */
  async isProjectMember(
    userId: string,
    projectId: string
  ): Promise<TDBApiResType<boolean>> {
    try {
      const result = await this.db
        .select()
        .from(roles)
        .where(and(eq(roles.userId, userId), eq(roles.projectId, projectId)))
        .limit(1)

      return { data: result.length > 0 }
    } catch (error: any) {
      return { error }
    }
  }

  /**
   * Update a user's role in an org
   */
  async updateOrgRole(
    userId: string,
    orgId: string,
    roleType: string
  ): Promise<TDBApiRes<RoleModel>> {
    try {
      const result = await this.db
        .update(roles)
        .set({ type: roleType, updatedAt: new Date() })
        .where(and(eq(roles.userId, userId), eq(roles.orgId, orgId)))
        .returning()

      const item = result?.[0]

      return { data: item ? this.model(item) : undefined }
    } catch (error: any) {
      return { error }
    }
  }

  /**
   * Update a user's role in a project
   */
  async updateProjectRole(
    userId: string,
    projectId: string,
    roleType: string
  ): Promise<TDBApiRes<RoleModel>> {
    try {
      const result = await this.db
        .update(roles)
        .set({ type: roleType, updatedAt: new Date() })
        .where(and(eq(roles.userId, userId), eq(roles.projectId, projectId)))
        .returning()

      const item = result?.[0]

      return { data: item ? this.model(item) : undefined }
    } catch (error: any) {
      return { error }
    }
  }

  /**
   * Remove user from org (delete their org role)
   */
  async removeFromOrg(userId: string, orgId: string): Promise<TDBApiResType<boolean>> {
    try {
      const result = await this.db
        .delete(roles)
        .where(and(eq(roles.userId, userId), eq(roles.orgId, orgId)))
        .returning()

      return { data: result.length > 0 }
    } catch (error: any) {
      return { error }
    }
  }

  /**
   * Remove user from project (delete their project role)
   */
  async removeFromProject(
    userId: string,
    projectId: string
  ): Promise<TDBApiResType<boolean>> {
    try {
      const result = await this.db
        .delete(roles)
        .where(and(eq(roles.userId, userId), eq(roles.projectId, projectId)))
        .returning()

      return { data: result.length > 0 }
    } catch (error: any) {
      return { error }
    }
  }

  /**
   * Get all orgs a user belongs to (has any role in)
   */
  async getUserOrgs(userId: string): Promise<TDBApiResType<string[]>> {
    try {
      const result = await this.db
        .select({ orgId: roles.orgId })
        .from(roles)
        .where(and(eq(roles.userId, userId), isNotNull(roles.orgId)))

      const orgIds = result.map((r) => r.orgId).filter((id): id is string => id !== null)

      return { data: orgIds }
    } catch (error: any) {
      return { error }
    }
  }

  /**
   * Get all projects a user belongs to (has any role in)
   */
  async getUserProjects(userId: string): Promise<TDBApiResType<string[]>> {
    try {
      const result = await this.db
        .select({ projectId: roles.projectId })
        .from(roles)
        .where(and(eq(roles.userId, userId), isNotNull(roles.projectId)))

      const projectIds = result
        .map((r) => r.projectId)
        .filter((id): id is string => id !== null)

      return { data: projectIds }
    } catch (error: any) {
      return { error }
    }
  }
}
