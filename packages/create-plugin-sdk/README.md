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

The generated plugin includes English and Chinese translations. English is required; other languages can be incomplete or omitted, with missing text falling back to English. To remove Chinese translations, delete the `zh` import, use `createPluginI18n({ en })`, and remove `src/locales/zh.json`. Additional translations use their language codes, such as `createPluginI18n({ en, zh, fr })`.

The final directory name becomes the plugin ID. IDs must contain 1–64 lowercase letters, digits, or hyphens, and start and end with a letter or digit. The destination must be empty; an existing `.git` entry is preserved.

### Non-interactive usage

```sh
npm create @kite-dev/plugin-sdk -- my-plugin --yes --display-name "My Plugin"
```

```sh
pnpm create @kite-dev/plugin-sdk my-plugin --yes --display-name "My Plugin"
```

## Publish to npm

New plugins include `dist/` in their npm package and publish publicly to npmjs by default. After installing dependencies, run these commands from the generated project directory:

```sh
npm run build
npm publish
```

Log in to npm first and choose an available package name. In Kite, select **Plugin management → Install from npm**, enter that name, and choose **npmjs** or **npmmirror**. Kite installs the `latest` version; newly published versions may take time to appear on npmmirror.

Increment the version in `package.json` before building and publishing an update.
