import { execFileSync } from 'node:child_process'
import { appendFile, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { gt, parse } from 'semver'

const root = fileURLToPath(new URL('../', import.meta.url))

async function main() {
  const [scope, before] = process.argv.slice(2)
  if (scope === '--help') {
    console.log(
      'Usage: node script/prepare-releases.mjs <sdk|plugins> <previous-push-sha>'
    )
    return
  }
  const repository = process.env.GITHUB_REPOSITORY
  if (
    !['sdk', 'plugins'].includes(scope) ||
    !/^[0-9a-f]{40}$/.test(before ?? '') ||
    !repository ||
    !process.env.GITHUB_OUTPUT
  ) {
    throw new Error(
      'A release scope (sdk or plugins), previous push SHA, GITHUB_REPOSITORY, and GITHUB_OUTPUT are required'
    )
  }
  const sdk = scope === 'sdk'
  process.chdir(root)
  const git = (...args) =>
    execFileSync('git', args, { encoding: 'utf8' }).trim()
  const base = /^0+$/.test(before)
    ? git('hash-object', '-t', 'tree', '/dev/null')
    : before
  const previousFiles = new Set(
    git('ls-tree', '-r', '--name-only', base).split('\n')
  )
  const files = git(
    'diff',
    '--name-only',
    '--no-renames',
    '--diff-filter=AM',
    base,
    'HEAD',
    '--',
    ...(sdk
      ? [
          'packages/plugin-sdk/package.json',
          'packages/create-plugin-sdk/package.json',
        ]
      : ['plugins/*/package.json'])
  )
    .split('\n')
    .filter(Boolean)
  const releases = new Map()
  for (const path of files) {
    const pkg = JSON.parse(await readFile(path, 'utf8'))
    const previous = previousFiles.has(path)
      ? JSON.parse(git('show', `${base}:${path}`))
      : null
    if (pkg.version === previous?.version) continue
    const id = sdk ? 'plugin-sdk' : path.split('/')[1]
    const expectedName = sdk ? `@kite-dev/${path.split('/')[1]}` : id
    const version = parse(pkg.version)
    if (
      !/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(id) ||
      pkg.name !== expectedName
    ) {
      throw new Error(`Package identity must match its directory: ${path}`)
    }
    if (
      !version ||
      version.version !== pkg.version ||
      version.build.length ||
      (!sdk && version.prerelease.length)
    ) {
      throw new Error(`Invalid release version in ${path}: ${pkg.version}`)
    }
    if (previous && !gt(pkg.version, previous.version)) {
      throw new Error(`${path}: version must increase from ${previous.version}`)
    }
    releases.set(id, `${id}-v${pkg.version}`)
  }
  if (sdk && releases.size > 0) {
    const sdkPackage = JSON.parse(
      await readFile('packages/plugin-sdk/package.json', 'utf8')
    )
    const creator = JSON.parse(
      await readFile('packages/create-plugin-sdk/package.json', 'utf8')
    )
    if (sdkPackage.version !== creator.version) {
      throw new Error('The SDK and creator must have the same version')
    }
  }

  const commit = git('rev-parse', 'HEAD')
  const existingTags = new Set(git('tag', '--list').split('\n'))
  for (const tag of releases.values()) {
    if (
      existingTags.has(tag) &&
      git('rev-parse', `${tag}^{commit}`) !== commit
    ) {
      throw new Error(
        `${tag} already points to another commit; increase the version`
      )
    }
  }
  for (const tag of releases.values()) {
    if (!existingTags.has(tag)) {
      execFileSync(
        'gh',
        [
          'api',
          '--method',
          'POST',
          `repos/${repository}/git/refs`,
          '-f',
          `ref=refs/tags/${tag}`,
          '-f',
          `sha=${commit}`,
        ],
        { stdio: ['ignore', 'ignore', 'inherit'] }
      )
    }
    console.log(`Prepared ${tag}`)
  }
  await appendFile(
    process.env.GITHUB_OUTPUT,
    `tags=${JSON.stringify([...releases.values()])}\n`
  )
  if (releases.size === 0) console.log('No package versions changed')
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
