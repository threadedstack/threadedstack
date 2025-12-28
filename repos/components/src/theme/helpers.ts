import { isObj } from '@keg-hub/jsutils/isObj'

export type TClrMix = {
  clr: string
  pr?: string | number
  base?: string
}

export const inherit = {
  color: `inherit`,
  font: `inherit`,
  fontSize: `inherit`,
  fontWeight: `inherit`,
  fontFamily: `inherit`,
  lineHeight: `inherit`,
  letterSpacing: `inherit`,
}

export const cmx = (
  clr: string,
  pr: string | number = `50`,
  base: string = `transparent`
) => {
  return `color-mix(in srgb, ${clr} ${pr}%, ${base})`
}

export const colorMx = ({ clr, pr, base }: TClrMix) => cmx(clr, pr, base)

export const randomHexClr = () => `#` + Math.random().toString(16).slice(2, 8)

export const autofill = (color = `currentColor`, background = `transparent`, el = ``) => {
  return `
    ${el}:-webkit-autofill,
    ${el}:-webkit-autofill:hover,
    ${el}:-webkit-autofill:focus {
      border: none;
      -webkit-text-fill-color: ${color};
      transition: background-color 9999s ease-in-out 0s;
      -webkit-box-shadow: 0 0 0px 1000px ${background} inset;
    }
  `
}

export const autofillSx = (
  color = `text.primary`,
  background = `transparent`,
  el = ``
) => {
  return {
    [`${el}:-webkit-autofill,${el}:-webkit-autofill:hover,${el}:-webkit-autofill:focus`]:
      {
        [`border`]: `none`,
        [`transition`]: `background-color 9999s ease-in-out 0s`,
        [`WebkitTextFillColor`]: `${color}`,
        [`WebkitBoxShadow`]: `0 0 0px 1000px ${background} inset`,
      },
  }
}

type TRGBAObj = {
  r?:number
  g?:number
  b?:number
  a?:number
}

export const toRgba = (r:number|TRGBAObj, g?:number, b?:number, a?:number) => {
  const map = isObj(r)
    ? {...r, g: g || r?.g, b: b || r?.b, a: a || r?.a || 1}
    : {r,g,b,a}

  return `rgba(${map.r}, ${map.g}, ${map.b}, ${map.a})`
}

export const h2ra = (hex:string, alpha:number = 1) => {
  hex = hex.replace(/^#/, '')

  if (hex.length === 3)
    return toRgba(
      parseInt(hex[0] + hex[0], 16),
      parseInt(hex[1] + hex[1], 16),
      parseInt(hex[2] + hex[2], 16),
      alpha
    )

  return toRgba(
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16),
    alpha
  )

}

