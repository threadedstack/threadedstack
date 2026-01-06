import type { TAnyCB } from '@TDM/types'

export const nextFrame = <T extends TAnyCB = TAnyCB>(cb: T) =>
  requestAnimationFrame(() => cb?.())
