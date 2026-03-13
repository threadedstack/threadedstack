import { isNum } from '@keg-hub/jsutils/isNum'

const size = 16

const sizes = {
  [0]: 0,
  q: size / 4,
  qpx: `${size / 4}px`, // 4px
  [0.5]: `${size / 4}px`,

  s: ((size / 4) * 3) / 2,
  spx: `${((size / 4) * 3) / 2}px`, // 6px
  [0.75]: `${((size / 4) * 3) / 2}px`,

  h: size / 2,
  hpx: `${size / 2}px`, // 8px
  [1]: `${size / 2}px`,

  c: (size / 4) * 2.5,
  cpx: `${(size / 4) * 2.5}px`, // 10px

  t: (size / 4) * 3,
  tpx: `${(size / 4) * 3}px`, // 12px

  size: size,
  px: `${size}px`, // 16px
  [2]: `${size}px`,

  r: size * 1.25,
  rpx: `${size * 1.25}px`, // 20px
  [2.25]: `${size * 1.25}px`,

  m: size * 1.5,
  mpx: `${size * 1.5}px`, // 24px
  [2.5]: `${size * 1.5}px`,

  d: size * 2,
  dpx: `${size * 2}px`, // 32px
  [3]: `${size * 2}px`,

  ph: `0px ${size}px`,
  pv: `${size}px 0px`,
  mh: `0px ${size}px`,
  mv: `${size}px 0px`,
  sx: {
    mt: { marginTop: `${size}px` },
    ml: { marginLeft: `${size}px` },
    mb: { marginBottom: `${size}px` },
    mr: { marginRight: `${size}px` },
    pt: { paddingTop: `${size}px` },
    pl: { paddingLeft: `${size}px` },
    pb: { paddingBottom: `${size}px` },
    pr: { paddingRight: `${size}px` },
    rm: { margin: `revert`, padding: `revert` },
  },
  css: {
    rm: `
      margin: revert;
      padding: revert;
    `,
    mt: `margin-top: ${size}px`,
    ml: `margin-left: ${size}px`,
    mr: `margin-right: ${size}px`,
    mb: `margin-bottom: ${size}px`,
    pt: `padding-top: ${size}px`,
    pl: `padding-left: ${size}px`,
    pr: `padding-right: ${size}px`,
    pb: `padding-bottom: ${size}px`,
  },
}

type TGutter = ((...args: Array<number | string>) => string) & typeof sizes

export const gutter = ((...args: Array<number | string>) => {
  return args.map((part) => (isNum(part) ? `${(size / 2) * part}px` : part)).join(` `)
}) as TGutter

Object.assign(gutter, sizes)
