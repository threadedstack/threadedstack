/**
 * The `TDSK_WITH_LB_PROXY` ENV gets set when a service is started via devspace
 * It should exist any time there is a loadbalancer in front of it
 * Within a kubernetes context
 */
export const behindLBProxy = () => Boolean(process.env.TDSK_WITH_LB_PROXY)
