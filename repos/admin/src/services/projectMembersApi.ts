import type { TApiRes } from '@TAF/types'
import type { TRole, TPermissionOverrides } from '@tdsk/domain'

import { Role } from '@tdsk/domain'
import { BaseApi } from '@TAF/services/api'

export class ProjectMembersApi extends BaseApi {
  #path(orgId: string, projectId: string) {
    return `/orgs/${orgId}/projects/${projectId}/members`
  }

  async list(orgId: string, projectId: string): Promise<TApiRes<Role[]>> {
    const resp = await this.api.get<TRole[]>({
      path: this.#path(orgId, projectId),
      queryKey: [`projectMembers`, orgId, projectId],
    })

    resp.error && (await this._onError(resp.error, `Failed to load project members`))

    return {
      ...resp,
      data: resp.data?.map((r: TRole) => new Role(r)) || [],
    }
  }

  async add(
    orgId: string,
    projectId: string,
    data: {
      userId?: string
      email?: string
      roleType: string
      permissionOverrides?: TPermissionOverrides
    }
  ): Promise<TApiRes<any>> {
    const resp = await this.api.post<any>({
      data,
      path: this.#path(orgId, projectId),
    })

    resp.error && (await this._onError(resp.error, `Failed to add project member`))

    return resp
  }

  async updateRole(
    orgId: string,
    projectId: string,
    userId: string,
    roleType: string
  ): Promise<TApiRes<any>> {
    const resp = await this.api.put<any>({
      data: { roleType },
      path: `${this.#path(orgId, projectId)}/${userId}`,
    })

    resp.error && (await this._onError(resp.error, `Failed to update member role`))

    return resp
  }

  async remove(orgId: string, projectId: string, userId: string): Promise<TApiRes<any>> {
    const resp = await this.api.delete<any>({
      path: `${this.#path(orgId, projectId)}/${userId}`,
    })

    resp.error && (await this._onError(resp.error, `Failed to remove project member`))

    return resp
  }
}

export const projectMembersApi = new ProjectMembersApi()
