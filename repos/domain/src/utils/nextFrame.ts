import type { TAnyCB } from '@TDM/types'

export const nextFrame = <T extends TAnyCB = TAnyCB>(cb: T) =>
  typeof requestAnimationFrame !== `undefined`
    ? requestAnimationFrame(() => cb?.())
    : setTimeout(() => cb?.(), 0)
