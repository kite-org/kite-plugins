import valid from 'semver/functions/valid.js'
import validRange from 'semver/ranges/valid.js'

import type {
  PluginDefinition,
  PluginManifest,
  PluginMenu,
  PluginRouteMetadata,
} from './index.js'
import { getPluginNavigation } from './manifest-navigation.js'
import { resolvePluginRoute } from './route-path.js'

export const coreMenuGroupIds = [
  'core:application',
  'core:workloads',
  'core:traffic',
  'core:storage',
  'core:config',
  'core:security',
  'core:other',
] as const

// Kite is pre-1.0, so a caret range would expire on every minor release.
export const defaultKiteRange = '>=0.16.0'

const coreMenuGroups = new Set<string>(coreMenuGroupIds)
const idPattern = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isLocalizedLabel(value: unknown) {
  return (
    typeof value === 'string' ||
    (isRecord(value) &&
      typeof value.en === 'string' &&
      typeof value.zh === 'string')
  )
}

function isAssetPath(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    !/[\\\0:#?%]/.test(value) &&
    value
      .split('/')
      .every((segment) => segment !== '' && segment !== '.' && segment !== '..')
  )
}

export function validatePluginIdentity(id: unknown, name: unknown) {
  if (
    typeof id !== 'string' ||
    !/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(id)
  ) {
    throw new Error(
      'Plugin ID must be 1-64 lowercase letters, digits or hyphens, starting and ending with a letter or digit'
    )
  }
  if (typeof name !== 'string' || !name.trim() || name.length > 128) {
    throw new Error('Plugin name must be 1-128 characters')
  }
  return { id, name }
}

export function validateManifest(
  input: unknown
): asserts input is PluginManifest {
  if (!isRecord(input)) throw new Error('Plugin manifest must be an object')
  if (input.schemaVersion !== 1)
    throw new Error('Unsupported plugin schema version')
  const { id } = validatePluginIdentity(input.id, input.name)
  if (
    typeof input.version !== 'string' ||
    input.version.length > 128 ||
    input.version.trim() !== input.version ||
    input.version.startsWith('v') ||
    !valid(input.version)
  ) {
    throw new Error(
      'Plugin version must be a semantic version of at most 128 characters'
    )
  }
  if (
    typeof input.sdkVersion !== 'string' ||
    input.sdkVersion.length > 128 ||
    input.sdkVersion.trim() !== input.sdkVersion ||
    input.sdkVersion.startsWith('v') ||
    !valid(input.sdkVersion)
  ) {
    throw new Error(
      'sdkVersion must be a semantic version of at most 128 characters'
    )
  }
  for (const key of ['description', 'author', 'homepage', 'license'] as const) {
    if (input[key] !== undefined && typeof input[key] !== 'string')
      throw new Error(`Plugin ${key} must be a string`)
  }
  if (
    typeof input.module !== 'string' ||
    !input.module.startsWith('./') ||
    !isAssetPath(input.module.slice(2))
  ) {
    throw new Error('Plugin module must be an exposed module such as ./plugin')
  }
  if (!isAssetPath(input.entry))
    throw new Error('Plugin entry must be a relative asset path')
  if (
    input.styles !== undefined &&
    (!Array.isArray(input.styles) || !input.styles.every(isAssetPath))
  ) {
    throw new Error('Plugin styles must contain relative asset paths')
  }
  if (
    !isRecord(input.requires) ||
    typeof input.requires.kite !== 'string' ||
    !input.requires.kite.trim()
  ) {
    throw new Error('requires.kite is required')
  }
  if (validRange(input.requires.kite) === null) {
    throw new Error('Invalid requires.kite range')
  }
  validateNavigation(id, input)
}

function validateResourceTarget(input: unknown) {
  if (!isRecord(input)) throw new Error('Resource target must be an object')
  const { group, resource } = input
  if (
    typeof group !== 'string' ||
    (group !== '' &&
      !/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/.test(
        group
      )) ||
    group.length > 253
  ) {
    throw new Error(`Invalid resource API group: ${String(group)}`)
  }
  if (
    typeof resource !== 'string' ||
    !/^[a-z]([a-z0-9-]*[a-z0-9])?$/.test(resource) ||
    resource.length > 63
  ) {
    throw new Error(`Invalid resource name: ${String(resource)}`)
  }
  return { group, resource }
}

