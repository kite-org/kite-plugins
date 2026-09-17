# Kite Plugin SDK

Build React plugins for Kite with `@kite-dev/plugin-sdk`. Plugins can add pages and sidebar menus, work with Kubernetes resources and CRDs, and reuse Kite's UI components, authentication, cluster selection, and query cache.

A plugin runs inside Kite and uses the signed-in user's permissions. It can provide a resource browser, a custom detail page, or a dashboard that combines several resource types. The SDK includes TypeScript definitions, a Vite configuration helper, and a CLI for packaging installable plugins.

## Quick start

Requirements: Node.js `^20.19.0 || >=22.12.0`, a package manager, and a Kite instance matching the plugin's `engines.kite` version range (default: `>=0.16.0`).

Create a project:

```sh
pnpm create @kite-dev/plugin-sdk my-plugin
cd my-plugin
pnpm install
pnpm run build
pnpm run pack
```

With npm, use `npm create @kite-dev/plugin-sdk my-plugin`, then `npm install`, `npm run build`, and `npm run pack`.

The creator prompts for a directory and display name. It generates a TypeScript project with `plugin.config.tsx`, Vite configuration, a lazy-loaded page, English and Chinese locale files, CSS Modules, and package scripts. To skip prompts:

```sh
pnpm create @kite-dev/plugin-sdk my-plugin --yes --display-name "My Plugin"
```

The resulting archive is named `<plugin-id>-<version>.tar.gz`. In Kite, open **Plugin management** from the avatar menu and upload it. Plugins distributed through a configured catalog can also be installed there.