import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { TDBTeamSelect, TDBTeamInsert } from '@TDB/types'

import { Base } from '@TDB/services/base'
import { teams } from '@TDB/schemas/teams'
import { Team as TeamModel } from '@tdsk/domain'

export type TTeamOpts = {
  db: NodePgDatabase
}

export class Team extends Base<typeof teams, TDBTeamSelect, TDBTeamInsert, TeamModel> {
  constructor(opts: TTeamOpts) {
    super({ ...opts, table: teams })
  }

  model = (data: TDBTeamSelect) => new TeamModel(data)
}
