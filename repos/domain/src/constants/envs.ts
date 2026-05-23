/**
 * TODO: Reuse this constant across the other repose where the home path is used
 * Will ensure it's consistent and doesn't drift
 * Need a better way to load the "TDSK_SB_HOME" env
 */
export const SandboxHomePath = process.env.TDSK_SB_HOME || `/home/sandbox`
