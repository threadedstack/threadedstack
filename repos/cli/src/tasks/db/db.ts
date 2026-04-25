import type { TTask } from '@TSCL/types'

import { dk } from './dk'
import { dup } from './dup'
import { rmf } from './rmf'
import { push } from './push'
import { drop } from './drop'
import { seed } from './seed'
import { check } from './check'
import { certs } from './certs'
import { purge } from './purge'
import { reset } from './reset'
import { studio } from './studio'
import { migrate } from './migrate'
import { cleanup } from './cleanup'
import { generate } from './generate'
import { dbExport } from './dbExport'
import { introspect } from './introspect'

export const db: TTask = {
  name: `db`,
  alias: [`database`],
  description: `Database management commands (migrations, seeding, Drizzle Studio)`,
  tasks: {
    dk,
    dup,
    rmf,
    push,
    drop,
    seed,
    check,
    certs,
    purge,
    reset,
    studio,
    migrate,
    cleanup,
    generate,
    introspect,
    export: dbExport,
  },
}
