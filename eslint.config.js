import js from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/.pnpm-store/**',
      '**/.vite/**',
      '**/__mf__virtual/**',
      'vendor/**',
      'packages/create-plugin-sdk/template/**',
    ],
  },
  {
    files: ['**/*.{js,jsx,mjs,cjs}'],
    extends: [js.configs.recommended],
    languageOptions: {
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
  },
  {
    files: [
      'plugins/*/src/**/*.{js,jsx,mjs,cjs,ts,tsx}',
      'packages/plugin-sdk/src/**/*.{ts,tsx}',
    ],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  {
    files: [
      '**/*.config.{js,mjs,cjs,ts,tsx}',
      'script/**/*.{js,mjs,cjs,ts}',
      'packages/create-plugin-sdk/index.js',
      'packages/plugin-sdk/src/build-*.ts',
      'packages/plugin-sdk/src/cli.ts',
      'packages/plugin-sdk/src/vite.ts',
    ],
    languageOptions: { globals: globals.node },
  }
)
