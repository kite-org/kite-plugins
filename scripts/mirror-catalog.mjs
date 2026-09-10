import { createHash } from 'node:crypto'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

async function download(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(90_000) })
  if (!response.ok)
    throw new Error(`Cannot download ${url}: HTTP ${response.status}`)
  return Buffer.from(await response.arrayBuffer())
}

async function main() {
  const [catalogPath, baseURL] = process.argv.slice(2)
  if (catalogPath === '--help') {
    console.log(
      'Usage: node scripts/mirror-catalog.mjs <catalog.json> <mirror-base-url>'
    )
    return
  }
  if (!catalogPath || !baseURL)
    throw new Error('A catalog file and mirror base URL are required')

  const address = new URL(baseURL)
  if (address.protocol !== 'https:' || address.search || address.hash)
    throw new Error('The mirror base URL must be an HTTPS directory')
  if (!address.pathname.endsWith('/')) address.pathname += '/'

  const catalog = JSON.parse(await readFile(catalogPath, 'utf8'))
  const output = fileURLToPath(new URL('../dist/edgeone/', import.meta.url))
  await rm(output, { recursive: true, force: true })
  await mkdir(resolve(output, 'packages'), { recursive: true })

  for (const plugin of catalog.plugins) {
    const archive = await download(plugin.url)
    const digest = createHash('sha256').update(archive).digest('hex')
    if (digest !== plugin.sha256)
      throw new Error(`Checksum mismatch for ${plugin.id}@${plugin.version}`)

    const packagePath = `packages/${plugin.id}-${plugin.version}.tar.gz`
    await writeFile(resolve(output, packagePath), archive)
    plugin.url = new URL(packagePath, address).href

    if (plugin.readmeUrl) {
      const readme = await download(plugin.readmeUrl)
      const directory = `readmes/${plugin.id}/${plugin.version}`
      await mkdir(resolve(output, directory), { recursive: true })
      await writeFile(resolve(output, directory, 'README.md'), readme)
      plugin.readmeUrl = new URL(`${directory}/README.md`, address).href
    }
    console.log(`Mirrored ${plugin.id}@${plugin.version}`)
  }

  await writeFile(
    resolve(output, 'catalog.json'),
    `${JSON.stringify(catalog, null, 2)}\n`
  )
  await writeFile(
    resolve(output, 'index.html'),
    '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><title>Kite Plugins</title></head><body><h1>Kite Plugins</h1><a href="catalog.json">Plugin catalog</a></body></html>\n'
  )
  console.log(`Mirror ready: ${new URL('catalog.json', address).href}`)
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
