/**
 * Guard against constant drift between the browser-side duplicates
 * in @TTH/tokenizer/types and the canonical values in @tdsk/domain.
 *
 * The threads tokenizer duplicates GhosttyVTCellSize / GhosttyVTConfigSize
 * because domain's parser barrel pulls in node:fs (which breaks Vite).
 * This test ensures the two stay in sync at CI time (Node / vitest).
 */
import { describe, it, expect } from 'vitest'
import {
  GhosttyVTCellSize as BrowserCellSize,
  GhosttyVTConfigSize as BrowserConfigSize,
} from './types'

// Direct relative import from the domain constants source.
// This works because vitest resolves from the filesystem.
import {
  GhosttyVTCellSize as DomainCellSize,
  GhosttyVTConfigSize as DomainConfigSize,
} from '../../../domain/src/constants/parser'

describe(`tokenizer constant drift guard`, () => {
  it(`GhosttyVTCellSize matches domain`, () => {
    expect(BrowserCellSize).toBe(DomainCellSize)
  })

  it(`GhosttyVTConfigSize matches domain`, () => {
    expect(BrowserConfigSize).toBe(DomainConfigSize)
  })
})
