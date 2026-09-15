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
  if (process.argv[2] === '--help') {
    console.log(
      "Usage: GITHUB_REPOSITORY=owner/repo RELEASE_PACKAGES='<package-directory-array>' node script/publish-plugins.mjs"
    )
    return
  }
  const repository = process.env.GITHUB_REPOSITORY
  if (!repository || !process.env.RELEASE_PACKAGES) {
    throw new Error(
      'GITHUB_REPOSITORY and RELEASE_PACKAGES from check-versions are required'
    )
  }
  process.chdir(root)
  const git = (...args) =>
    execFileSync('git', args, { encoding: 'utf8' }).trim()
  const commit = git('rev-parse', 'HEAD')
  const existingTags = new Set(git('tag', '--list').split('\n'))
  const plugins = []
  for (const directory of JSON.parse(process.env.RELEASE_PACKAGES)) {
    const path = `${directory}/package.json`
    const pkg = JSON.parse(await readFile(path, 'utf8'))
    const tag = `${pkg.name}-v${pkg.version}`
    const identity = releaseIdentity(tag)
    if (!identity || identity.id !== directory.split('/')[1]) {
      throw new Error(`Invalid plugin name or release version in ${path}`)
    }
    plugins.push({ ...identity, tag })
  }
  const listReleases = () =>
    JSON.parse(
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
  let releases = listReleases()
  const pending = []
  for (const plugin of plugins) {
    const { id, version, tag } = plugin
    const release = releases.find((item) => item.tag_name === tag)
    const filename = `${id}-${version}.tar.gz`
    const asset = release?.assets.find((item) => item.name === filename)
    if (
      !asset &&
      existingTags.has(tag) &&
      git('rev-parse', `${tag}^{commit}`) !== commit
    ) {
      throw new Error(
        `${tag} already points to another commit; increase the version`
      )
    }
    pending.push({ ...plugin, release, asset, filename })
  }

  const output = resolve(root, 'dist/release')
  await mkdir(output, { recursive: true })
  for (const { id, version, tag, release, asset, filename } of pending) {
    const directory = resolve(root, 'plugins', id)
    const archive = resolve(output, filename)
    if (!asset) {
      execFileSync('pnpm', ['--filter', `${id}...`, 'run', 'build'], {
        stdio: 'inherit',
      })
      execFileSync(
        'pnpm',
        ['--dir', directory, 'exec', 'kite-plugin', 'pack', 'dist', archive],
        {
          stdio: 'inherit',
        }
      )
      const manifest = JSON.parse(
        execFileSync('tar', ['-xOf', archive, 'plugin.json'], {
          encoding: 'utf8',
        })
      )
      if (manifest.id !== id || manifest.version !== version) {
        throw new Error('Plugin archive does not match package.json')
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
            '--target',
            commit,
            '--draft',
            '--title',
            `${id} ${version}`,
            '--notes',
            `Kite plugin ${id} ${version}.`,
          ],
          { stdio: 'inherit' }
        )
      } else {
        execFileSync(
          'gh',
          ['release', 'upload', tag, archive, '--repo', repository],
          { stdio: 'inherit' }
        )
      }
    }
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
      {
        stdio: 'inherit',
      }
    )
    console.log(`Published ${id}@${version}`)
  }

  if (pending.length > 0) releases = listReleases()
  const catalog = { plugins: [] }
  for (const release of releases) {
    const identity = releaseIdentity(release.tag_name)
    if (release.draft || release.prerelease || !identity) continue
    const { id, version } = identity
    const tag = release.tag_name
    const filename = `${id}-${version}.tar.gz`
    if (
      !release.assets.some(
        (asset) => asset.name === filename && asset.state === 'uploaded'
      )
    ) {
      throw new Error(`Published release ${tag} is missing ${filename}`)
    }
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
    const archive = resolve(output, filename)
    const manifest = JSON.parse(
      execFileSync('tar', ['-xOf', archive, 'plugin.json'], {
        encoding: 'utf8',
      })
    )
    if (manifest.id !== id || manifest.version !== version) {
      throw new Error(`Plugin archive does not match ${tag}`)
    }
    const files = execFileSync('tar', ['-tzf', archive], {
      encoding: 'utf8',
    }).split('\n')
    const readmeURL = files.includes('README.md')
      ? `https://raw.githubusercontent.com/${repository}/${tag}/plugins/${id}/README.md`
      : undefined
    catalog.plugins.push(
      catalogEntry(
        manifest,
        await readFile(archive),
        `https://github.com/${repository}/releases/download/${tag}/${filename}`,
        readmeURL
      )
    )
  }
  catalog.plugins.sort(
    (a, b) => a.id.localeCompare(b.id) || rcompare(a.version, b.version)
  )
  const pages = resolve(root, 'dist/pages')
  await mkdir(pages, { recursive: true })
  await writeFile(
    resolve(pages, 'catalog.json'),
    `${JSON.stringify(catalog, null, 2)}\n`
  )
  console.log(`Catalog ready at ${resolve(pages, 'catalog.json')}`)
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
