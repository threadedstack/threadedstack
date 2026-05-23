import type { TShimDefinition } from '@TSB/types'
import { SandboxHomePath } from '@tdsk/domain'

export const osShim: TShimDefinition = {
  names: [`os`, `node:os`],

  source: `
    function platform() { return 'linux' }
    function arch() { return 'x64' }
    function type() { return 'Linux' }
    function tmpdir() { return '/tmp' }
    function homedir() { return '${SandboxHomePath}' }
    function hostname() { return 'sandbox' }
    function endianness() { return 'LE' }
    const EOL = '\\n'

    function cpus() {
      return [{ model: 'sandbox-cpu', speed: 2400, times: { user: 0, nice: 0, sys: 0, idle: 0, irq: 0 } }]
    }

    function freemem() { return 1073741824 }
    function totalmem() { return 2147483648 }
    function release() { return '5.15.0-sandbox' }

    function networkInterfaces() {
      return {
        lo: [{ address: '127.0.0.1', netmask: '255.0.0.0', family: 'IPv4', internal: true }],
      }
    }

    function userInfo() {
      return { uid: 1000, gid: 1000, username: 'sandbox', homedir: '${SandboxHomePath}', shell: '/bin/sh' }
    }

    export {
      platform, arch, type, tmpdir, homedir, hostname,
      endianness, EOL, cpus, freemem, totalmem, release,
      networkInterfaces, userInfo,
    }
    export default {
      platform, arch, type, tmpdir, homedir, hostname,
      endianness, EOL, cpus, freemem, totalmem, release,
      networkInterfaces, userInfo,
    }
  `,
}
