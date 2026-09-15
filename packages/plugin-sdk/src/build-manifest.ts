import { readFileSync } from 'node:fs'

import type { PluginManifest } from './index.js'
import { defaultKiteRange, validateManifest } from './validation.js'

export function readPluginManifest(packagePath: string): PluginManifest {
  const metadata = JSON.parse(readFileSync(packagePath, 'utf8'))
  const manifest: unknown = {
    id: metadata?.name,
    name: metadata?.displayName,
    description: metadata?.description,
    author:
      typeof metadata?.author === 'object' && metadata.author !== null
        ? metadata.author.name
        : metadata?.author,
    homepage: metadata?.homepage,
    license: metadata?.license,
    schemaVersion: 1,
    version: metadata?.version,
    requires: { kite: metadata?.engines?.kite ?? defaultKiteRange },
    entry: 'mf-manifest.json',
    module: './plugin',
    routes: [],
    menus: [],
    resources: [],
  }
  validateManifest(manifest)
  return manifest
}
