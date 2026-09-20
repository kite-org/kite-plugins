import type {
  LocalizedLabel,
  PluginDefinition,
  PluginManifest,
} from './index.js'

function labelMetadata(label: LocalizedLabel) {
  return typeof label === 'object' ? { en: label.en, zh: label.zh } : label
}

type NavigationInput = Pick<
  PluginManifest | PluginDefinition,
  'routes' | 'menus' | 'resources' | 'themes' | 'settings'
>

export function getPluginNavigation(definition: NavigationInput) {
  return {
    routes: definition.routes.map(({ id, path, title }) => ({
      id,
      path,
      title: title === undefined ? undefined : labelMetadata(title),
    })),
    menus: definition.menus.map(
      ({ id, parent, label, route, resource, order, icon }) => ({
        id,
        parent,
        label: labelMetadata(label),
        route,
        resource: resource && {
          group: resource.group,
          resource: resource.resource,
        },
        order,
        icon,
      })
    ),
    resources: definition.resources.map(
      ({ group, resource, list, detail, columns, tabs }) => ({
        group,
        resource,
        list: !!list,
        detail: !!detail,
        columns: columns?.map(({ id, header, order, defaultHidden }) => ({
          id,
          header: labelMetadata(header),
          order,
          defaultHidden,
        })),
        tabs: tabs?.map(({ id, label, order }) => ({
          id,
          label: labelMetadata(label),
          order,
        })),
      })
    ),
    themes: (definition.themes ?? []).map(({ id, label, styles }) => ({
      id,
      label: label === undefined ? undefined : labelMetadata(label),
      styles: [...styles],
    })),
    settings: definition.settings && {
      label:
        definition.settings.label === undefined
          ? undefined
          : labelMetadata(definition.settings.label),
    },
  }
}
