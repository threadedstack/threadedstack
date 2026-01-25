#!/usr/bin/env tsx
import { spawn } from 'child_process'
import { existsSync } from 'fs'
import { mkdir } from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const WASM_DIR = path.join(__dirname, '../../dist/wasm')
const BUILD_DASH = process.argv.includes('dash') || process.argv.includes('all')
const BUILD_TOYBOX = process.argv.includes('toybox') || process.argv.includes('all')
const BUILD_ALL = !BUILD_DASH && !BUILD_TOYBOX

async function ensureWasmDir() {
  if (!existsSync(WASM_DIR)) {
    await mkdir(WASM_DIR, { recursive: true })
  }
}

async function runCommand(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: 'inherit' })
    proc.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`Command failed with code ${code}`))
    })
  })
}

async function buildDash() {
  console.log('Building Dash shell WASM module...')
  try {
    await runCommand('tsx', [path.join(__dirname, 'buildDash.ts')])
    console.log('✓ Dash built successfully')
  } catch (error) {
    console.error('✗ Dash build failed:', error)
    throw error
  }
}

async function buildToybox() {
  console.log('Building Toybox utilities WASM module...')
  try {
    await runCommand('tsx', [path.join(__dirname, 'buildToybox.ts')])
    console.log('✓ Toybox built successfully')
  } catch (error) {
    console.error('✗ Toybox build failed:', error)
    throw error
  }
}

async function createZip() {
  console.log('Creating WASM binaries zip...')
  try {
    await runCommand('tsx', [path.join(__dirname, 'createZip.ts')])
    console.log('✓ Zip created successfully')
  } catch (error) {
    console.error('✗ Zip creation failed:', error)
    throw error
  }
}

async function main() {
  await ensureWasmDir()

  if (BUILD_ALL || BUILD_DASH) {
    await buildDash()
  }

  if (BUILD_ALL || BUILD_TOYBOX) {
    await buildToybox()
  }

  await createZip()

  console.log('\n✓ All WASM modules built successfully!')
}

main().catch((error) => {
  console.error('Build failed:', error)
  process.exit(1)
})
