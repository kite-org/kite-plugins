# Create Kite Plugin

`@kite-dev/create-plugin-sdk` creates a React and TypeScript plugin for Kite. It includes plugin configuration, a page using Kite UI components, and scripts for building an installable archive.

## Requirements

- Node.js 20.19 or later in the 20.x series, or Node.js 22.12 or later.
- npm or pnpm.
- A Kite instance matching the generated plugin's `engines.kite` range, initially `>=0.16.0`.

## Create a plugin

With npm:

```sh
npm create @kite-dev/plugin-sdk -- my-plugin
```

With pnpm:

```sh
pnpm create @kite-dev/plugin-sdk my-plugin
```

These commands run the `@kite-dev/create-plugin-sdk` package. The wizard asks for a display name. Omit the directory argument to choose both the directory and display name interactively.

The final directory name becomes the plugin ID. IDs must contain 1–64 lowercase letters, digits, or hyphens, and start and end with a letter or digit. The destination must be empty; an existing `.git` entry is preserved.

### Non-interactive usage

```sh
npm create @kite-dev/plugin-sdk -- my-plugin --yes --display-name "My Plugin"
```

```sh
pnpm create @kite-dev/plugin-sdk my-plugin --yes --display-name "My Plugin"
```

| Argument or option      | Description                                                                        |
| ----------------------- | ---------------------------------------------------------------------------------- |
| `[directory]`           | Destination path, relative to the current directory or absolute.                   |
| `--display-name <name>` | Plugin name shown in Kite. Defaults to the directory name in non-interactive mode. |
| `-y`, `--yes`           | Use defaults without prompting. With no directory argument, creates `my-plugin`.   |
| `-h`, `--help`          | Display CLI usage.                                                                 |

The creator writes project files and prints the next steps. It does not install dependencies, initialize Git, build the plugin, or publish a package.

## Generated project

```text
my-plugin/
├── package.json
├── plugin.config.tsx
├── vite.config.ts
├── tsconfig.json
├── eslint.config.js
├── prettier.config.cjs
├── README.md
├── .gitignore
├── .prettierignore
└── src/
    ├── i18n.ts
    ├── locales/
    │   ├── en.json
    │   └── zh.json
    └── pages/
        ├── home.tsx
        └── home.module.css
```

- `package.json` defines the plugin ID, display name, version, supported Kite versions, dependencies, and scripts. The generated `engines.kite` range is `>=0.16.0`.
- `plugin.config.tsx` registers the home route and a sidebar entry under **Other** using `definePlugin`.
- `src/i18n.ts` binds the English and Chinese dictionaries with `createPluginI18n()` and exports `translations`, `label`, and `useTranslation`.
- `src/locales/en.json` and `src/locales/zh.json` contain navigation and page text. The home label initially uses the chosen display name in both languages.
- `src/pages/home.tsx` displays Kite's selected cluster and namespace using shared UI components and localized text.
- `src/pages/home.module.css` contains styles scoped to the page.
- `vite.config.ts` uses the SDK's build configuration to produce `dist/` and `plugin.json`.
- `eslint.config.js` checks JavaScript, TypeScript, and React Hooks. `prettier.config.cjs` defines formatting and import ordering.
- `README.md` starts with the plugin's display name as its heading.

Set `package.json.engines.kite` to the Kite versions your plugin supports. The SDK defaults this range to `>=0.16.0` if omitted and includes it in the built manifest as `requires.kite`. Kite checks this requirement when managing and loading the plugin. Avoid caret ranges: Kite is pre-1.0, so `^0.16.0` means `>=0.16.0 <0.17.0` and the plugin stops loading on the next Kite minor release.

The home page is lazy-loaded. Keep page CSS and browser-specific dependencies in page modules; the plugin configuration is also executed in Node.js to generate navigation metadata.

## Localize a plugin

Add matching translation keys to `src/locales/en.json` and `src/locales/zh.json`. The generated configuration registers `i18n: translations` and uses `label('navigation.home')` for its route title and menu label.

Inside a page, import the generated hook:

```tsx
import { useTranslation } from '../i18n'

export function ContextHeading() {
  const { t } = useTranslation()
  return <h2>{t('context.description')}</h2>
}
```

Both `label()` and `t()` provide completion for your locale keys. Use `t('key', { name })` for a message containing `{{name}}`. The hook also returns the current `language`. Navigation and page text follow Kite's language selection; namespace registration is handled by Kite.

