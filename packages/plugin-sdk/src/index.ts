import type { ReactNode } from 'react'
import type { AccessorFn, ColumnDef } from '@tanstack/react-table'

import type { KubernetesResource } from './resources.js'

export type LocalizedLabel = string | { en: string; zh: string }

export interface PluginTranslationDictionary {
  [key: string]: string | PluginTranslationDictionary
}

export interface PluginTranslations {
  en: PluginTranslationDictionary
  zh: PluginTranslationDictionary
}

export interface PluginMetadata {
  id: string
  name: string
  description?: string
  author?: string
  homepage?: string
  license?: string
}

export interface PluginRouteMetadata {
  id: string
  path: string
  title?: LocalizedLabel
}

export interface PluginRoute extends PluginRouteMetadata {
  element: ReactNode
}

/** Identifies a resource by API group and plural resource name. */
export interface PluginResourceTarget {
  group: string
  resource: string
}

export interface PluginResourceMetadata extends PluginResourceTarget {
  list: boolean
  detail: boolean
  columns?: readonly PluginResourceColumnMetadata[]
  tabs?: readonly PluginResourceTabMetadata[]
}

export interface PluginResourceColumnMetadata {
  id: string
  header: LocalizedLabel
  order?: number
  defaultHidden?: boolean
}

export interface PluginResourceColumn<T = KubernetesResource, TValue = unknown>
  extends
    PluginResourceColumnMetadata,
    Pick<
      ColumnDef<T, TValue>,
      | 'cell'
      | 'size'
      | 'minSize'
      | 'maxSize'
      | 'enableSorting'
      | 'sortingFn'
      | 'sortDescFirst'
      | 'sortUndefined'
      | 'invertSorting'
      | 'enableHiding'
    > {
  accessorFn?: AccessorFn<T, TValue>
  accessorKey?: (string & {}) | keyof T
}

export interface PluginResourceTabMetadata {
  id: string
  label: LocalizedLabel
  order?: number
}

export interface PluginResourceTab extends PluginResourceTabMetadata {
  element: ReactNode
}

export interface PluginResourceView<
  T = KubernetesResource,
> extends PluginResourceTarget {
  list?: ReactNode
  detail?: ReactNode
  // Columns on the same resource may return different value types.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns?: readonly PluginResourceColumn<T, any>[]
  tabs?: readonly PluginResourceTab[]
}

export interface PluginManifest extends PluginMetadata {
  schemaVersion: 1
  version: string
  sdkVersion: string
  requires: { kite: string }
  entry: string
  module: string
  styles?: string[]
  routes: readonly PluginRouteMetadata[]
  menus: readonly PluginMenu[]
  resources: readonly PluginResourceMetadata[]
}

export interface PluginMenu<RouteId extends string = string> {
  id: string
  parent?: string
  label: LocalizedLabel
  route?: RouteId
  resource?: PluginResourceTarget
  order?: number
  icon?: string
}

export interface PluginDefinition {
  i18n?: PluginTranslations
  routes: readonly PluginRoute[]
  menus: readonly PluginMenu[]
  // Resource targets may describe different Kubernetes object types.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  resources: readonly PluginResourceView<any>[]
}

export function definePlugin<
  const Routes extends readonly PluginRoute[] = readonly [],
>(definition: {
  i18n?: PluginTranslations
  routes?: Routes
  menus?: readonly PluginMenu<NoInfer<Routes[number]['id']>>[]
  resources?: PluginDefinition['resources']
}) {
  return {
    ...definition,
    routes: definition.routes ?? [],
    menus: definition.menus ?? [],
    resources: definition.resources ?? [],
  }
}
