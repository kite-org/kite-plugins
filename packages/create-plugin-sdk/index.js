#!/usr/bin/env node
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs'
import { basename, dirname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import * as prompts from '@clack/prompts'
import sdk from '@kite-dev/plugin-sdk/package.json' with { type: 'json' }
import {
  defaultKiteRange,
  validatePluginIdentity,
} from '@kite-dev/plugin-sdk/validation'

const usage = `Usage: create-plugin-sdk [directory] [options]

Options:
  --display-name <name>  Plugin display name
  -y, --yes             Use defaults without prompting
  -h, --help            Show this help

Examples:
  npm create @kite-dev/plugin-sdk my-plugin
  pnpm create @kite-dev/plugin-sdk my-plugin`

function metadataError(id, name) {
  try {
    validatePluginIdentity(id, name)
  } catch (error) {
    return error.message
  }
}

function directoryError(directory) {
  const target = resolve(directory)
  const error = metadataError(basename(target), 'Plugin')
  if (error) return error
  if (existsSync(target)) {
    if (!lstatSync(target).isDirectory())
      return 'The target path must be a directory.'
    if (readdirSync(target).some((entry) => entry !== '.git'))
      return 'The target directory is not empty. Choose an empty directory.'
  }
}

function workspaceTooling(target) {
  let directory = dirname(target)
  while (true) {
    const packagePath = resolve(directory, 'package.json')
    const metadata = existsSync(packagePath)
      ? JSON.parse(readFileSync(packagePath, 'utf8'))
      : {}
    if (
      existsSync(resolve(directory, 'pnpm-workspace.yaml')) ||
      Array.isArray(metadata.workspaces) ||
      Array.isArray(metadata.workspaces?.packages)
    ) {
      const eslint = ['js', 'mjs', 'cjs', 'ts', 'mts', 'cts'].some(
        (extension) =>
          existsSync(resolve(directory, `eslint.config.${extension}`))
      )
      const prettier =
        metadata.prettier !== undefined ||
        [
          '.prettierrc',
          ...[
            'json',
            'json5',
            'yaml',
            'yml',
            'toml',
            'js',
            'cjs',
            'mjs',
            'ts',
            'cts',
            'mts',
          ].map((extension) => `.prettierrc.${extension}`),
          ...['js', 'cjs', 'mjs', 'ts', 'cts', 'mts'].map(
            (extension) => `prettier.config.${extension}`
          ),
        ].some((file) => existsSync(resolve(directory, file)))
      const sdkDirectory = dirname(
        fileURLToPath(import.meta.resolve('@kite-dev/plugin-sdk/package.json'))
      )
      const workspaceSdk =
        existsSync(resolve(directory, 'pnpm-workspace.yaml')) &&
        sdkDirectory.startsWith(`${directory}${sep}`) &&
        !sdkDirectory
          .slice(directory.length)
          .split(sep)
          .includes('node_modules')
      return { eslint, prettier, workspaceSdk }
    }
    const parent = dirname(directory)
    if (parent === directory) return { eslint: false, prettier: false }
    directory = parent
  }
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      'display-name': { type: 'string' },
      yes: { type: 'boolean', short: 'y', default: false },
      help: { type: 'boolean', short: 'h', default: false },
    },
  })
  if (values.help) {
    console.log(usage)
    return
  }
  if (positionals.length > 1) throw new Error(usage)
  const interactive = process.stdin.isTTY && process.stdout.isTTY && !values.yes
  if (!interactive && !positionals[0] && !values.yes) {
    throw new Error(
      'Specify a project directory or use --yes to create my-plugin.'
    )
  }
  if (positionals[0]) {
    const error = directoryError(positionals[0])
    if (error) throw new Error(error)
  }

  prompts.intro('Create a Kite plugin')
  const answers = await prompts.group(
    {
      directory: async () =>
        positionals[0] ??
        (interactive
          ? prompts.text({
              message: 'Project directory',
              initialValue: 'my-plugin',
              validate: (value) =>
                value?.trim()
                  ? directoryError(value.trim())
                  : 'Enter a project directory.',
            })
          : 'my-plugin'),
      displayName: async ({ results }) =>
        values['display-name'] ??
        (interactive
          ? prompts.text({
              message: 'Plugin display name',
              initialValue: basename(resolve(results.directory.trim())),
              validate: (value) =>
                metadataError(
                  basename(resolve(results.directory.trim())),
                  value?.trim()
                ),
            })
          : basename(resolve(results.directory.trim()))),
    },
    {
      onCancel: () => {
        prompts.cancel('Plugin creation cancelled.')
        process.exit(0)
      },
    }
  )

  const directory = answers.directory.trim()
  const target = resolve(directory)
  const id = basename(target)
  const displayName = answers.displayName.trim()
  const error = directoryError(directory) ?? metadataError(id, displayName)
  if (error) throw new Error(error)

  const sharedTooling = workspaceTooling(target)
  const toolingDependencies = [
    ...(sharedTooling.eslint
      ? []
      : [
          '@eslint/js',
          'eslint',
          'eslint-plugin-react-hooks',
          'globals',
          'typescript-eslint',
        ]),
    ...(sharedTooling.prettier
      ? []
      : ['@ianvs/prettier-plugin-sort-imports', 'prettier']),
  ]
  const metadata = {
    name: id,
    displayName,
    version: '0.1.0',
    private: true,
    type: 'module',
    license: 'Apache-2.0',
    description: '',
    engines: { kite: defaultKiteRange },
    scripts: {
      'type-check': 'tsc --noEmit',
      build: 'tsc --noEmit && vite build',
      dev: 'kite-plugin dev',
      pack: 'kite-plugin pack',
      lint: 'eslint .',
      'lint:fix': 'eslint . --fix',
      format: 'prettier --write .',
      'format:check': 'prettier --check .',
    },
    dependencies: {
      [sdk.name]: sharedTooling.workspaceSdk ? 'workspace:^' : sdk.version,
      react: sdk.peerDependencies.react,
      'react-dom': sdk.peerDependencies['react-dom'],
      'react-router-dom': sdk.peerDependencies['react-router-dom'],
    },
    devDependencies: {
      '@types/node': sdk.devDependencies['@types/node'],
      '@types/react': sdk.devDependencies['@types/react'],
      '@types/react-dom': sdk.devDependencies['@types/react-dom'],
      typescript: sdk.devDependencies.typescript,
      vite: sdk.peerDependencies.vite,
      ...Object.fromEntries(
        toolingDependencies.map((name) => [name, sdk.devDependencies[name]])
      ),
    },
  }
  mkdirSync(target, { recursive: true })
  cpSync(fileURLToPath(new URL('./template', import.meta.url)), target, {
    recursive: true,
    force: false,
    errorOnExist: true,
    filter: (source) =>
      !(sharedTooling.eslint && basename(source) === 'eslint.config.js') &&
      !(
        sharedTooling.prettier &&
        ['prettier.config.cjs', '_prettierignore'].includes(basename(source))
      ),
  })
  renameSync(resolve(target, '_gitignore'), resolve(target, '.gitignore'))
  if (!sharedTooling.prettier) {
    renameSync(
      resolve(target, '_prettierignore'),
      resolve(target, '.prettierignore')
    )
  }
  for (const language of ['en', 'zh']) {
    const localePath = resolve(target, 'src/locales', `${language}.json`)
    const dictionary = JSON.parse(readFileSync(localePath, 'utf8'))
    dictionary.navigation.home = displayName
    writeFileSync(localePath, `${JSON.stringify(dictionary, null, 2)}\n`)
  }
  writeFileSync(
    resolve(target, 'package.json'),
    `${JSON.stringify(metadata, null, 2)}\n`,
    { flag: 'wx' }
  )
  writeFileSync(resolve(target, 'README.md'), `# ${displayName}\n`, {
    flag: 'wx',
  })

  const manager = process.env.npm_config_user_agent?.startsWith('pnpm/')
    ? 'pnpm'
    : 'npm'
  prompts.note(
    [
      `cd '${directory.replaceAll("'", "'\\''")}'`,
      `${manager} install`,
      `${manager} run dev`,
    ].join('\n'),
    'Next steps'
  )
  prompts.outro(
    `Created ${displayName}. Set Kite's PLUGIN_DEV_URL to the address printed by the dev command.`
  )
}

main().catch((error) => {
  prompts.log.error(error.message)
  process.exitCode = 1
})
