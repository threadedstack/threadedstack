import { Pool } from 'pg'
import { ife } from '@keg-hub/jsutils/ife'
import { config } from '@TDB/configs/db.config'

ife(async () => {
  const query = process.argv.slice(2).join(` `)

  if (!query) {
    console.error(`Usage: pnpm sql "<SQL statement>"`)
    process.exit(1)
  }

  const pool = new Pool({ connectionString: config.url })

  try {
    const result = await pool.query(query)

    if (result.rows.length > 0) console.table(result.rows)
    else console.log(`Query OK — ${result.rowCount ?? 0} rows affected`)
  } finally {
    await pool.end()
  }
}).catch((err: any) => {
  console.error(`SQL error:`, err.message)
  process.exit(1)
})
