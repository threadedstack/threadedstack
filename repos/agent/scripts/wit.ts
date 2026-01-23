import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import https from 'node:https'

const DEPS_DIR = 'wit/deps'

// The matrix of standard WASI modules required for 0.2.0
const PACKAGES = [
  {
    name: 'cli',
    repo: 'WebAssembly/wasi-cli',
    tag: 'v0.2.0',
    files: ['command.wit', 'imports.wit', 'run.wit', 'stdio.wit', 'terminal.wit'],
  },
  {
    name: 'clocks',
    repo: 'WebAssembly/wasi-clocks',
    tag: 'v0.2.0',
    files: ['monotonic-clock.wit', 'timezone.wit', 'wall-clock.wit'],
  },
  {
    name: 'filesystem',
    repo: 'WebAssembly/wasi-filesystem',
    tag: 'v0.2.0',
    files: ['preopens.wit', 'types.wit'],
  },
  {
    name: 'http',
    repo: 'WebAssembly/wasi-http',
    tag: 'v0.2.0',
    files: ['incoming-handler.wit', 'outgoing-handler.wit', 'types.wit'],
  },
  {
    name: 'io',
    repo: 'WebAssembly/wasi-io',
    tag: 'v0.2.0',
    files: ['error.wit', 'poll.wit', 'streams.wit'],
  },
  {
    name: 'random',
    repo: 'WebAssembly/wasi-random',
    tag: 'v0.2.0',
    files: ['insecure-seed.wit', 'insecure.wit', 'random.wit'],
  },
  {
    name: 'sockets',
    repo: 'WebAssembly/wasi-sockets',
    tag: 'v0.2.0',
    files: [
      'instance-network.wit',
      'ip-name-lookup.wit',
      'network.wit',
      'tcp-create-socket.wit',
      'tcp.wit',
      'udp-create-socket.wit',
      'udp.wit',
    ],
  },
]

const fetchFile = (url) =>
  new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode !== 200)
          return reject(new Error(`Failed to fetch ${url}: ${res.statusCode}`))
        let data = ''
        res.on('data', (chunk) => (data += chunk))
        res.on('end', () => resolve(data))
      })
      .on('error', reject)
  })

async function main() {
  console.log(`📦 Downloading WASI 0.2.0 dependencies to ${DEPS_DIR}...`)

  for (const pkg of PACKAGES) {
    const pkgDir = join(DEPS_DIR, pkg.name)
    await mkdir(pkgDir, { recursive: true })

    for (const file of pkg.files) {
      const url = `https://raw.githubusercontent.com/${pkg.repo}/${pkg.tag}/wit/${file}`
      try {
        const content = (await fetchFile(url)) as string
        await writeFile(join(pkgDir, file), content)
        console.log(`  ✅ ${pkg.name}/${file}`)
      } catch (err) {
        console.error(`  ❌ Failed: ${url}`, err.message)
      }
    }
  }
  console.log('🎉 Done! Dependencies installed.')
}

main()
