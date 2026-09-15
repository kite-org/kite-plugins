# Kite Plugins

Plugins extend [Kite](https://kite.zzde.me) with custom Kubernetes interfaces. They run inside Kite and use its existing APIs, authentication, and cluster context.

This repository contains the official plugins, the [plugin SDK](packages/plugin-sdk/README.md), and the [project creator](packages/create-plugin-sdk/README.md).

## What plugins can do

- Add custom pages, routes, and sidebar menus.
- Provide complete list and detail views for custom resources.
- Add columns to resource lists and tabs to resource details, including native Kubernetes resources.
- Reuse Kite's UI components, resource hooks, namespace selection, and localization.

## Available plugins

| Plugin                                          | Description                                                                                |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------ |
| [cert-manager](plugins/cert-manager/README.md)  | Manage certificates, issuers, certificate requests, and ACME resources.                    |
| [Gateway API](plugins/gateway-plugin/README.md) | Manage Gateways and HTTPRoutes, including listeners, routing rules, and related resources. |

## Create a plugin

Create an independent project:

```sh
pnpm create @kite-dev/plugin-sdk plugins/my-plugin
cd plugins/my-plugin
pnpm install
```

Edit `plugin.config.tsx` and `src/` to define your pages, menus, and resource extensions. Build and package the plugin:

```sh
pnpm run build
pnpm run pack
```

Install the generated `.tar.gz` archive in Kite through **Avatar → Plugin management → Install from file**.

## Documentation

- [Plugin overview](https://kite.zzde.me/plugins/)
- [Quick start](https://kite.zzde.me/plugins/quick-start)
- [API reference](https://kite.zzde.me/plugins/api)
- [Localization](https://kite.zzde.me/plugins/i18n)
- [Debugging](https://kite.zzde.me/plugins/debugging)
- [Publishing](https://kite.zzde.me/plugins/publishing)
