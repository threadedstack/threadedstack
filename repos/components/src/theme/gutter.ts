const size = 16

export const gutter = {
  q: size / 4,
  qpx: `${size / 4}px`, // 4px
  s: ((size / 4) * 3) / 2,
  spx: `${((size / 4) * 3) / 2}px`, // 6px
  h: size / 2,
  hpx: `${size / 2}px`, // 8px
  c: (size / 4) * 2.5,
  cpx: `${(size / 4) * 2.5}px`, // 10px
  t: (size / 4) * 3,
  tpx: `${(size / 4) * 3}px`, // 12px
  size: size,
  px: `${size}px`, // 16px
  r: size * 1.25,
  rpx: `${size * 1.25}px`, // 20px
  m: size * 1.5,
  mpx: `${size * 1.5}px`, // 24px
  d: size * 2,
  dpx: `${size * 2}px`, // 32px
  ph: `0px ${size}px`,
  pv: `${size}px 0px`,
  mh: `0px ${size}px`,
  mv: `${size}px 0px`,
  sx: {
    marginTop: { marginTop: `${size}px` },
    marginLeft: { marginLeft: `${size}px` },
    marginBottom: { marginBottom: `${size}px` },
    marginRight: { marginRight: `${size}px` },
    paddingTop: { paddingTop: `${size}px` },
    paddingLeft: { paddingLeft: `${size}px` },
    paddingBottom: { paddingBottom: `${size}px` },
    paddingRight: { paddingRight: `${size}px` },
  },
  css: {
    remove: `
      margin: revert;
      padding: revert;
    `,
  },
}
