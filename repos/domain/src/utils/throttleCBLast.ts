
export const throttleCBLast = (
  func:(...args:any) => any,
  wait:number
) => {
  let throttleTimeout

  return function(cb:(resp:any) => any, ...args:any[]) {
    throttleTimeout && clearTimeout(throttleTimeout)

    throttleTimeout = setTimeout(() => {
      const resp = func.apply(this, args)
      cb?.(resp)
      clearTimeout(throttleTimeout)
    }, wait)

  }
}
