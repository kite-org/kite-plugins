import { useEffect, useState } from 'react'
import { usePluginSettings } from '@kite-dev/plugin-sdk/hooks'
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kite-dev/plugin-sdk/ui'

import { useTranslation } from './i18n'

export interface ResourceMapSettings {
  grouping?: 'namespace' | 'node'
  issuesOnly?: boolean
  refreshSeconds?: number
}

const defaultRefreshSeconds = 15

export default function Settings() {
  const { t } = useTranslation()
  const { settings, isLoading, isSaving, error, save } =
    usePluginSettings<ResourceMapSettings>()
  const [grouping, setGrouping] = useState<'namespace' | 'node'>('namespace')
  const [filter, setFilter] = useState<'all' | 'issues'>('all')
  const [refreshSeconds, setRefreshSeconds] = useState(
    String(defaultRefreshSeconds)
  )
  const [applied, setApplied] = useState(false)

  useEffect(() => {
    if (applied || isLoading) return
    setApplied(true)
    setGrouping(settings?.grouping === 'node' ? 'node' : 'namespace')
    setFilter(settings?.issuesOnly ? 'issues' : 'all')
    setRefreshSeconds(String(settings?.refreshSeconds ?? defaultRefreshSeconds))
  }, [applied, isLoading, settings])

  const seconds = Number(refreshSeconds)
  const validSeconds =
    Number.isInteger(seconds) && seconds >= 5 && seconds <= 600

  return (
    <div className="space-y-5">
      <p className="text-pretty text-sm text-muted-foreground">
        {t('settings.description')}
      </p>

      <div className="space-y-2">
        <Label>{t('settings.grouping')}</Label>
        <Select
          value={grouping}
          onValueChange={(value) => setGrouping(value as 'namespace' | 'node')}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="namespace">
              {t('settings.groupingNamespace')}
            </SelectItem>
            <SelectItem value="node">{t('settings.groupingNode')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>{t('settings.filter')}</Label>
        <Select
          value={filter}
          onValueChange={(value) => setFilter(value as 'all' | 'issues')}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('settings.filterAll')}</SelectItem>
            <SelectItem value="issues">{t('settings.filterIssues')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="resource-map-refresh">
          {t('settings.refreshSeconds')}
        </Label>
        <Input
          id="resource-map-refresh"
          type="number"
          min={5}
          max={600}
          value={refreshSeconds}
          onChange={(event) => setRefreshSeconds(event.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          {t('settings.refreshHint')}
        </p>
      </div>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error.message}
        </p>
      )}

      <Button
        disabled={isSaving || isLoading || !validSeconds}
        onClick={() =>
          void save({
            grouping,
            issuesOnly: filter === 'issues',
            refreshSeconds: seconds,
          })
        }
      >
        {isSaving ? t('settings.saving') : t('settings.save')}
      </Button>
    </div>
  )
}
