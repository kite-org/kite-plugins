import { execFileSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { rcompare, valid } from 'semver'

import { catalogEntry } from './catalog-entry.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))

function releaseIdentity(tag) {
  const match =
    /^([a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?)-v(\d+\.\d+\.\d+)$/.exec(tag)
  if (!match || valid(match[2]) !== match[2]) return null
  return { id: match[1], version: match[2] }
}

async function main() {
  const [tag, catalogURL] = process.argv.slice(2)
  if (tag === '--help') {
    console.log(
      'Usage: GITHUB_REPOSITORY=owner/repo node scripts/publish-plugin.mjs <plugin-id>-v<version> <catalog-url>'
    )
    return
  }
  const identity = releaseIdentity(tag ?? '')
  const repository = process.env.GITHUB_REPOSITORY
  if (!identity || !catalogURL || !repository) {
    throw new Error(
      'A stable plugin tag, catalog URL, and GITHUB_REPOSITORY are required'
    )
  }
  process.chdir(root)
  const { id, version } = identity
  const directory = resolve(root, 'plugins', id)
  const pkg = JSON.parse(
    await readFile(resolve(directory, 'package.json'), 'utf8')
  )
  if (pkg.name !== id || pkg.version !== version) {
    throw new Error(`Tag ${tag} must match plugins/${id}/package.json`)
  }
  const commit = execFileSync('git', ['rev-parse', `${tag}^{commit}`], {
    encoding: 'utf8',
  }).trim()
  const head = execFileSync('git', ['rev-parse', 'HEAD'], {
    encoding: 'utf8',
  }).trim()
  if (head !== commit) throw new Error(`Check out ${tag} before publishing`)

  const releases = JSON.parse(
    execFileSync(
      'gh',
      [
        'api',
        '--paginate',
        '--slurp',
        `repos/${repository}/releases?per_page=100`,
      ],
      { encoding: 'utf8' }
    )
  ).flat()
  const previous = releases.filter(
    (release) =>
      !release.draft &&
      !release.prerelease &&
      release.tag_name !== tag &&
      releaseIdentity(release.tag_name)
  )
  const address = new URL(catalogURL)
  address.searchParams.set('release', `${tag}-${Date.now()}`)
  const response = await fetch(address, {
    headers: { 'Cache-Control': 'no-cache' },
    signal: AbortSignal.timeout(30_000),
  })
  let catalog
  if (response.status === 404 && previous.length === 0) {
    catalog = { plugins: [] }
  } else if (response.ok) {
    catalog = await response.json()
  } else {
    throw new Error(
      `Cannot read the existing catalog: HTTP ${response.status}; refusing to replace it`
    )
  }
  if (!Array.isArray(catalog.plugins))
    throw new Error('Invalid catalog: plugins must be an array')
  for (const release of previous) {
    const published = releaseIdentity(release.tag_name)
    const filename = `${published.id}-${published.version}.tar.gz`
    if (
      !release.assets.some(
        (asset) => asset.name === filename && asset.state === 'uploaded'
      )
    ) {
      throw new Error(
        `Published release ${release.tag_name} is missing ${filename}`
      )
    }
    if (
      !catalog.plugins.some(
        (plugin) =>
          plugin.id === published.id && plugin.version === published.version
      )
    ) {
      throw new Error(
        `Catalog is missing ${release.tag_name}; retry after Pages updates, or rerun that release's workflow first`
      )
    }
  }

  const output = resolve(root, 'dist/release')
  await mkdir(output, { recursive: true })
  const filename = `${id}-${version}.tar.gz`
  const archive = resolve(output, filename)
  const release = releases.find((item) => item.tag_name === tag)
  const asset = release?.assets.find((item) => item.name === filename)
  if (release?.prerelease) throw new Error(`${tag} must be a stable release`)
  if (asset && asset.state !== 'uploaded') {
    throw new Error(
      `Release ${tag} has an incomplete asset; remove the unfinished draft upload before retrying`
    )
  }
  if (asset) {
    execFileSync(
      'gh',
      [
        'release',
        'download',
        tag,
        '--repo',
        repository,
        '--pattern',
        filename,
        '--dir',
        output,
        '--clobber',
      ],
      { stdio: 'inherit' }
    )
  } else {
    if (release && !release.draft)
      throw new Error(`Published release ${tag} is missing ${filename}`)
    execFileSync('pnpm', ['--dir', directory, 'run', 'build'], {
      stdio: 'inherit',
    })
    execFileSync(
      'pnpm',
      ['--dir', directory, 'exec', 'kite-plugin', 'pack', 'dist', archive],
      { stdio: 'inherit' }
    )
  }
  const manifest = JSON.parse(
    execFileSync('tar', ['-xOf', archive, 'plugin.json'], { encoding: 'utf8' })
  )
  if (manifest.id !== id || manifest.version !== version)
    throw new Error('Plugin archive does not match the release tag')
  const files = execFileSync('tar', ['-tzf', archive], {
    encoding: 'utf8',
  }).split('\n')
  const readmeURL = files.includes('README.md')
    ? `https://raw.githubusercontent.com/${repository}/${commit}/plugins/${id}/README.md`
    : undefined
  const entry = catalogEntry(
    manifest,
    await readFile(archive),
    `https://github.com/${repository}/releases/download/${tag}/${filename}`,
    readmeURL
  )
  const existing = catalog.plugins.find(
    (plugin) => plugin.id === id && plugin.version === version
  )
  if (existing && existing.sha256 !== entry.sha256) {
    throw new Error(
      `${id}@${version} already has a different checksum; publish a new version`
    )
  }

  if (!release) {
    execFileSync(
      'gh',
      [
        'release',
        'create',
        tag,
        archive,
        '--repo',
        repository,
        '--verify-tag',
        '--draft',
        '--title',
        `${id} ${version}`,
        '--notes',
        `Kite plugin ${id} ${version}.`,
      ],
      { stdio: 'inherit' }
    )
  } else if (release.draft && !asset) {
    execFileSync(
      'gh',
      ['release', 'upload', tag, archive, '--repo', repository],
      { stdio: 'inherit' }
    )
  }
  if (!release || release.draft) {
    execFileSync(
      'gh',
      [
        'release',
        'edit',
        tag,
        '--repo',
        repository,
        '--draft=false',
        '--latest=false',
      ],
      { stdio: 'inherit' }
    )
  }

  if (!existing) catalog.plugins.push(entry)
  catalog.plugins.sort(
    (a, b) => a.id.localeCompare(b.id) || rcompare(a.version, b.version)
  )
  const pages = resolve(root, 'dist/pages')
  await mkdir(pages, { recursive: true })
  await writeFile(
    resolve(pages, 'catalog.json'),
    `${JSON.stringify(catalog, null, 2)}\n`
  )
  console.log(
    `Published ${tag}; catalog ready at ${resolve(pages, 'catalog.json')}`
  )
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
