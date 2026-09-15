import { execFileSync } from 'node:child_process'
import { mkdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse, prerelease } from 'semver'

const root = fileURLToPath(new URL('../', import.meta.url))

async function main() {
  if (process.argv[2] === '--help') {
    console.log(
      'Usage: GITHUB_REPOSITORY=owner/repo node script/publish-sdk.mjs'
    )
    return
  }
  const repository = process.env.GITHUB_REPOSITORY
  if (!repository) throw new Error('GITHUB_REPOSITORY is required')
  process.chdir(root)
  const directories = ['packages/plugin-sdk', 'packages/create-plugin-sdk']
  const packages = await Promise.all(
    directories.map(async (directory) => ({
      directory,
      ...JSON.parse(await readFile(`${directory}/package.json`, 'utf8')),
    }))
  )
  const version = packages[0].version
  const parsed = parse(version)
  if (!parsed || parsed.version !== version || parsed.build.length) {
    throw new Error(`Invalid SDK release version: ${version}`)
  }
  if (packages[1].version !== version) {
    throw new Error('The SDK and creator must have the same version')
  }
  const pending = []
  for (const pkg of packages) {
    if (pkg.name !== `@kite-dev/${pkg.directory.split('/')[1]}`) {
      throw new Error(
        `Package identity must match its directory: ${pkg.directory}`
      )
    }
    const response = await fetch(
      `https://registry.npmjs.org/${encodeURIComponent(pkg.name)}/${version}`
    )
    if (response.ok) {
      console.log(`${pkg.name}@${version} is already published; skipping`)
    } else if (response.status === 404) {
      pending.push(pkg)
    } else {
      throw new Error(
        `Failed to check ${pkg.name}@${version}: HTTP ${response.status}`
      )
    }
  }
  if (pending.length === 0) return

  const tag = `plugin-sdk-v${version}`
  const git = (...args) =>
    execFileSync('git', args, { encoding: 'utf8' }).trim()
  const commit = git('rev-parse', 'HEAD')
  const existingTag = git('tag', '--list', tag)
  if (existingTag && git('rev-parse', `${tag}^{commit}`) !== commit) {
    throw new Error(
      `${tag} already points to another commit; increase the version`
    )
  }
  const npmTag = prerelease(version) === null ? 'latest' : 'beta'
  const output = resolve(root, 'dist/npm')
  await mkdir(output, { recursive: true })

  execFileSync('pnpm', ['--filter', '@kite-dev/plugin-sdk', 'run', 'build'], {
    stdio: 'inherit',
  })
  execFileSync(
    process.execPath,
    ['packages/create-plugin-sdk/index.js', '--help'],
    {
      stdio: 'inherit',
    }
  )
  for (const { directory } of pending) {
    execFileSync(
      'pnpm',
      [
        '--dir',
        directory,
        '--config.ignore-scripts=true',
        'pack',
        '--pack-destination',
        output,
      ],
      { stdio: 'inherit' }
    )
  }
  if (!existingTag) {
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
  for (const { name } of pending) {
    const archive = resolve(
      output,
      `${name.replace('@', '').replace('/', '-')}-${version}.tgz`
    )
    execFileSync(
      'npm',
      [
        'publish',
        archive,
        '--access',
        'public',
        '--tag',
        npmTag,
        '--ignore-scripts',
      ],
      { stdio: 'inherit' }
    )
  }
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
