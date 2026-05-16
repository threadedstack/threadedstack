/**
 * Guard against constant drift between the browser-side duplicates
 * in @TTH/tokenizer/types and the canonical values in @tdsk/domain.
 *
 * The threads tokenizer duplicates VTCellSize because domain's parser
 * barrel pulls in node:fs (which breaks Vite).
 * This test ensures the two stay in sync at CI time (Node / vitest).
 */
import { describe, it, expect } from 'vitest'
import { VTCellSize as BrowserCellSize } from '@TTH/constants/tokenizer'

import { GhosttyVTCellSize as DomainCellSize } from '@tdsk/domain'

describe(`tokenizer constant drift guard`, () => {
  it(`VTCellSize matches domain`, () => {
    expect(BrowserCellSize).toBe(DomainCellSize)
  })
})
