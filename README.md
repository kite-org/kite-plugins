# Kite Plugins

A collection of frontend plugins for Kite, organized as a pnpm workspace. Each plugin provides pages and sidebar entries that run inside Kite and use its components, resource APIs, and selected cluster context.

## Plugins

| Plugin                                         | Description                                                                                                                                 |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| [cert-manager](plugins/cert-manager/README.md) | Browse certificates, issuers, certificate requests, and ACME resources; manage certificates and issuers through YAML templates and editors. |
| [hello-world](plugins/hello-world/README.md)   | A minimal plugin displaying the selected cluster and namespace with Kite UI components.                                                     |

## Install a plugin in Kite

Open the avatar menu and select **Plugin management**. You must be a Kite administrator to manage plugins.

1. In **Settings > General**, find **Plugin catalog**, enter the URL of a `catalog.json` file in **Catalog URL**, and save. Kite uses one catalog; leave the URL empty to disable catalog browsing.
2. Return to **Plugin management**, open **Plugin catalog**, select a plugin, and click **Install**. Click the plugin name to preview its README.
3. Open the plugin from the sidebar. New installations are enabled automatically.

Use **Installed plugins** to enable or disable a plugin, choose an installed version, or uninstall it. Updates are installed manually with **Update**. Updating preserves the plugin's enabled or disabled state, and previous installed versions remain available for rollback.

To install an archive directly, use **Install from file** and select a plugin's `.tar.gz` package. Plugins run in your browser with your Kite access; install packages from authors you trust.

## Set up the workspace

Requirements:

- Node.js 20.19 or later in the 20.x series, or Node.js 22.12 or later.
- pnpm 10.32.1.
- A Kite instance matching the plugins' `engines.kite` version range (currently `^0.16.0`).
- Python 3 for the local catalog server.

The plugins in this workspace use `@kite-dev/plugin-sdk@0.0.2` from npm.

```text
kite-plugins/
├── plugins/
│   ├── cert-manager/
│   └── hello-world/
├── scripts/generate-catalog.mjs
├── package.json
└── pnpm-workspace.yaml
```

Install the workspace dependencies from this repository's root:

```sh
pnpm install
```

The SDK's `README.md` documents its public APIs and plugin configuration.

## Create a plugin

Run the creator from the repository root:

```sh
pnpm create @kite-dev/plugin-sdk plugins/my-plugin
pnpm install
```

For non-interactive creation:

```sh
pnpm create @kite-dev/plugin-sdk plugins/my-plugin --yes --display-name "My Plugin"
```

The workspace includes every directory matching `plugins/*`. The creator uses the directory name as the plugin ID and generates `package.json`, `plugin.config.tsx`, Vite and TypeScript configuration, English and Chinese locale files, and a page using Kite components. The generated README contains the display name as its heading; add the plugin's user documentation before distributing it.

Configure metadata in `package.json` and register pages and menu entries in `plugin.config.tsx`. Set `engines.kite` to the supported Kite version range; the creator writes `^0.16.0`, and the SDK uses the same default when the field is omitted. Use lazy imports for pages so their browser dependencies and CSS are loaded when the plugin is opened. The configuration itself must be executable in Node.js during the build.

See `create-plugin-sdk/README.md` in the SDK repository for creator options and the local CLI development workflow.

## Localization

Each plugin keeps its translations in `src/locales/en.json` and `src/locales/zh.json`. Add the same keys to both dictionaries and bind them in `src/i18n.ts`:

```ts
import { createPluginI18n } from '@kite-dev/plugin-sdk/i18n'

import en from './locales/en.json'
import zh from './locales/zh.json'

export const {
  resources: translations,
  label,
  useTranslation,
} = createPluginI18n({ en, zh })
```

In `plugin.config.tsx`, pass `i18n: translations` to `definePlugin()` and use `label('navigation.home')` for translated route titles and menu labels. The SDK writes navigation translations into `plugin.json`, allowing Kite to display menus before loading plugin JavaScript.

In page components, import `useTranslation` from the plugin's `src/i18n.ts` and call `t('context.cluster')`. Translation keys have TypeScript completion; interpolation uses `t('key', { name })` for messages containing `{{name}}`. The hook also returns `language` for formatting. Page translations load with the plugin and follow Kite's selected language.