function validateResources(input: Record<string, unknown>) {
  if (!Array.isArray(input.resources))
    throw new Error('Plugin resources must be an array')
  const targets = new Set<string>()
  for (const entry of input.resources) {
    if (!isRecord(entry)) throw new Error('Plugin resources must be objects')
    const { group, resource } = validateResourceTarget(entry)
    for (const kind of ['columns', 'tabs'] as const) {
      const extensions = entry[kind]
      if (extensions === undefined) continue
      if (!Array.isArray(extensions))
        throw new Error(
          `Resource ${resource}.${group} ${kind} must be an array`
        )
      const ids = new Set<string>()
      for (const extension of extensions) {
        if (
          !isRecord(extension) ||
          typeof extension.id !== 'string' ||
          !idPattern.test(extension.id) ||
          ids.has(extension.id)
        )
          throw new Error(
            `Invalid or duplicate ${kind} ID for ${resource}.${group}`
          )
        ids.add(extension.id)
        if (
          !isLocalizedLabel(extension[kind === 'columns' ? 'header' : 'label'])
        )
          throw new Error(`Invalid label for ${kind}: ${extension.id}`)
        if (extension.order !== undefined && !Number.isFinite(extension.order))
          throw new Error(`Invalid order for ${kind}: ${extension.id}`)
        if (
          kind === 'columns' &&
          extension.defaultHidden !== undefined &&
          typeof extension.defaultHidden !== 'boolean'
        )
          throw new Error(`Invalid defaultHidden for column: ${extension.id}`)
      }
    }
    if (
      !entry.list &&
      !entry.detail &&
      !(entry.columns as unknown[] | undefined)?.length &&
      !(entry.tabs as unknown[] | undefined)?.length
    ) {
      throw new Error(
        `Resource ${resource}.${group} must provide a list, detail, columns or tabs`
      )
    }
    const key = `${resource}.${group}`
    if (targets.has(key)) throw new Error(`Duplicate resource target: ${key}`)
    targets.add(key)
  }
}

export function validateNavigation(
  pluginId: string,
  input: unknown
): asserts input is Pick<PluginManifest, 'routes' | 'menus' | 'resources'> {
  if (
    !isRecord(input) ||
    !Array.isArray(input.routes) ||
    !Array.isArray(input.menus)
  ) {
    throw new Error('Plugin routes and menus must be arrays')
  }
  validateResources(input)
  const routeIds = new Set<string>()
  const paths = new Set<string>()
  for (const route of input.routes) {
    if (!isRecord(route)) throw new Error('Plugin routes must be objects')
    if (
      typeof route.id !== 'string' ||
      !idPattern.test(route.id) ||
      routeIds.has(route.id)
    ) {
      throw new Error(`Invalid or duplicate route ID: ${route.id}`)
    }
    if (route.title !== undefined && !isLocalizedLabel(route.title))
      throw new Error(`Invalid title for route: ${route.id}`)
    if (
      typeof route.path !== 'string' ||
      route.path.startsWith('/') ||
      route.path.includes('\\') ||
      route.path.split('/').some((part) => part === '.' || part === '..') ||
      !/^[a-zA-Z0-9_:/?*.-]*$/.test(route.path) ||
      paths.has(route.path.replace(/:[^/]+/g, ':param'))
    ) {
      throw new Error(`Invalid or duplicate plugin path: ${route.path}`)
    }
    routeIds.add(route.id)
    paths.add(route.path.replace(/:[^/]+/g, ':param'))
  }
  const menuIds = new Set<string>()
  for (const menu of input.menus) {
    if (!isRecord(menu)) throw new Error('Plugin menus must be objects')
    if (
      typeof menu.id !== 'string' ||
      !idPattern.test(menu.id) ||
      menuIds.has(menu.id)
    ) {
      throw new Error(`Invalid or duplicate menu ID: ${menu.id}`)
    }
    if (!isLocalizedLabel(menu.label))
      throw new Error(`Invalid label for menu: ${menu.id}`)
    if (
      menu.icon !== undefined &&
      (typeof menu.icon !== 'string' || !/^Icon[A-Za-z0-9]+$/.test(menu.icon))
    ) {
      throw new Error(`Invalid icon for menu: ${menu.id}`)
    }
    if (menu.order !== undefined && !Number.isFinite(menu.order))
      throw new Error(`Invalid order for menu: ${menu.id}`)
    if (menu.route !== undefined && typeof menu.route !== 'string')
      throw new Error(`Invalid route for menu: ${menu.id}`)
    if (menu.resource !== undefined) {
      const { group } = validateResourceTarget(menu.resource)
      if (!group)
        throw new Error(`Menu resource must be a custom resource: ${menu.id}`)
      if (menu.route !== undefined)
        throw new Error(`Menu must use either route or resource: ${menu.id}`)
    }
    if (menu.parent !== undefined && typeof menu.parent !== 'string')
      throw new Error(`Invalid parent for menu: ${menu.id}`)
    menuIds.add(menu.id)
    if (menu.route) {
      resolvePluginRoute(
        { pluginId, routes: input.routes as PluginRouteMetadata[] },
        menu.route
      )
    }
  }
  const menus = new Map(
    (input.menus as PluginMenu[]).map((menu) => [
      `${pluginId}:${menu.id}`,
      menu,
    ])
  )
  for (const menu of menus.values()) {
    let parent = menu.parent
    const visited = new Set([`${pluginId}:${menu.id}`])
    while (parent && !coreMenuGroups.has(parent)) {
      if (visited.has(parent)) throw new Error(`Cyclic menu parent: ${parent}`)
      visited.add(parent)
      const group = menus.get(parent)
      if (!group || group.route || group.resource)
        throw new Error(`Invalid menu parent: ${parent}`)
      parent = group.parent
    }
  }
}

