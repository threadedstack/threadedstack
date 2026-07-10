import type { Response } from 'express'
import type { TApp, TRequest, TEndpointConfig } from '@TBE/types'
import { describe, it, expect, vi } from 'vitest'

import { EPMethod } from '@TBE/types'
import {
  EQueryOp,
  FeatureFlags,
  Record as RecordModel,
  Collection as CollectionModel,
} from '@tdsk/domain'

import { projectCollections } from './collections'
import { getRecord } from './getRecord'
import { upsertRecord } from './upsertRecord'
import { queryRecords } from './queryRecords'
import { getCollection } from './getCollection'
import { listCollections } from './listCollections'
import { createCollection } from './createCollection'
import { updateCollection } from './updateCollection'
import { deleteCollection } from './deleteCollection'

/** Fresh mock app with the collection + record + role services the endpoints use. */
const buildApp = () =>
  ({
    locals: {
      db: {
        services: {
          collection: {
            create: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
            getByName: vi.fn(),
            listByProject: vi.fn(),
          },
          record: {
            upsert: vi.fn(),
            query: vi.fn(),
            get: vi.fn(),
            delete: vi.fn(),
            countsByProject: vi.fn().mockResolvedValue({ data: {} }),
          },
          role: {
            getOrgRole: vi.fn().mockResolvedValue({ data: { type: `admin` } }),
            getProjectRole: vi.fn().mockResolvedValue({ data: { type: `admin` } }),
          },
          permissionOverride: {
            getForUser: vi.fn().mockResolvedValue({ data: [] }),
          },
        },
      },
    },
  }) as unknown as TApp

/** Fresh res + spies for a single action/middleware invocation. */
const buildCtx = () => {
  const json = vi.fn()
  const status = vi.fn().mockReturnThis()
  const res = { status, json } as unknown as Response
  return { res, json, status }
}

const buildReq = (app: TApp, params: Record<string, string>, body: any = {}) =>
  ({
    app,
    user: { id: `user-1` },
    params,
    body,
    query: {},
  }) as unknown as TRequest

