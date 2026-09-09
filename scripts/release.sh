#!/usr/bin/env bash

set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

if [ "$#" -ne 2 ]; then
  echo "Usage: ./scripts/release.sh <plugin-id> <version>" >&2
  exit 1
fi

plugin_id="$1"
release_version="$2"

if [ -n "$(git status --porcelain)" ]; then
  echo "Commit your changes before preparing a release." >&2
  exit 1
fi

node --input-type=module - "$plugin_id" "$release_version" <<'NODE'
import { existsSync, readFileSync } from 'node:fs'
import { gt, parse } from 'semver'

const [id, version] = process.argv.slice(2)
if (!/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(id)) {
  console.error('Expected a plugin ID with 1-64 lowercase letters, digits or hyphens')
  process.exit(1)
}
const directory = `plugins/${id}`
if (!existsSync(`${directory}/package.json`) || !existsSync(`${directory}/plugin.config.tsx`)) {
  console.error(`Expected package.json and plugin.config.tsx in ${directory}`)
  process.exit(1)
}
const plugin = JSON.parse(readFileSync(`${directory}/package.json`, 'utf8'))
if (plugin.name !== id) {
  console.error(`Plugin package name must match its directory: ${id}`)
  process.exit(1)
}
const parsed = parse(version)
if (!parsed || parsed.version !== version || parsed.prerelease.length || parsed.build.length) {
  console.error('Expected a stable version such as 0.1.3, without a v prefix, prerelease or build metadata')
  process.exit(1)
}
if (!gt(version, plugin.version)) {
  console.error(`New version must be greater than ${plugin.version}`)
  process.exit(1)
}
NODE

release_tag="$plugin_id-v$release_version"
if git show-ref --verify --quiet "refs/tags/$release_tag"; then
  echo "Tag $release_tag already exists." >&2
  exit 1
fi

npm version "$release_version" --no-git-tag-version --ignore-scripts --prefix "plugins/$plugin_id"
pnpm install --lockfile-only --ignore-scripts

git add "plugins/$plugin_id/package.json" pnpm-lock.yaml
git commit -m "release $release_tag"
git tag -a "$release_tag" -m "version $release_tag"

echo "Release $release_tag prepared. Push the commit and tag to publish:"
echo "  git push --atomic origin HEAD $release_tag"
