import { createHash } from 'node:crypto'

export function catalogEntry(manifest, archive, url, readmeUrl) {
  return {
    id: manifest.id,
    name: manifest.name,
    description: manifest.description ?? '',
    version: manifest.version,
    url,
    sha256: createHash('sha256').update(archive).digest('hex'),
    requires: manifest.requires,
    ...(readmeUrl ? { readmeUrl } : {}),
    ...(manifest.author ? { author: manifest.author } : {}),
    ...(manifest.homepage ? { homepage: manifest.homepage } : {}),
  }
}
