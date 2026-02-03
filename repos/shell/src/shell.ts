import { Bash, ReadWriteFs } from 'just-bash'

import { join } from 'node:path'
import { dirname } from 'path'

export const run = async (command: string): Promise<string> => {
  try {
    const location = join(`/duper`, `file.txt`)
    console.log(`------- join - location -------`)
    console.log(location)
    console.log(`------- dirname - location -------`)
    console.log(dirname(location))

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
