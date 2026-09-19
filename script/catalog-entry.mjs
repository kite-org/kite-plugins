import { createHash } from 'node:crypto'

export function catalogEntry(manifest, archive, url, readmeUrl) {
  if (typeof manifest.sdkVersion !== 'string' || !manifest.sdkVersion.trim()) {
    throw new Error(
      `Plugin ${manifest.id}@${manifest.version} is missing sdkVersion; rebuild the plugin with the current SDK`
    )
  }
  return {
    id: manifest.id,
    name: manifest.name,
    description: manifest.description ?? '',
    version: manifest.version,
    sdkVersion: manifest.sdkVersion,
    url,
    sha256: createHash('sha256').update(archive).digest('hex'),
    requires: manifest.requires,
    ...(readmeUrl ? { readmeUrl } : {}),
    ...(manifest.author ? { author: manifest.author } : {}),
    ...(manifest.homepage ? { homepage: manifest.homepage } : {}),
  }
}
