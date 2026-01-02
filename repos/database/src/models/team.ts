import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { TDBTeamSelect, TDBTeamInsert } from '@TDB/types'

import { Base } from '@TDB/models/base'
import { teams } from '@TDB/schemas/teams' 

export type TTeamOpts = {
  db: NodePgDatabase
}

export class Team extends Base<
  typeof teams,
  TDBTeamSelect,
  TDBTeamInsert
> {

  constructor(opts: TTeamOpts) {
    super({...opts, schema: teams})
  }

}
