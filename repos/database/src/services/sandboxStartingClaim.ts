import type {
  TServiceOpts,
  TDBQueryOpts,
  TDBWithRecord,
  TDBSandboxStartingClaimSelect,
  TDBSandboxStartingClaimInsert,
} from '@TDB/types'

import { eq, and, isNull } from 'drizzle-orm'
import { Base } from '@TDB/services/base'
import { sandboxStartingClaims } from '@TDB/schemas/sandboxStartingClaims'
import { SandboxStartingClaim as SandboxStartingClaimModel } from '@tdsk/domain'

export class SandboxStartingClaim extends Base<
  typeof sandboxStartingClaims,
  TDBSandboxStartingClaimSelect,
  TDBSandboxStartingClaimInsert,
  SandboxStartingClaimModel
> {
  constructor(opts: TServiceOpts) {
    super({ ...opts, table: sandboxStartingClaims })
  }

  with = (opts?: TDBWithRecord) =>
    ({
      ...opts,
    }) as TDBWithRecord

  model = (data: TDBSandboxStartingClaimSelect) => {
    return new SandboxStartingClaimModel(data)
  }

  async get(id: string, opts?: TDBQueryOpts) {
    return super.get(id, { ...opts, with: this.with(opts?.with) })
  }

  async list(opts: TDBQueryOpts = {}) {
    return super.list({ ...opts, with: this.with(opts?.with) })
  }

  /**
   * Atomically claim the "starting" slot for a sandbox. Two backend replicas
   * can both pass the (best-effort, check-then-act) active-instance-count
   * guard for the same sandbox before either has inserted its claim row —
   * the actual cross-replica guarantee is the partial unique index on
   * `(sandbox_id) WHERE released_at IS NULL` (see schema): only ONE of two
   * concurrent inserts for the same sandbox can succeed. The loser's
   * `ON CONFLICT DO NOTHING` affects zero rows, surfaced here as
   * `{ conflict: true }` for the caller to treat as "already starting
   * elsewhere" — the same 409 the maxInstances check returns, never an error.
   */
  async claimStarting(sandboxId: string) {
    try {
      const resp = await this.db
        .insert(sandboxStartingClaims)
        .values({ sandboxId, claimedAt: new Date() })
        .onConflictDoNothing()
        .returning()

      if (!resp[0]) return { data: null, conflict: true as const }
      return { data: this.model(resp[0]) }
    } catch (error: any) {
      return { error }
    }
  }

  /**
   * Release the active starting-claim for a sandbox, if one exists. Called
   * from a `finally` block around startPod() so the claim is released
   * whether the pod-start succeeds or throws.
   */
  async releaseStarting(sandboxId: string) {
    try {
      const resp = await this.db
        .update(sandboxStartingClaims)
        .set({ releasedAt: new Date(), updatedAt: new Date() })
        .where(
          and(
            eq(sandboxStartingClaims.sandboxId, sandboxId),
            isNull(sandboxStartingClaims.releasedAt)
          )
        )
        .returning()

      if (!resp[0]) return { data: null }
      return { data: this.model(resp[0]) }
    } catch (error: any) {
      return { error }
    }
  }
}
