import type { TServiceOpts, TDBSandboxSelect, TDBSandboxInsert } from '@TDB/types'

import { Base } from '@TDB/services/base'
import { sandboxes } from '@TDB/schemas/sandboxes'
import { Sandbox as SandboxModel } from '@tdsk/domain'

export class Sandbox extends Base<
  typeof sandboxes,
  TDBSandboxSelect,
  TDBSandboxInsert,
  SandboxModel
> {
  constructor(opts: TServiceOpts) {
    super({ ...opts, table: sandboxes })
  }

  model = (data: TDBSandboxSelect) => {
    return new SandboxModel(data)
  }
}
