import type { TServiceOpts, TDBOrgSelect, TDBOrgInsert } from '@TDB/types'

import { Base } from '@TDB/services/base'
import { orgs } from '@TDB/schemas/orgs'
import { Organization as OrgModel } from '@tdsk/domain'

export class Org extends Base<typeof orgs, TDBOrgSelect, TDBOrgInsert, OrgModel> {
  constructor(opts: TServiceOpts) {
    super({ ...opts, table: orgs })
  }

  model = (data: TDBOrgSelect) => new OrgModel(data)
}
