# Gateway API

Manage Kubernetes Gateways and HTTPRoutes in Kite. The plugin adds **Gateways** and **HTTP Routes** to the **Traffic** sidebar group. Both menus open Kite's CRD pages, where the plugin supplies the list and detail views. Resource links use the same CRD URLs.

## Features

- Search resource tables, select namespaces, and refresh automatically.
- Inspect Gateway classes, addresses, listeners, TLS certificate references, conditions, and attached routes.
- Inspect HTTPRoute hostnames, parent Gateways, matches, filters, backend references, and weights.
- Create resources from YAML templates; view, edit, clone, and delete resources.
- View events and operation history, including the YAML saved before and after a change.

## Requirements

- Kite 0.16.0 or later, with the plugin SDK's resource view support.
- Gateway API CRDs and a Gateway controller installed in the cluster.
- Kite permissions to read the corresponding `gateways.gateway.networking.k8s.io` and `httproutes.gateway.networking.k8s.io` resources. Mutations require the corresponding write permissions.

GatewayClass and Service references must point to resources configured in your cluster. The plugin does not install a Gateway controller or Gateway API CRDs. Gateway APIs are accessed through Kite's standard CRD endpoints, using your current cluster and permissions.

## Build locally

From the workspace root:

```sh
pnpm install
pnpm --filter 'gateway-plugin...' run build
pnpm --filter gateway-plugin run pack
```

The archive is written to `plugins/gateway-plugin/gateway-plugin-0.1.0.tar.gz`. Install it from **Plugin management → Install from file**. The plugin uses `packages/plugin-sdk` through `workspace:^`; the build command above includes that dependency.

For local catalog development:

```sh
pnpm catalog:dev
```

Set the catalog URL in Kite's general settings to `http://127.0.0.1:18086/catalog.json`, then install **Gateway API** from the catalog.

## Development

```sh
pnpm --filter gateway-plugin dev
```

Resource views and menus are declared in `plugin.config.tsx`. Page components use SDK resource hooks and shared UI components. Translations are in `src/locales/`, and plugin styles use CSS Modules with Kite's theme variables.
