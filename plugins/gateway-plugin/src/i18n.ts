import { createPluginI18n } from '@kite-dev/plugin-sdk/i18n'

import en from './locales/en.json'
import zh from './locales/zh.json'

export const {
  resources: translations,
  label,
  useTranslation,
} = createPluginI18n({ en, zh })

export type TranslationKey = Parameters<typeof label>[0]