## Build and develop

Run these commands from the repository root:

| Command                                | Action                                               |
| -------------------------------------- | ---------------------------------------------------- |
| `pnpm run type-check`                  | Check TypeScript in all plugins.                     |
| `pnpm run lint`                        | Check scripts and all plugins with ESLint.           |
| `pnpm run lint:fix`                    | Apply automatic ESLint fixes.                        |
| `pnpm run format`                      | Format source files and documentation with Prettier. |
| `pnpm run format:check`                | Check formatting without changing files.             |
| `pnpm run build`                       | Type-check and build all plugins.                    |
| `pnpm run dev`                         | Watch and rebuild all plugins.                       |
| `pnpm run pack`                        | Package each plugin's existing `dist/` output.       |
| `pnpm --filter cert-manager run build` | Build one plugin.                                    |
| `pnpm --filter cert-manager run dev`   | Watch one plugin.                                    |
| `pnpm --filter cert-manager run pack`  | Package one plugin.                                  |

Plugins run inside Kite. The `dev` command rebuilds files in `dist/`; it does not start a standalone page or install changes into Kite.

ESLint and Prettier are configured at the workspace root and shared by every plugin. Run quality checks from the root; individual plugins do not need separate configurations or tool dependencies.

GitHub Actions installs the npm dependencies and runs lint, formatting, and catalog build/package checks on pull requests and pushes to `main`. The workflow validates the generated catalog without publishing it.

For an installable update:

1. Increment the plugin's `package.json` version. Restart any watch build after changing the plugin ID or version.
2. Build the plugin and package it.
3. Install the new archive through **Install from file**, or publish it in a catalog and use **Update**.

Packages are written to each plugin directory as `<id>-<version>.tar.gz`. An installed ID and version identify immutable package contents, so changed packages must use a new version.

## Generate a catalog

The catalog generator builds every plugin, packages its output, calculates SHA-256 checksums, and copies available README files for catalog previews.

```sh
pnpm run catalog --base-url https://plugins.example.com/
```

Use the public URL of the directory where the generated catalog will be hosted. The output is:

```text
dist/catalog/
├── catalog.json
├── packages/
│   └── <id>-<version>.tar.gz
└── readmes/
    └── <id>/<version>/README.md
```

Each catalog entry contains plugin metadata, its version, Kite version requirement, download URL, and checksum. A `readmeUrl` is included when the plugin has a root `README.md`. The SDK also includes that README in the plugin archive.

The generator writes one entry per plugin directory using its current version. Each plugin must have a unique ID.

### Local catalog server

To build the catalog and serve it locally:

```sh
pnpm run catalog:serve
```

In Kite, open **Settings > General** and set **Plugin catalog > Catalog URL** to `http://127.0.0.1:18086/catalog.json`. Save the setting, then open **Plugin management** to browse and install plugins. Stop the server with Ctrl+C.

Kite's backend fetches catalogs and packages. The loopback address works when the backend runs on the same machine as this server. For a backend running elsewhere, generate URLs with a reachable host address and bind the server accordingly. Replace `192.0.2.10` in this example with your development host's address:

```sh
pnpm run catalog --base-url http://192.0.2.10:18086/
python3 -m http.server 18086 --bind 0.0.0.0 --directory dist/catalog
```

Then set **Catalog URL** in **Settings > General** to `http://192.0.2.10:18086/catalog.json` and save.

After changing a plugin version, regenerate the catalog and click **Refresh catalog** in Kite. Refreshing discovers versions; it does not install updates.

### Publish a catalog

Publish `dist/catalog/` to a static HTTP(S) host, such as GitHub Pages, using the same base URL supplied to the generator.

Archives can be hosted separately, including as GitHub Release assets:

```sh
pnpm run catalog \
  --base-url https://plugins.example.com/ \
  --package-base-url https://downloads.example.com/plugins/
```

Upload the contents of `dist/catalog/packages/` to the package host, and publish `catalog.json` and `readmes/` on the catalog host. Make the archives available before publishing the catalog that references them. The generator creates files locally; deployment is performed separately.

## License

Apache-2.0.
