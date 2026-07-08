import type {
  TDBApiRes,
  TServiceOpts,
  TDBCollectionSelect,
  TDBCollectionInsert,
} from '@TDB/types'

import { eq, and, desc } from 'drizzle-orm'
import { Base } from '@TDB/services/base'
import { collections } from '@TDB/schemas/collections'
import { Collection as CollectionModel } from '@tdsk/domain'

/**
 * Collection service — project-scoped CRUD for the Collections primitive.
 * `create`, `update`, and `delete` are the standard id-based Base operations;
 * `getByName` / `listByProject` are the name/project-scoped lookups agents and
 * Functions use to resolve a collection within their project.
 */
export class Collection extends Base<
  typeof collections,
  TDBCollectionSelect,
  TDBCollectionInsert,
  CollectionModel
> {
  constructor(opts: TServiceOpts) {
    super({ ...opts, table: collections })
  }

  model = (data: TDBCollectionSelect) =>
    new CollectionModel(data as Partial<CollectionModel>)

  /** A project's collection by name, or {} when none exists. Project-scoped. */
  async getByName(projectId: string, name: string): Promise<TDBApiRes<CollectionModel>> {
    try {
      const [row] = await this.db
        .select()
        .from(collections)
        .where(and(eq(collections.projectId, projectId), eq(collections.name, name)))
        .limit(1)

      return row ? { data: this.model(row as TDBCollectionSelect) } : {}
    } catch (error: any) {
      return { error }
    }
  }

  /**
   * Every collection with the given name across ALL projects, newest first.
   * The resident watchdog's cross-project enumeration — resident_configs is a
   * per-project collection, and the watchdog reconciles every project that
   * holds one.
   */
  async listByName(name: string): Promise<TDBApiRes<CollectionModel[]>> {
    try {
      const rows = await this.db
        .select()
        .from(collections)
        .where(eq(collections.name, name))
        .orderBy(desc(collections.createdAt))

      return { data: rows.map((row) => this.model(row as TDBCollectionSelect)) }
    } catch (error: any) {
      return { error }
    }
  }

  /** All collections for a project, newest first. Project-scoped. */
  async listByProject(projectId: string): Promise<TDBApiRes<CollectionModel[]>> {
    try {
      const rows = await this.db
        .select()
        .from(collections)
        .where(eq(collections.projectId, projectId))
        .orderBy(desc(collections.createdAt))

      return { data: rows.map((row) => this.model(row as TDBCollectionSelect)) }
    } catch (error: any) {
      return { error }
    }
  }
}
