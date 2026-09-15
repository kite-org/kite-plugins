#!/usr/bin/env bash

set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

if [ "${1:-}" = "--help" ]; then
  echo "Usage: ./script/release.sh <plugin-sdk|plugin-id> <version>"
  echo "Prepares a version commit and tag. Push the printed command to publish."
  exit 0
fi
if [ "$#" -ne 2 ]; then
  echo "Usage: ./script/release.sh <plugin-sdk|plugin-id> <version>" >&2
  exit 1
fi

release_target="$1"
release_version="$2"
release_tag="$release_target-v$release_version"

if [ -n "$(git status --porcelain)" ]; then
  echo "Commit your changes before preparing a release." >&2
  exit 1
fi
if git show-ref --verify --quiet "refs/tags/$release_tag"; then
  echo "Tag $release_tag already exists." >&2
  exit 1
fi

if [ "$release_target" = "plugin-sdk" ]; then
  package_dirs=(packages/plugin-sdk packages/create-plugin-sdk)
else
  package_dirs=("plugins/$release_target")
fi

node --input-type=module - "$release_target" "$release_version" "${package_dirs[@]}" <<'NODE'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { basename } from 'node:path'
import { gt, parse } from 'semver'

const [target, version, ...directories] = process.argv.slice(2)
function fail(message) {
  console.error(message)
  process.exit(1)
}
if (!/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(target)) {
  fail('Expected plugin-sdk or a plugin ID with 1-64 lowercase letters, digits or hyphens')
}
const sdk = target === 'plugin-sdk'
const parsed = parse(version)
if (!parsed || parsed.version !== version || parsed.build.length) {
  fail('Expected a semantic version without a v prefix or build metadata')
}
if (!sdk && parsed.prerelease.length) {
  fail('Plugin releases require a stable version such as 0.1.3')
}
const packages = directories.map((directory) => {
  const path = `${directory}/package.json`
  if (!existsSync(path) || (!sdk && !existsSync(`${directory}/plugin.config.tsx`))) {
    fail(`Release target not found: ${directory}`)
  }
  const pkg = JSON.parse(readFileSync(path, 'utf8'))
  const name = sdk ? `@kite-dev/${basename(directory)}` : target
  if (pkg.name !== name) fail(`Expected ${name} in ${path}`)
  if (!gt(version, pkg.version)) fail(`${name}: new version must be greater than ${pkg.version}`)
  return { path, pkg }
})
if (sdk && packages[0].pkg.version !== packages[1].pkg.version) {
  fail('The SDK and creator must have the same version')
}
for (const { path, pkg } of packages) {
  pkg.version = version
  writeFileSync(path, `${JSON.stringify(pkg, null, 2)}\n`)
}
NODE

pnpm install --lockfile-only --ignore-scripts

package_files=()
for directory in "${package_dirs[@]}"; do
  package_files+=("$directory/package.json")
done
git add "${package_files[@]}" pnpm-lock.yaml
git commit -m "release $release_tag"
git tag -a "$release_tag" -m "version $release_tag"

echo "Release $release_tag prepared. Push the commit and tag to publish:"
echo "  git push --atomic origin HEAD $release_tag"
