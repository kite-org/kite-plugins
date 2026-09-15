import { execFileSync } from 'node:child_process'
import { appendFile, readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))

async function main() {
  const [scope] = process.argv.slice(2)
  if (scope === '--help') {
    console.log('Usage: node script/check-versions.mjs <sdk|plugins>')
    return
  }
  if (!['sdk', 'plugins'].includes(scope) || !process.env.GITHUB_OUTPUT) {
    throw new Error(
      'A release scope (sdk or plugins) and GITHUB_OUTPUT are required'
    )
  }
  process.chdir(root)
  const sdk = scope === 'sdk'
  const directories = sdk
    ? ['packages/plugin-sdk', 'packages/create-plugin-sdk']
    : (await readdir('plugins', { withFileTypes: true }))
        .filter((directory) => directory.isDirectory())
        .map((directory) => `plugins/${directory.name}`)
  let releases
  if (!sdk) {
    const repository = process.env.GITHUB_REPOSITORY
    if (!repository) throw new Error('GITHUB_REPOSITORY is required')
    releases = JSON.parse(
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
  }
  const pending = []
  for (const directory of directories) {
    const { name, version } = JSON.parse(
      await readFile(`${directory}/package.json`, 'utf8')
    )
    let published
    if (sdk) {
      const response = await fetch(
        `https://registry.npmjs.org/${encodeURIComponent(name)}/${version}`
      )
      if (!response.ok && response.status !== 404) {
        throw new Error(
          `Failed to check ${name}@${version}: HTTP ${response.status}`
        )
      }
      published = response.ok
    } else {
      const tag = `${name}-v${version}`
      const release = releases.find((item) => item.tag_name === tag)
      const filename = `${name}-${version}.tar.gz`
      const asset = release?.assets.find((item) => item.name === filename)
      if (release?.prerelease)
        throw new Error(`${tag} must be a stable release`)
      if (asset && asset.state !== 'uploaded') {
        throw new Error(
          `Release ${tag} has an incomplete asset; remove the unfinished draft upload before retrying`
        )
      }
      published = Boolean(release && !release.draft)
      if (published && !asset) {
        throw new Error(`Published release ${tag} is missing ${filename}`)
      }
    }
    if (published) {
      console.log(`${name}@${version} is already published; skipping`)
    } else {
      console.log(`${name}@${version} needs publishing`)
      pending.push(directory)
    }
  }
  await appendFile(
    process.env.GITHUB_OUTPUT,
    `publish=${pending.length > 0}\npackages=${JSON.stringify(pending)}\n`
  )
}

main().catch((error) => {
  console.error(error.message)
  process.exitCode = 1
})
