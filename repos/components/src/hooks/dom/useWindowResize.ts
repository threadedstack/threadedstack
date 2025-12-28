import { EE } from '@TSC/services/eventEmitter'
import { WindowResizeEvt } from '@TSC/constants/events'
import { throttleLast } from '@keg-hub/jsutils/throttleLast'
import { useEffectOnce } from '@TSC/hooks/components/useEffectOnce'

export type TWindowSize = {
  width: number
  height: number
}


export const useWindowResize = () => {

  useEffectOnce(() => {
    // Throttle to avoid the function fire multiple times
    const onResize = throttleLast(() => EE.emit<TWindowSize>(WindowResizeEvt, {
      width: window.innerWidth,
      height: window.innerHeight
    }), 1000)

    // Add the debounced method as the resize listener on the window
    window.addEventListener(`resize`, onResize)

    // Cleanup the listener on unmount
    return () => window.removeEventListener(`resize`, onResize)
  })

}
