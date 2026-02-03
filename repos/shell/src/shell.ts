import { Bash, ReadWriteFs } from 'just-bash'

// @ts-ignore
import { getDirectories } from 'wasi:filesystem/preopens@0.2.0'
// @ts-ignore
import { Descriptor, PathFlags, DescriptorFlags } from 'wasi:filesystem/types@0.2.0'

export function listFiles() {
  const preopens = getDirectories()

  for (const [descriptor, path] of preopens) {
    try {
      // Some shims require you to open the relative path ""
      // to get a handle that has 'readdir' capabilities.
      const dir = descriptor.openAt({ symlinkFollow: true }, '', {
        read: true,
        directory: true,
      })

      const stream = descriptor.readDirectory()

      while (true) {
        const entry = stream.readEntry()
        if (!entry) break
        console.log(`${entry.type}: ${entry.name}`)
      }
    } catch (e) {
      // If openAt("") also fails with no-entry, the shim cannot find /tmp/tdsk on your host.
      console.error(`Failed at ${path}: ${e.message}`)
    }
  }
}

export const run = async (command: string): Promise<string> => {
  try {
    //    console.log(`------- command -------`)
    //    console.log(command)
    //
    //    console.log(`------- globalThis -------`)
    //    console.log(Object.keys(globalThis))
    //
    //    console.log(`------- process.env -------`)
    //    console.log(process.env)

    console.log(`------- process.argv -------`)
    console.log(process.argv)

    //console.log(`------- envs -------`)
    //const envs = getEnvs()
    //console.log(envs)

    //try {
    //  const url = 'https://example.org/products.json'
    //  const response = await fetch(url)
    //  const result = await response.text()
    //  console.log(result)
    //} catch (error) {
    //  console.error(error.message)
    //}

    //    const env = new Bash({
    //      network: {
    //        // Allows all internet access?
    //        dangerouslyAllowFullInternetAccess: true,
    //      },
    //      logger: {
    //        /** Log informational messages (exec commands, stderr, exit codes) */
    //        info: console.info,
    //        /** Log debug messages (stdout output) */
    //        debug: console.debug,
    //      },
    //    })
    //
    //    const result = await env.exec('curl https://example.org/products.json')
    //    console.log(result.stdout)
    //    console.log(result.exitCode)

    //await env.exec('echo "Hello" > greeting.txt');
    //const result = await env.exec("cat greeting.txt");
    //console.log(result.stdout); // "Hello\n"
    //console.log(result.exitCode); // 0
    //console.log(result.env); // Final environment after execution
    return ''
  } catch (err) {
    return 'ERROR: ' + err
  }
}
