import { useState } from 'react'
import { useResources } from '@kite-dev/plugin-sdk/resources'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  NamespaceSelector,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kite-dev/plugin-sdk/ui'

import { useTranslation } from './i18n'
import styles from './logs.module.css'
import { resourceTypes, type LogResource, type Target } from './model'

export function ResourcePicker({
  open,
  onOpenChange,
  namespace,
  selected,
  onChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  namespace: string
  selected: Target[]
  onChange: (targets: Target[]) => void
}) {
  const { t } = useTranslation()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={styles.picker}>
        <DialogHeader>
          <DialogTitle>{t('selectResources')}</DialogTitle>
          <DialogDescription>{t('pickerDescription')}</DialogDescription>
        </DialogHeader>
        {open && (
          <PickerContent
            namespace={namespace}
            selected={selected}
            onChange={onChange}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function PickerContent({
  namespace,
  selected,
  onChange,
  onClose,
}: {
  namespace: string
  selected: Target[]
  onChange: (targets: Target[]) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [scope, setScope] = useState(namespace)
  const [kind, setKind] = useState('_all')
  const [search, setSearch] = useState('')
  const options = (resource: string) => ({
    namespace: scope,
    enabled: kind === '_all' || kind === resource,
  })
  const deployments = useResources<LogResource>(
    resourceTypes[0],
    options('deployments')
  )
  const statefulsets = useResources<LogResource>(
    resourceTypes[1],
    options('statefulsets')
  )
  const daemonsets = useResources<LogResource>(
    resourceTypes[2],
    options('daemonsets')
  )
  const jobs = useResources<LogResource>(resourceTypes[3], options('jobs'))
  const pods = useResources<LogResource>(resourceTypes[4], options('pods'))
  const queries = [deployments, statefulsets, daemonsets, jobs, pods]
    .map((query, index) => ({ query, reference: resourceTypes[index] }))
    .filter(({ reference }) => kind === '_all' || reference.resource === kind)
  const resources = queries
    .flatMap(({ query, reference }) =>
      (query.data ?? []).map((resource) => ({
        id: resource.metadata.uid!,
        resource,
        reference,
      }))
    )
    .filter(({ resource, reference }) =>
      `${reference.kind}/${resource.metadata.namespace}/${resource.metadata.name}`
        .toLowerCase()
        .includes(search.toLowerCase())
    )
    .sort((a, b) =>
      `${a.reference.kind}/${a.resource.metadata.namespace}/${a.resource.metadata.name}`.localeCompare(
        `${b.reference.kind}/${b.resource.metadata.namespace}/${b.resource.metadata.name}`
      )
    )
  const loading = queries.some(({ query }) => query.isLoading)
  return (
    <>
      <div className={styles.pickerFilters}>
        <NamespaceSelector value={scope} onChange={setScope} showAll multiple />
        <Select value={kind} onValueChange={setKind}>
          <SelectTrigger aria-label={t('resourceType')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">{t('allResourceTypes')}</SelectItem>
            {resourceTypes.map((type) => (
              <SelectItem key={type.resource} value={type.resource}>
                {type.kind}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Input
        aria-label={t('searchResources')}
        placeholder={t('searchResources')}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
      />
      <div className={styles.resourceList}>
        {queries
          .filter(({ query }) => query.error)
          .map(({ query, reference }) => (
            <p key={reference.resource} role="alert" className={styles.error}>
              {reference.kind}: {query.error!.message}
            </p>
          ))}
        {loading && <p role="status">{t('loading')}</p>}
        {!loading && resources.length === 0 && (
          <p className={styles.muted}>{t('noResources')}</p>
        )}
        {resources.map((target) => {
          const checked = selected.some((item) => item.id === target.id)
          return (
            <label className={styles.resourceOption} key={target.id}>
              <input
                type="checkbox"
                checked={checked}
                onChange={() =>
                  onChange(
                    checked
                      ? selected.filter((item) => item.id !== target.id)
                      : [...selected, target]
                  )
                }
              />
              <span className={styles.resourceKind}>
                {target.reference.kind}
              </span>
              <span className={styles.resourceName}>
                <strong>{target.resource.metadata.name}</strong>
                <small>{target.resource.metadata.namespace}</small>
              </span>
            </label>
          )
        })}
      </div>
      <DialogFooter>
        <span className={styles.muted}>
          {t('selectedResources', { count: selected.length })}
        </span>
        <Button
          variant="ghost"
          disabled={selected.length === 0}
          onClick={() => onChange([])}
        >
          {t('reset')}
        </Button>
        <Button variant="outline" onClick={onClose}>
          {t('done')}
        </Button>
      </DialogFooter>
    </>
  )
}
