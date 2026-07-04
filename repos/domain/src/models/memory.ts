import type { TMemoryKind } from '@TDM/types'

import { EMemoryKind } from '@TDM/types'
import { Base } from '@TDM/models/base'

export class Memory extends Base {
  text!: string
  orgId!: string
  agentId!: string
  importance: number = 5
  lastAccessedAt?: string | Date
  embedding: number[] | null = null
  kind: TMemoryKind = EMemoryKind.fact
  meta: Record<string, any> | null = null

  constructor(memory: Partial<Memory>) {
    super()
    Object.assign(this, memory)
  }
}
