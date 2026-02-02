import { Bash } from 'just-bash'

// Shim zlib for just-bash
//import { inflate } from 'pako';
//(globalThis as any).zlib = { inflate };

export const runBash = async (): Promise<string> => {
  try {
    //console.log(Object.keys(globalThis))

    //try {
    //  const url = 'https://example.org/products.json'
    //  const response = await fetch(url)
    //  const result = await response.text()
    //  console.log(result)
    //} catch (error) {
    //  console.error(error.message)
    //}

    const env = new Bash({
      network: {
        // Allows all internet access?
        dangerouslyAllowFullInternetAccess: true,
      },
      logger: {
        /** Log informational messages (exec commands, stderr, exit codes) */
        info: console.info,
        /** Log debug messages (stdout output) */
        debug: console.debug,
      },
    })

    const result = await env.exec('curl https://example.org/products.json')
    console.log(result.stdout)
    console.log(result.exitCode)

    //await env.exec('echo "Hello" > greeting.txt');
    //const result = await env.exec("cat greeting.txt");
    //console.log(result.stdout); // "Hello\n"
    //console.log(result.exitCode); // 0
    //console.log(result.env); // Final environment after execution
    return 'SUCCESS: Bash executed.'
  } catch (err) {
    return 'ERROR: ' + err
  }
}
