import { execFileSync } from 'node:child_process'
import { mkdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { prerelease } from 'semver'

const root = fileURLToPath(new URL('../', import.meta.url))

async function main() {
  const [tag] = process.argv.slice(2)
  if (tag === '--help') {
    console.log('Usage: node script/publish-sdk.mjs plugin-sdk-v<version>')
    return
  }
  process.chdir(root)
  const directories = ['packages/plugin-sdk', 'packages/create-plugin-sdk']
  const packages = await Promise.all(
    directories.map(async (directory) => ({
      directory,
      ...JSON.parse(await readFile(`${directory}/package.json`, 'utf8')),
    }))
  )
  const version = packages[0].version
  if (tag !== `plugin-sdk-v${version}`) {
    throw new Error(`Git tag must match package.json: plugin-sdk-v${version}`)
  }
  if (packages[1].version !== version) {
    throw new Error('The SDK and creator must have the same version')
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
  for (const { directory } of packages) {
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
  for (const { name } of packages) {
    const response = await fetch(
      `https://registry.npmjs.org/${encodeURIComponent(name)}/${version}`
    )
    if (response.ok) {
      console.log(`${name}@${version} is already published; skipping`)
      continue
    }
    if (response.status !== 404) {
      throw new Error(
        `Failed to check ${name}@${version}: HTTP ${response.status}`
      )
    }
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