describe(`Collections endpoints`, () => {
  describe(`group config`, () => {
    it(`mounts collections under the project scope with a feature gate`, () => {
      expect(projectCollections.path).toBe(`/:projectId/collections`)
      expect(projectCollections.method).toBe(EPMethod.Use)
      expect(projectCollections.endpoints?.listCollections).toBeDefined()
      expect(projectCollections.endpoints?.createCollection).toBeDefined()
      expect(projectCollections.endpoints?.getCollection).toBeDefined()
      expect(projectCollections.endpoints?.updateCollection).toBeDefined()
      expect(projectCollections.endpoints?.deleteCollection).toBeDefined()
      expect(projectCollections.endpoints?.collectionRecords).toBeDefined()
      expect(projectCollections.middleware?.length).toBeGreaterThan(0)
    })

    it(`nests record endpoints under /:name/records`, () => {
      const records = projectCollections.endpoints?.collectionRecords as TEndpointConfig
      expect(records.path).toBe(`/:name/records`)
      expect(records.method).toBe(EPMethod.Use)
      expect(records.endpoints?.upsertRecord).toBeDefined()
      expect(records.endpoints?.queryRecords).toBeDefined()
      expect(records.endpoints?.getRecord).toBeDefined()
      expect(records.endpoints?.deleteRecord).toBeDefined()
    })

    it(`has the expected endpoint paths and methods`, () => {
      expect(createCollection.path).toBe(`/`)
      expect(createCollection.method).toBe(EPMethod.Post)
      expect(listCollections.path).toBe(`/`)
      expect(listCollections.method).toBe(EPMethod.Get)
      expect(getCollection.path).toBe(`/:name`)
      expect(updateCollection.method).toBe(EPMethod.Put)
      expect(deleteCollection.method).toBe(EPMethod.Delete)
      expect(upsertRecord.path).toBe(`/`)
      expect(upsertRecord.method).toBe(EPMethod.Post)
      expect(queryRecords.path).toBe(`/query`)
      expect(queryRecords.method).toBe(EPMethod.Post)
      expect(getRecord.path).toBe(`/:id`)
    })
  })

  describe(`round trip`, () => {
    it(`create collection -> upsert record -> query records returns the record`, async () => {
      const app = buildApp()
      const svc = app.locals.db.services

      const createdCollection = new CollectionModel({
        id: `col_abc123`,
        name: `tasks`,
        projectId: `project-1`,
      })
      const record = new RecordModel({
        id: `rec_xyz789`,
        collectionId: `col_abc123`,
        projectId: `project-1`,
        data: { status: `open` },
      })

      ;(svc.collection.create as any).mockResolvedValue({ data: createdCollection })
      ;(svc.record.upsert as any).mockResolvedValue({ data: record })
      ;(svc.record.query as any).mockResolvedValue({ data: [record] })

      // 1) create the collection
      const createCtx = buildCtx()
      await createCollection.action!(
        buildReq(app, { orgId: `org-1`, projectId: `project-1` }, { name: `tasks` }),
        createCtx.res
      )
      expect(svc.collection.create).toHaveBeenCalledOnce()
      expect(createCtx.status).toHaveBeenCalledWith(201)

      // 2) upsert a record into it
      const upsertCtx = buildCtx()
      await upsertRecord.action!(
        buildReq(
          app,
          { projectId: `project-1`, name: `tasks` },
          { id: `rec_xyz789`, data: { status: `open` } }
        ),
        upsertCtx.res
      )
      expect(svc.record.upsert).toHaveBeenCalledWith(`project-1`, `tasks`, {
        id: `rec_xyz789`,
        data: { status: `open` },
      })
      expect(upsertCtx.status).toHaveBeenCalledWith(200)

      // 3) query the collection and get the record back
      const query = { where: [{ field: `status`, op: EQueryOp.eq, value: `open` }] }
      const queryCtx = buildCtx()
      await queryRecords.action!(
        buildReq(app, { projectId: `project-1`, name: `tasks` }, query),
        queryCtx.res
      )
      expect(svc.record.query).toHaveBeenCalledWith(`project-1`, `tasks`, query)
      expect(queryCtx.status).toHaveBeenCalledWith(200)

      const returned = (queryCtx.json.mock.calls[0][0] as { data: RecordModel[] }).data
      expect(returned).toHaveLength(1)
      expect(returned[0].id).toBe(`rec_xyz789`)
      expect((returned[0].data as { status: string }).status).toBe(`open`)
    })

    it(`upsertRecord surfaces the service 404 when the collection is missing`, async () => {
      const app = buildApp()
      ;(app.locals.db.services.record.upsert as any).mockResolvedValue({
        error: new Error(`Collection not found`),
        status: 404,
      })

      await expect(
        upsertRecord.action!(
          buildReq(app, { projectId: `project-1`, name: `ghost` }, { data: { a: 1 } }),
          buildCtx().res
        )
      ).rejects.toMatchObject({ status: 404 })
    })

    it(`queryRecords surfaces a 400 when the query compiler rejects a field`, async () => {
      const app = buildApp()
      ;(app.locals.db.services.record.query as any).mockResolvedValue({
        error: new Error(`Invalid field: x'); drop table records;--`),
      })

      await expect(
        queryRecords.action!(
          buildReq(
            app,
            { projectId: `project-1`, name: `tasks` },
            { where: [{ field: `x'); drop table records;--`, op: `eq`, value: 1 }] }
          ),
          buildCtx().res
        )
      ).rejects.toMatchObject({ status: 400 })
    })
  })

  describe(`listCollections action`, () => {
    it(`annotates each collection with its record count from the aggregate map`, async () => {
      const app = buildApp()
      const svc = app.locals.db.services

      const tasks = new CollectionModel({
        id: `col_tasks01`,
        name: `tasks`,
        projectId: `project-1`,
      })
      const notes = new CollectionModel({
        id: `col_notes01`,
        name: `notes`,
        projectId: `project-1`,
      })

      ;(svc.collection.listByProject as any).mockResolvedValue({ data: [tasks, notes] })
      ;(svc.record.countsByProject as any).mockResolvedValue({
        data: { col_tasks01: 4 },
      })

      const ctx = buildCtx()
      await listCollections.action!(
        buildReq(app, { orgId: `org-1`, projectId: `project-1` }),
        ctx.res
      )

      expect(ctx.status).toHaveBeenCalledWith(200)
      const { data } = ctx.json.mock.calls[0][0] as { data: any[] }
      expect(data).toEqual([
        expect.objectContaining({ id: `col_tasks01`, recordCount: 4 }),
        expect.objectContaining({ id: `col_notes01`, recordCount: 0 }),
      ])
    })

    it(`defaults recordCount to 0 for a collection absent from the counts map`, async () => {
      const app = buildApp()
      const svc = app.locals.db.services

      const empty = new CollectionModel({
        id: `col_empty01`,
        name: `empty`,
        projectId: `project-1`,
      })

      ;(svc.collection.listByProject as any).mockResolvedValue({ data: [empty] })
      ;(svc.record.countsByProject as any).mockResolvedValue({ data: {} })

      const ctx = buildCtx()
      await listCollections.action!(
        buildReq(app, { orgId: `org-1`, projectId: `project-1` }),
        ctx.res
      )

      const { data } = ctx.json.mock.calls[0][0] as { data: any[] }
      expect(data[0].recordCount).toBe(0)
    })

    it(`throws a 500 when the counts aggregate fails`, async () => {
      const app = buildApp()
      const svc = app.locals.db.services

      ;(svc.collection.listByProject as any).mockResolvedValue({ data: [] })
      ;(svc.record.countsByProject as any).mockResolvedValue({
        error: new Error(`db unavailable`),
      })

      await expect(
        listCollections.action!(
          buildReq(app, { orgId: `org-1`, projectId: `project-1` }),
          buildCtx().res
        )
      ).rejects.toMatchObject({ status: 500 })
    })
  })

  describe(`feature gate`, () => {
    // featureGate('collections') is the final group middleware.
    const gate = projectCollections.middleware!.at(-1)!

    it(`returns 404 for collection routes when the collections flag is disabled`, () => {
      const original = FeatureFlags.collections.enabled
      const { res, status, json } = buildCtx()
      const next = vi.fn()
      try {
        FeatureFlags.collections.enabled = false
        gate({ method: `GET`, path: `/collections` } as any, res, next)
      } finally {
        FeatureFlags.collections.enabled = original
      }
      expect(next).not.toHaveBeenCalled()
      expect(status).toHaveBeenCalledWith(404)
      expect(json).toHaveBeenCalledWith({ error: `Not found` })
    })

    it(`passes through when the collections flag is enabled`, () => {
      const original = FeatureFlags.collections.enabled
      const { res, status } = buildCtx()
      const next = vi.fn()
      try {
        FeatureFlags.collections.enabled = true
        gate({ method: `GET`, path: `/collections` } as any, res, next)
      } finally {
        FeatureFlags.collections.enabled = original
      }
      expect(next).toHaveBeenCalled()
      expect(status).not.toHaveBeenCalled()
    })
  })

  describe(`authorization`, () => {
    it(`allows an admin to create a collection`, async () => {
      const app = buildApp() // role service defaults to admin
      const next = vi.fn()
      await createCollection.middleware![0](
        buildReq(app, { orgId: `org-1`, projectId: `project-1` }),
        buildCtx().res,
        next
      )
      expect(next).toHaveBeenCalledTimes(1)
      expect(next.mock.calls[0][0]).toBeUndefined()
    })

    it(`blocks a member without collection:delete from deleting a collection`, async () => {
      const app = buildApp()
      ;(app.locals.db.services.role.getOrgRole as any).mockResolvedValue({ data: null })
      ;(app.locals.db.services.role.getProjectRole as any).mockResolvedValue({
        data: { type: `member` },
      })
      const next = vi.fn()
      await deleteCollection.middleware![0](
        buildReq(app, { orgId: `org-1`, projectId: `project-1`, name: `tasks` }),
        buildCtx().res,
        next
      )
      const err = next.mock.calls[0][0]
      expect(err).toBeDefined()
      expect(err.status).toBe(403)
    })

    it(`blocks a caller with no role in the target project (cross-project)`, async () => {
      const app = buildApp()
      ;(app.locals.db.services.role.getOrgRole as any).mockResolvedValue({ data: null })
      ;(app.locals.db.services.role.getProjectRole as any).mockResolvedValue({
        data: null,
      })
      const next = vi.fn()
      await listCollections.middleware![0](
        buildReq(app, { orgId: `org-1`, projectId: `project-forbidden` }),
        buildCtx().res,
        next
      )
      const err = next.mock.calls[0][0]
      expect(err).toBeDefined()
      expect(err.status).toBe(403)
    })
  })
})