function matchingTranslations(en: unknown, zh: unknown): boolean {
  if (typeof en === 'string') return typeof zh === 'string'
  return (
    isRecord(en) &&
    isRecord(zh) &&
    Object.keys(en).length === Object.keys(zh).length &&
    Object.entries(en).every(
      ([key, value]) =>
        Object.hasOwn(zh, key) && matchingTranslations(value, zh[key])
    )
  )
}

export function validateDefinition(
  pluginId: string,
  input: unknown
): asserts input is PluginDefinition {
  validateNavigation(pluginId, input)
  if ('i18n' in input && input.i18n !== undefined) {
    if (
      !isRecord(input.i18n) ||
      !isRecord(input.i18n.en) ||
      !matchingTranslations(input.i18n.en, input.i18n.zh)
    ) {
      throw new Error(
        'Plugin i18n must provide en and zh dictionaries with matching string keys'
      )
    }
  }
  for (const route of input.routes) {
    if (!Object.hasOwn(route, 'element'))
      throw new Error(`Missing element for route: ${route.id}`)
  }
  const definition = input as PluginDefinition
  for (const resource of definition.resources) {
    for (const tab of resource.tabs ?? []) {
      if (!Object.hasOwn(tab, 'element'))
        throw new Error(`Missing element for tab: ${tab.id}`)
    }
    for (const column of resource.columns ?? []) {
      if (
        column.sortingFn !== undefined &&
        typeof column.sortingFn !== 'function' &&
        ![
          'auto',
          'basic',
          'text',
          'textCaseSensitive',
          'alphanumeric',
          'alphanumericCaseSensitive',
          'datetime',
        ].includes(column.sortingFn)
      )
        throw new Error(`Invalid sortingFn for column: ${column.id}`)
      if (
        column.accessorFn !== undefined &&
        typeof column.accessorFn !== 'function'
      )
        throw new Error(`Invalid accessorFn for column: ${column.id}`)
      if (
        column.accessorKey !== undefined &&
        typeof column.accessorKey !== 'string'
      )
        throw new Error(`Invalid accessorKey for column: ${column.id}`)
      if (column.accessorFn !== undefined && column.accessorKey !== undefined)
        throw new Error(
          `Column ${column.id} must use either accessorFn or accessorKey`
        )
    }
  }
}

export function validateModule(
  manifest: PluginManifest,
  input: unknown
): asserts input is PluginDefinition {
  validateDefinition(manifest.id, input)
  if (
    JSON.stringify(getPluginNavigation(input)) !==
    JSON.stringify(getPluginNavigation(manifest))
  ) {
    throw new Error('Plugin routes, menus and resources must match plugin.json')
  }
}
