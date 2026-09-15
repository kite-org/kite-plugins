import type { TFunctionDetailedResult, TOptions } from 'i18next'
import { useTranslation as useReactTranslation } from 'react-i18next'

import type { PluginTranslationDictionary } from './index.js'
import { usePlugin } from './navigation.js'

type TranslationShape<Dictionary> = {
  [Key in keyof Dictionary]: Dictionary[Key] extends string
    ? string
    : TranslationShape<Dictionary[Key]>
}

export type PluginTranslationKey<Dictionary> = string extends keyof Dictionary
  ? string
  : {
      [Key in keyof Dictionary & string]: Dictionary[Key] extends string
        ? Key
        : `${Key}.${PluginTranslationKey<Dictionary[Key]>}`
    }[keyof Dictionary & string]

type WithPluralKey<Key extends string> =
  Key extends `${infer Base}_ordinal_${Intl.LDMLPluralRule}`
    ? Key | Base
    : Key extends `${infer Base}_${Intl.LDMLPluralRule}`
      ? Key | Base
      : Key

type TranslationResult<Options extends TOptions> = Options extends {
  returnDetails: true
}
  ? TFunctionDetailedResult<string, Options>
  : string

type PluginTFunction<Key extends string> = {
  <const Options extends TOptions>(
    key: Key | Key[],
    options?: Options
  ): TranslationResult<Options>
  <const Options extends TOptions>(
    key: Key | Key[],
    defaultValue: string,
    options?: Options
  ): TranslationResult<Options>
}

function readLabel(
  dictionary: PluginTranslationDictionary,
  key: string
): string {
  const value = dictionary[key]
  if (typeof value === 'string') return value
  const [segment, ...rest] = key.split('.')
  return readLabel(
    dictionary[segment] as PluginTranslationDictionary,
    rest.join('.')
  )
}

export function createPluginI18n<
  const Dictionary extends PluginTranslationDictionary,
>(resources: { en: Dictionary; zh: TranslationShape<NoInfer<Dictionary>> }) {
  return {
    resources,
    label(key: PluginTranslationKey<Dictionary>) {
      return {
        en: readLabel(resources.en, key),
        zh: readLabel(resources.zh, key),
      }
    },
    useTranslation() {
      const { pluginId } = usePlugin()
      const { t, i18n, ready } = useReactTranslation(`kite-plugin-${pluginId}`)
      return {
        t: t as PluginTFunction<
          WithPluralKey<PluginTranslationKey<Dictionary>>
        >,
        i18n,
        ready,
        language: i18n.resolvedLanguage ?? i18n.language,
      }
    },
  }
}
