import { useMemo, useState } from 'react'
import { useCluster } from '@kite-dev/plugin-sdk/hooks'
import {
  createResource,
  deleteResource,
  usePodFiles,
  useResourceContext,
  useResourceEvents,
  useResources,
} from '@kite-dev/plugin-sdk/resources'
import {
  Badge,
  Button,
  DeleteConfirmationDialog,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  PodFileBrowser,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kite-dev/plugin-sdk/ui'

import styles from './files.module.css'
import { useTranslation } from './i18n'
import {
  browsingPod,
  consumesClaim,
  getMounts,
  isHelper,
  podsResource,
  type Pod,
  type PVC,
} from './mounts'

export default function PvcFiles() {
  const { resource: claim } = useResourceContext<PVC>()
  const { currentCluster } = useCluster()
  const { t } = useTranslation()
  const namespace = claim.metadata!.namespace!
  const block = claim.spec?.volumeMode === 'Block'
  const claimUnavailable =
    !!claim.metadata!.deletionTimestamp || claim.status?.phase === 'Lost'
  const pods = useResources<Pod>(podsResource, {
    namespace,
    enabled: !block,
    refreshInterval: 5000,
  })
  const consumers = useMemo(
    () => (pods.data ?? []).filter((pod) => consumesClaim(pod, claim)),
    [pods.data, claim]
  )
  const mounts = useMemo(() => getMounts(consumers, claim), [consumers, claim])
  const [selectedId, setSelectedId] = useState('')
  const selected =
    mounts.find((mount) => mount.id === selectedId) ??
    mounts.find((mount) => mount.running && !mount.subPath) ??
    mounts.find((mount) => mount.running) ??
    mounts[0]
  const helper = consumers.find((pod) => isHelper(pod, claim))
  const activeConsumers = consumers.filter(
    (pod) => pod.status?.phase !== 'Succeeded' && pod.status?.phase !== 'Failed'
  )
  const singlePod =
    claim.spec?.accessModes?.includes('ReadWriteOncePod') &&
    activeConsumers.length > 0
  const nodeConsumer = claim.spec?.accessModes?.includes('ReadWriteOnce')
    ? (activeConsumers.find(
        (pod) => pod.spec?.nodeName && pod.status?.phase === 'Running'
      ) ?? activeConsumers.find((pod) => pod.spec?.nodeName))
    : undefined
  const files = usePodFiles(
    namespace,
    selected?.pod.metadata!.name ?? '',
    selected?.container ?? '',
    selected?.path ?? '/',
    { enabled: !!selected?.running && !pods.error && !block }
  )
  const helperReady = mounts.some(
    (mount) => mount.pod === helper && mount.running
  )
  const helperEvents = useResourceEvents(
    podsResource,
    helper?.metadata!.name ?? '',
    {
      namespace,
      enabled: !!helper && !helperReady,
      refreshInterval: 5000,
    }
  )
  const lastWarning = (helperEvents.data ?? [])
    .filter((event) => event.type === 'Warning')
    .sort((a, b) =>
      (b.lastTimestamp ?? b.metadata?.creationTimestamp ?? '').localeCompare(
        a.lastTimestamp ?? a.metadata?.creationTimestamp ?? ''
      )
    )[0]
  const [createOpen, setCreateOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [image, setImage] = useState('busybox:1.37')
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [actionError, setActionError] = useState('')
  const createDisabled =
    !!helper ||
    !!singlePod ||
    block ||
    claimUnavailable ||
    pods.isPending ||
    !!pods.error

  async function createHelper() {
    setCreating(true)
    setActionError('')
    try {
      const pod = await createResource(
        podsResource,
        browsingPod(claim, image.trim(), nodeConsumer),
        {
          namespace,
          cluster: currentCluster!,
        }
      )
      setSelectedId(`${pod.metadata!.uid}/files//volume`)
      setCreateOpen(false)
      await pods.refetch()
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error))
    } finally {
      setCreating(false)
    }
  }

  async function removeHelper() {
    if (!helper) return
    setDeleting(true)
    setActionError('')
    try {
      await deleteResource(podsResource, helper.metadata!.name!, {
        namespace,
        cluster: currentCluster!,
        wait: false,
      })
      setDeleteOpen(false)
      await pods.refetch()
    } catch (error) {
      setActionError(error instanceof Error ? error.message : String(error))
    } finally {
      setDeleting(false)
    }
  }

  if (block) return <p className={styles.muted}>{t('blocked')}</p>

  return (
    <div className={styles.panel}>
      <div className={styles.toolbar}>
        {mounts.length > 0 && (
          <Select value={selected?.id} onValueChange={setSelectedId}>
            <SelectTrigger className={styles.source} aria-label={t('source')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {mounts.map((mount) => (
                <SelectItem key={mount.id} value={mount.id}>
                  {mount.pod.metadata!.name} / {mount.container} / {mount.path}
                  {!mount.running && ` · ${t('notRunning')}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Button
          variant="outline"
          onClick={() => void pods.refetch()}
          disabled={pods.isFetching}
        >
          {t('refresh')}
        </Button>
        {helper ? (
          <Button
            variant="outline"
            disabled={!!helper.metadata!.deletionTimestamp}
            onClick={() => {
              setActionError('')
              setDeleteOpen(true)
            }}
          >
            {t('cleanup')}
          </Button>
        ) : (
          <Button
            variant={selected?.running && !files.error ? 'outline' : 'default'}
            disabled={createDisabled}
            onClick={() => {
              setActionError('')
              setCreateOpen(true)
            }}
          >
            {t('create')}
          </Button>
        )}
      </div>

      {selected && (selected.readOnly || selected.subPath) && (
        <div className={styles.details}>
          {selected.readOnly && (
            <Badge variant="secondary">{t('readOnly')}</Badge>
          )}
          {selected.subPath && (
            <p className={styles.muted}>
              {t('subPath', { path: selected.subPath })}
            </p>
          )}
        </div>
      )}
      {claimUnavailable && (
        <p role="alert" className={styles.error}>
          {t('claimUnavailable')}
        </p>
      )}
      {singlePod && !helper && <p className={styles.muted}>{t('singlePod')}</p>}
      {actionError && !createOpen && !deleteOpen && (
        <p role="alert" className={styles.error}>
          {actionError}
        </p>
      )}

      {pods.error ? (
        <p role="alert" className={styles.error}>
          {pods.error.message}
        </p>
      ) : pods.isPending ? (
        <p role="status" className={styles.muted}>
          {t('loading')}
        </p>
      ) : !selected ? (
        <div className={styles.empty}>
          <p className={styles.muted}>{t('empty')}</p>
        </div>
      ) : !selected.running ? (
        <div className={styles.empty}>
          <p role="status" className={styles.muted}>
            {isHelper(selected.pod, claim)
              ? t(
                  ['Failed', 'Succeeded'].includes(
                    selected.pod.status?.phase ?? ''
                  )
                    ? 'helperStopped'
                    : 'pending'
                )
              : t('unavailable')}
          </p>
          {isHelper(selected.pod, claim) && (
            <p className={styles.muted}>
              {lastWarning?.message ??
                selected.pod.status?.containerStatuses?.[0]?.state?.waiting
                  ?.message ??
                selected.pod.status?.conditions?.find(
                  (condition) =>
                    condition.type === 'PodScheduled' &&
                    condition.status === 'False'
                )?.message}
            </p>
          )}
        </div>
      ) : files.error ? (
        <div className={styles.panel}>
          <p className={styles.muted}>{t('openFailed')}</p>
          <p role="alert" className={styles.error}>
            {files.error.message}
          </p>
          <div>
            <Button variant="outline" onClick={() => void files.refetch()}>
              {t('retry')}
            </Button>
          </div>
        </div>
      ) : files.isPending ? (
        <p role="status" className={styles.muted}>
          {t('checking')}
        </p>
      ) : (
        <PodFileBrowser
          key={selected.id}
          namespace={namespace}
          podName={selected.pod.metadata!.name!}
          container={selected.container}
          rootPath={selected.path}
          readOnly={selected.readOnly}
        />
      )}

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          if (!creating) setCreateOpen(open)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('create')}</DialogTitle>
            <DialogDescription>{t('createDescription')}</DialogDescription>
          </DialogHeader>
          <div className={styles.field}>
            <Label htmlFor="pvc-browser-image">{t('image')}</Label>
            <Input
              id="pvc-browser-image"
              value={image}
              disabled={creating}
              onChange={(event) => setImage(event.target.value)}
            />
            <p className={styles.muted}>{t('imageHint')}</p>
            {nodeConsumer && (
              <p className={styles.muted}>
                {t('sameNode', { node: nodeConsumer.spec!.nodeName })}
              </p>
            )}
            {actionError && (
              <p role="alert" className={styles.error}>
                {actionError}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              disabled={creating}
              onClick={() => setCreateOpen(false)}
            >
              {t('cancel')}
            </Button>
            <Button
              disabled={creating || !image.trim() || createDisabled}
              onClick={() => void createHelper()}
            >
              {t(creating ? 'creating' : 'create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {helper && (
        <DeleteConfirmationDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          resourceName={helper.metadata!.name!}
          resourceType="Pod"
          namespace={namespace}
          onConfirm={() => void removeHelper()}
          isDeleting={deleting}
          additionalNote={actionError || t('cleanupNote')}
        />
      )}
    </div>
  )
}
