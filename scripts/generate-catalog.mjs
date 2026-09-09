import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

import { catalogEntry } from './catalog-entry.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))

function directoryURL(value) {
  const url = new URL(value)
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.search ||
    url.hash ||
    url.username ||
    url.password
  ) {
    throw new Error(
      'Catalog and package base URLs must be HTTP(S) directories without credentials, query strings, or fragments'
    )
  }
  if (!url.pathname.endsWith('/')) url.pathname += '/'
  return url
}

async function main() {
  const { values } = parseArgs({
    options: {
      'base-url': { type: 'string' },
      'package-base-url': { type: 'string' },
      help: { type: 'boolean' },
    },
  })
  if (values.help) {
    console.log(
      'Usage: pnpm catalog --base-url <catalog-directory-url> [--package-base-url <package-directory-url>]'
    )
    return
  }
  if (!values['base-url'])
    throw new Error('--base-url is required; use --help for usage')
  const baseURL = directoryURL(values['base-url'])
  const packageBaseURL = values['package-base-url']
    ? directoryURL(values['package-base-url'])
    : new URL('packages/', baseURL)

  execFileSync('pnpm', ['build'], { cwd: root, stdio: 'inherit' })
  const output = resolve(root, 'dist/catalog')
  await mkdir(resolve(output, 'packages'), { recursive: true })
  const plugins = []
  const directories = (
    await readdir(resolve(root, 'plugins'), { withFileTypes: true })
  )
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()

  for (const name of directories) {
    const directory = resolve(root, 'plugins', name)
    const manifest = JSON.parse(
      await readFile(resolve(directory, 'dist/plugin.json'), 'utf8')
    )
    if (plugins.some((plugin) => plugin.id === manifest.id)) {
      throw new Error(`Duplicate plugin ID: ${manifest.id}`)
    }
    const filename = `${manifest.id}-${manifest.version}.tar.gz`
    const archive = resolve(output, 'packages', filename)
    execFileSync(
      'pnpm',
      ['--dir', directory, 'exec', 'kite-plugin', 'pack', 'dist', archive],
      {
        cwd: root,
        stdio: 'inherit',
      }
    )
    let readmeUrl
    const readme = resolve(directory, 'dist/README.md')
    if (existsSync(readme)) {
      const readmeDirectory = `readmes/${manifest.id}/${manifest.version}`
      await mkdir(resolve(output, readmeDirectory), { recursive: true })
      await writeFile(
        resolve(output, readmeDirectory, 'README.md'),
        await readFile(readme)
      )
      readmeUrl = new URL(`${readmeDirectory}/README.md`, baseURL).href
    }
    plugins.push(
      catalogEntry(
        manifest,
        await readFile(archive),
        new URL(filename, packageBaseURL).href,
        readmeUrl
      )
    )
  }
  await writeFile(
    resolve(output, 'catalog.json'),
    `${JSON.stringify({ plugins }, null, 2)}\n`
  )
  console.log(
    `Catalog: ${resolve(output, 'catalog.json')}\nSource URL: ${new URL('catalog.json', baseURL).href}`
  )
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