## Build and install

```sh
cd my-plugin
pnpm install
pnpm run build
pnpm run pack
```

You can use `npm install`, `npm run build`, and `npm run pack` instead.

The package is written to `<id>-<version>.tar.gz` in the plugin directory. In Kite, open the avatar menu, select **Plugin management**, and use **Install from file** to upload it. Plugin installation requires a Kite administrator. Once installed, open the plugin from **Other** in the sidebar.

| Script         | Action                                                     |
| -------------- | ---------------------------------------------------------- |
| `type-check`   | Check TypeScript without producing output.                 |
| `build`        | Type-check and build the plugin into `dist/`.              |
| `dev`          | Watch, rebuild, and serve a development plugin.            |
| `pack`         | Package the existing `dist/` directory. Run `build` first. |
| `lint`         | Check JavaScript, TypeScript, and React Hooks with ESLint. |
| `lint:fix`     | Apply automatic ESLint fixes.                              |
| `format`       | Format source files and sort imports with Prettier.        |
| `format:check` | Check formatting without changing files.                   |

Run `pnpm dev` to start the plugin development service. It prints a manifest URL such as `http://localhost:5174/plugin.json`. Start Kite with `PLUGIN_DEV_URL` set to that URL, then edit the plugin, wait for each rebuild, and refresh Kite. Plugin pages run inside Kite with its shared components and current user and cluster context. Development does not require packaging, installation, or a version bump.

The URL must be reachable from the browser. To change the listening address or port, use `pnpm dev --host 0.0.0.0 --port 5174`. Restart the command after changing the plugin ID, version, or Vite configuration. See [plugin development](../plugin-sdk/README.md#developing-a-plugin) for details.

See the [SDK documentation](../plugin-sdk/README.md) for resource APIs, navigation, components, styling, and plugin configuration.

## Create a plugin in a pnpm workspace

From a workspace whose `pnpm-workspace.yaml` includes `plugins/*`:

```sh
pnpm create @kite-dev/plugin-sdk plugins/my-plugin
pnpm install
pnpm --filter my-plugin run build
pnpm --filter my-plugin run pack
```

The creator writes into the selected directory. Workspace package discovery and dependency installation are managed by pnpm.

The creator detects the nearest ancestor containing `pnpm-workspace.yaml` or `package.json.workspaces`. If that root already provides an ESLint or Prettier configuration, the new plugin reuses the corresponding root configuration and dependencies. Each tool is detected independently; missing tooling is included with the new plugin. The creator does not change workspace configuration.

For shared tooling, run the workspace's quality commands from its root so its file patterns and ignore rules apply consistently:

```sh
pnpm run lint
pnpm run format:check
```

The plugin also includes `lint`, `lint:fix`, `format`, and `format:check` scripts. An npm workspace uses the same configuration reuse behavior.

## Develop the creator locally

From the `kite-plugins` workspace root:

```sh
pnpm install --frozen-lockfile
pnpm run create plugins/my-plugin --yes --display-name "My Plugin"
pnpm install
pnpm --filter 'my-plugin...' run build
pnpm --filter my-plugin run pack
```

The root `create` script builds the SDK and runs this CLI directly. When the local SDK belongs to the destination's pnpm workspace, the generated plugin uses `workspace:^`; otherwise it uses the creator's SDK version from npm. Existing workspace tooling is reused independently of SDK selection. The creator does not modify workspace package patterns.

Changes to `index.js` and `template/` apply on the next invocation. Choose an empty destination each time. For breakpoint debugging, build the SDK and run from the workspace root:

```sh
node --inspect-brk packages/create-plugin-sdk/index.js plugins/my-plugin
```

`npm create` and `pnpm create` run the published creator. Use `pnpm run create` in this repository to develop against the local SDK and creator.

## Releases

The creator and SDK share the same version and are released together. The creator's `workspace:*` dependency becomes the exact SDK version when packed with pnpm.

From the workspace root:

```sh
./script/release.sh plugin-sdk 0.0.6
```

The script only updates both package versions. Commit the changes and push or merge them into `main`. The [publish workflow](../../.github/workflows/publish.yml) detects the version change, creates `plugin-sdk-v<version>`, and publishes the SDK followed by the creator. Stable versions use `latest`; prereleases use `beta`. No local tag or separate creator release command is needed.
